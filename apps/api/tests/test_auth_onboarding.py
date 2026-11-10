from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
def outbox(monkeypatch):
    """Capture verification codes instead of hitting Gmail."""
    sent: list[tuple[str, str, str]] = []

    async def fake_send(channel: str, destination: str, code: str) -> None:
        sent.append((channel, destination, code))

    monkeypatch.setattr("app.api.v1.endpoints.auth.send_verification_code", fake_send)
    return sent


def unique_member() -> tuple[str, str, str]:
    suffix = uuid4().hex[:8]
    return (
        f"member-{suffix}@example.com",
        "852",
        f"9{suffix[:1]}{int(suffix, 16) % 10**7:07d}",
    )


async def signup(
    client: AsyncClient, outbox: list[tuple[str, str, str]], password: str | None = "Passw0rd!"
):
    email, country, phone = unique_member()
    response = await client.post(
        "/api/v1/auth/signup/initiate",
        json={"email": email, "country_code": "+852", "phone_number": phone},
    )
    assert response.status_code == 202, response.text
    signup_id = response.json()["signup_id"]
    assert response.json()["channel"] == "email"
    code = outbox[-1][2]

    verify_response = await client.post(
        "/api/v1/auth/signup/verify",
        json={
            "signup_id": signup_id,
            "code": code,
            "title": "Ms",
            "family_name": "Chan",
            "given_names": "Tai Man",
            "date_of_birth": "1990-05-04",
            "country_code": "+852",
            "phone_number": phone,
            "password": password,
            "communication_prefs": {
                "email_notifications": True,
                "sms_notifications": False,
                "promotional_offers": True,
            },
        },
    )
    assert verify_response.status_code == 200, verify_response.text
    return email, phone, verify_response.json()


async def test_signup_verify_creates_member(client: AsyncClient, outbox):
    email, _, payload = await signup(client, outbox)

    assert payload["token_type"] == "bearer"
    assert payload["access_token"]
    assert payload["refresh_token"]

    user = payload["user"]
    assert user["email"] == email
    assert user["membership_number"].startswith("1906")
    assert len(user["membership_number"]) == 10
    assert user["membership_tier"] == "GREEN"
    assert user["status_points"] == 0
    assert user["is_verified"] is True
    assert user["family_name"] == "Chan"
    assert user["given_names"] == "Tai Man"
    assert user["communication_prefs"]["promotional_offers"] is True


async def test_signup_rejects_bad_code(client: AsyncClient, outbox):
    email, _, _ = unique_member()
    response = await client.post(
        "/api/v1/auth/signup/initiate", json={"email": email}
    )
    assert response.status_code == 202
    signup_id = response.json()["signup_id"]

    bad = await client.post(
        "/api/v1/auth/signup/verify", json={"signup_id": signup_id, "code": "000000"}
    )
    assert bad.status_code == 400


async def test_signup_blocks_duplicate_email(client: AsyncClient, outbox):
    email, _, _ = await signup(client, outbox)
    response = await client.post("/api/v1/auth/signup/initiate", json={"email": email})
    assert response.status_code == 409


async def test_signin_with_password_via_any_identifier(client: AsyncClient, outbox):
    email, phone, payload = await signup(client, outbox)
    membership_number = payload["user"]["membership_number"]

    for identifier in (email, phone, membership_number):
        response = await client.post(
            "/api/v1/auth/signin",
            json={"identifier": identifier, "password": "Passw0rd!"},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["otp_required"] is False
        assert body["access_token"]


async def test_signin_passwordless_sends_otp(client: AsyncClient, outbox):
    email, _, payload = await signup(client, outbox, password=None)
    assert payload["user"]["is_verified"] is True

    response = await client.post("/api/v1/auth/signin", json={"identifier": email})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["otp_required"] is True
    assert body["challenge_id"]

    code = outbox[-1][2]
    verified = await client.post(
        "/api/v1/auth/signin/verify",
        json={"challenge_id": body["challenge_id"], "code": code},
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["access_token"]


async def test_signin_rejects_wrong_password(client: AsyncClient, outbox):
    email, _, _ = await signup(client, outbox)
    response = await client.post(
        "/api/v1/auth/signin", json={"identifier": email, "password": "wrong-password"}
    )
    assert response.status_code == 401


async def test_me_returns_member(client: AsyncClient, outbox):
    _, _, payload = await signup(client, outbox)
    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {payload['access_token']}"}
    )
    assert response.status_code == 200
    assert response.json()["membership_number"].startswith("1906")


async def test_passkey_options_requires_auth(client: AsyncClient):
    response = await client.post("/api/v1/auth/passkey/register/options")
    assert response.status_code == 401


async def test_passkey_options_returns_challenge(client: AsyncClient, outbox):
    _, _, payload = await signup(client, outbox)
    response = await client.post(
        "/api/v1/auth/passkey/register/options",
        headers={"Authorization": f"Bearer {payload['access_token']}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["challenge"]
    assert body["rp"]["id"] == "localhost"
    assert body["user"]["name"] == payload["user"]["email"]
