"""WebAuthn / passkey helpers.

Challenges are kept in process memory and expire quickly. That is enough for a
single-worker deployment; a multi-worker setup would need shared storage.
"""

import json
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import UUID

from webauthn import (
    base64url_to_bytes,
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import bytes_to_base64url
from webauthn.helpers.structs import PublicKeyCredentialDescriptor

from app.core.config import get_settings
from app.models.auth import User, WebAuthnCredential

settings = get_settings()

CHALLENGE_TTL = timedelta(minutes=5)

# user id -> (challenge, expiry) for registration ceremonies
_registration_challenges: dict[UUID, tuple[bytes, datetime]] = {}
# base64url challenge -> expiry for authentication ceremonies
_authentication_challenges: dict[str, datetime] = {}


def _expired(expiry: datetime) -> bool:
    return datetime.now(UTC) > expiry


def build_registration_options(
    user: User, credentials: Sequence[WebAuthnCredential]
) -> dict[str, Any]:
    exclude = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(credential.credential_id))
        for credential in credentials
    ]
    options = generate_registration_options(
        rp_id=settings.webauthn_rp_id,
        rp_name=settings.webauthn_rp_name,
        user_id=str(user.id).encode(),
        user_name=user.email,
        user_display_name=user.given_names or user.email,
        exclude_credentials=exclude,
    )
    _registration_challenges[user.id] = (options.challenge, datetime.now(UTC) + CHALLENGE_TTL)
    return cast(dict[str, Any], json.loads(options_to_json(options)))


def verify_registration(user: User, credential: dict[str, Any]) -> tuple[str, str, int]:
    """Return (credential_id, public_key, sign_count) as base64url strings."""
    stored = _registration_challenges.pop(user.id, None)
    if stored is None or _expired(stored[1]):
        raise ValueError("Registration challenge missing or expired")

    verified = verify_registration_response(
        credential=credential,
        expected_challenge=stored[0],
        expected_origin=settings.webauthn_origin,
        expected_rp_id=settings.webauthn_rp_id,
        require_user_verification=False,
    )
    return (
        bytes_to_base64url(verified.credential_id),
        bytes_to_base64url(verified.credential_public_key),
        verified.sign_count,
    )


def build_authentication_options(
    user: User | None, credentials: Sequence[WebAuthnCredential] = ()
) -> dict[str, Any]:
    allow = None
    if user is not None:
        allow = [
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(credential.credential_id))
            for credential in credentials
        ]

    options = generate_authentication_options(
        rp_id=settings.webauthn_rp_id,
        allow_credentials=allow,
    )
    key = bytes_to_base64url(options.challenge)
    _authentication_challenges[key] = datetime.now(UTC) + CHALLENGE_TTL
    return cast(dict[str, Any], json.loads(options_to_json(options)))


def _client_challenge(credential: dict[str, Any]) -> str:
    client_data = credential.get("response", {}).get("clientDataJSON")
    if not isinstance(client_data, str):
        raise ValueError("Credential is missing clientDataJSON")
    decoded = json.loads(base64url_to_bytes(client_data))
    challenge = decoded.get("challenge")
    if not isinstance(challenge, str):
        raise ValueError("Credential is missing a challenge")
    return challenge


def consume_authentication_challenge(credential: dict[str, Any]) -> bytes:
    key = _client_challenge(credential)
    expiry = _authentication_challenges.pop(key, None)
    if expiry is None or _expired(expiry):
        raise ValueError("Authentication challenge missing or expired")
    return base64url_to_bytes(key)


def verify_authentication(record: WebAuthnCredential, credential: dict[str, Any]) -> int:
    """Verify the assertion and return the new signature counter."""
    challenge = consume_authentication_challenge(credential)
    verified = verify_authentication_response(
        credential=credential,
        expected_challenge=challenge,
        expected_origin=settings.webauthn_origin,
        expected_rp_id=settings.webauthn_rp_id,
        credential_public_key=base64url_to_bytes(record.public_key),
        credential_current_sign_count=record.sign_count,
    )
    return verified.new_sign_count
