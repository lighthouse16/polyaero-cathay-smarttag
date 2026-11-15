import smtplib
import ssl
import threading
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.core.database import get_db
from app.main import app
from app.services import email


@pytest.fixture
def smtp(monkeypatch):
    settings = Settings(
        _env_file=None,
        smtp_host="smtp.gmail.com",
        smtp_port=465,
        smtp_username="sender@example.com",
        smtp_app_password="test-app-password",
        otp_ttl_seconds=600,
    )
    monkeypatch.setattr(email, "settings", settings)
    factory = MagicMock()
    monkeypatch.setattr(email.smtplib, "SMTP_SSL", factory)
    return factory, factory.return_value.__enter__.return_value


async def test_smtp_authenticates_over_verified_tls_in_a_worker_thread(smtp):
    factory, client = smtp
    main_thread = threading.get_ident()
    login_threads = []
    client.login.side_effect = lambda *_: login_threads.append(threading.get_ident())
    await email.send_verification_code("email", "member@example.com", "123456")

    assert factory.call_args.args == ("smtp.gmail.com", 465)
    context = factory.call_args.kwargs["context"]
    assert context.check_hostname and context.verify_mode == ssl.CERT_REQUIRED
    assert factory.call_args.kwargs["timeout"] == 15
    client.login.assert_called_once_with("sender@example.com", "test-app-password")
    assert login_threads[0] != main_thread
    message = client.send_message.call_args.args[0]
    assert message["To"] == "member@example.com"
    assert message["From"] == "sender@example.com"
    assert "123456" in message.get_content() and "10 minutes" in message.get_content()
    assert factory.return_value.__exit__.called


@pytest.mark.parametrize(
    "username,password",
    [
        (None, "test-app-password"),
        ("sender@example.com", None),
        ("sender@example.com", ""),
    ],
)
async def test_missing_credentials_do_not_send_or_log_the_otp(smtp, caplog, username, password):
    factory, _ = smtp
    email.settings.smtp_username = username
    email.settings.smtp_app_password = Settings(
        _env_file=None, smtp_app_password=password
    ).smtp_app_password
    with pytest.raises(email.EmailDeliveryError, match="not configured"):
        await email.send_verification_email("member@example.com", "123456")
    factory.assert_not_called()
    assert "123456" not in caplog.text and "test-app-password" not in caplog.text


@pytest.mark.parametrize(
    "failure",
    [
        smtplib.SMTPAuthenticationError(535, b"authentication rejected"),
        smtplib.SMTPRecipientsRefused({"member@example.com": (550, b"recipient rejected")}),
        OSError("connection failed"),
    ],
)
async def test_smtp_failure_never_reports_success(smtp, failure):
    _, client = smtp
    client.send_message.side_effect = failure
    with pytest.raises(email.EmailDeliveryError, match="Unable to send verification email"):
        await email.send_verification_email("member@example.com", "123456")


@pytest.mark.parametrize("purpose", ["signup", "signin"])
@pytest.mark.parametrize("fails", [False, True])
async def test_otp_routes_wait_for_smtp_and_surface_delivery_failure(
    smtp, monkeypatch, purpose, fails
):
    _, client = smtp
    user = SimpleNamespace(
        id=uuid4(),
        email="member@example.com",
        is_active=True,
        password_hash=None,
    )
    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: None)
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.create_pending_user", AsyncMock(return_value=user)
    )
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.find_user_by_identifier", AsyncMock(return_value=user)
    )
    monkeypatch.setattr(
        "app.api.v1.endpoints.auth.create_verification_code", AsyncMock(return_value="123456")
    )
    if fails:
        client.login.side_effect = smtplib.SMTPAuthenticationError(535, b"authentication rejected")
    path = "/api/v1/auth/signup/initiate" if purpose == "signup" else "/api/v1/auth/signin"
    payload = {"email": user.email} if purpose == "signup" else {"identifier": user.email}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as api:
        response = await api.post(path, json=payload)
    if fails:
        assert response.status_code == 503, response.text
        assert (
            response.json()["detail"]
            == "Unable to send verification email. Please try again later."
        )
        assert "123456" not in response.text and "test-app-password" not in response.text
        client.send_message.assert_not_called()
    else:
        assert response.status_code == (202 if purpose == "signup" else 200), response.text
        client.send_message.assert_called_once()
        if purpose == "signin":
            assert response.json()["otp_required"] is True
