"""Outbound verification messages.

Email uses authenticated SMTP over TLS. SMS has no provider yet: the code is
logged and the call is a no-op.
"""

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class EmailDeliveryError(Exception):
    pass


def _send_smtp(message: EmailMessage, username: str, password: str) -> None:
    with smtplib.SMTP_SSL(
        settings.smtp_host,
        settings.smtp_port,
        timeout=15,
        context=ssl.create_default_context(),
    ) as client:
        client.login(username, password)
        client.send_message(message)


async def send_verification_email(to_email: str, code: str) -> None:
    username = settings.smtp_username
    password = settings.smtp_app_password.get_secret_value() if settings.smtp_app_password else ""
    if not username or not password:
        raise EmailDeliveryError("Email delivery is not configured")

    subject = "Your Cathay verification code"
    body = (
        f"Your verification code is {code}.\n\n"
        f"It expires in {settings.otp_ttl_seconds // 60} minutes. "
        "If you did not request this code, ignore this email."
    )

    message = EmailMessage()
    message["To"] = to_email
    message["From"] = username
    message["Subject"] = subject
    message.set_content(body)
    try:
        await asyncio.to_thread(_send_smtp, message, username, password)
    except (smtplib.SMTPException, OSError) as exc:
        raise EmailDeliveryError(
            "Unable to send verification email. Please try again later."
        ) from exc


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
