"""Outbound verification messages.

Email goes through the Gmail API using an OAuth refresh token, so no app
password or SMTP connection is required. SMS has no provider yet: the code is
logged and the call is a no-op.
"""

import base64
import logging
from email.message import EmailMessage

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def _gmail_configured() -> bool:
    return all(
        (
            settings.gmail_client_id,
            settings.gmail_client_secret,
            settings.gmail_refresh_token,
            settings.gmail_sender_email,
        )
    )


async def _access_token(client: httpx.AsyncClient) -> str:
    response = await client.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": settings.gmail_client_id,
            "client_secret": settings.gmail_client_secret,
            "refresh_token": settings.gmail_refresh_token,
            "grant_type": "refresh_token",
        },
    )
    response.raise_for_status()
    return str(response.json()["access_token"])


def _raw_message(to_email: str, subject: str, body: str) -> str:
    message = EmailMessage()
    message["To"] = to_email
    message["From"] = settings.gmail_sender_email or ""
    message["Subject"] = subject
    message.set_content(body)
    return base64.urlsafe_b64encode(message.as_bytes()).decode()


async def send_verification_email(to_email: str, code: str) -> None:
    subject = "Your Cathay verification code"
    body = (
        f"Your verification code is {code}.\n\n"
        f"It expires in {settings.otp_ttl_seconds // 60} minutes. "
        "If you did not request this code, ignore this email."
    )

    if not _gmail_configured():
        logger.warning(
            "Gmail OAuth not configured; verification code for %s is %s", to_email, code
        )
        return

    async with httpx.AsyncClient(timeout=15.0) as client:
        token = await _access_token(client)
        response = await client.post(
            GMAIL_SEND_URL,
            headers={"Authorization": f"Bearer {token}"},
            json={"raw": _raw_message(to_email, subject, body)},
        )
        response.raise_for_status()


async def send_verification_sms(phone_number: str, code: str) -> None:
    # No SMS provider wired up yet; surface the code in logs for local testing.
    logger.warning(
        "SMS provider not configured; verification code for %s is %s", phone_number, code
    )


async def send_verification_code(channel: str, destination: str, code: str) -> None:
    if channel == "sms":
        await send_verification_sms(destination, code)
    else:
        await send_verification_email(destination, code)
