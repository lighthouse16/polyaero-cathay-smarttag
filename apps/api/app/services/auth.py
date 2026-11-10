import hashlib
import hmac
import re
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from jose import JWTError, jwt  # type: ignore[import-untyped]
from passlib.context import CryptContext  # type: ignore[import-untyped]
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.auth import RefreshToken, User, VerificationCode
from app.schemas.auth import TokenPair, UserUpdate

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthError(Exception):
    """Base class for recoverable authentication failures."""


class EmailAlreadyRegisteredError(AuthError):
    pass


class OTPCooldownError(AuthError):
    def __init__(self, retry_after: int) -> None:
        super().__init__("Verification code requested too recently")
        self.retry_after = retry_after


class InvalidCodeError(AuthError):
    pass


class CodeExpiredError(InvalidCodeError):
    pass


class TooManyAttemptsError(InvalidCodeError):
    pass


# --- passwords -------------------------------------------------------------


def hash_password(password: str) -> str:
    return pwd_context.hash(password)  # type: ignore[no-any-return]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)  # type: ignore[no-any-return]


# --- JWTs ------------------------------------------------------------------


def create_access_token(user_id: UUID, email: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode = {"sub": str(user_id), "email": email, "exp": expire, "type": "access"}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)  # type: ignore[no-any-return]


def create_refresh_token(user_id: UUID, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(UTC) + (expires_delta or timedelta(days=settings.refresh_token_expire_days))
    token = secrets.token_urlsafe(32)
    to_encode = {"sub": str(user_id), "token": token, "exp": expire, "type": "refresh"}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)  # type: ignore[no-any-return]


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])  # type: ignore[no-any-return]
    except JWTError:
        return None


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# --- users -----------------------------------------------------------------


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    return await db.scalar(select(User).where(User.id == user_id))


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


async def find_user_by_identifier(db: AsyncSession, identifier: str) -> User | None:
    """Resolve a member by email, phone number, or membership number."""
    value = identifier.strip()
    if "@" in value:
        return await get_user_by_email(db, value)

    conditions = [User.membership_number == value, User.phone_number == value]
    digits = re.sub(r"\D", "", value)
    if digits:
        conditions.append(User.phone_number == digits)
        conditions.append(
            func.regexp_replace(User.phone_number, r"\D", "", "g") == digits
        )
        conditions.append(
            func.concat(
                func.regexp_replace(func.coalesce(User.country_code, ""), r"\D", "", "g"),
                func.regexp_replace(func.coalesce(User.phone_number, ""), r"\D", "", "g"),
            )
            == digits
        )

    return await db.scalar(select(User).where(or_(*conditions)).limit(1))


async def create_pending_user(
    db: AsyncSession, email: str, country_code: str | None, phone_number: str | None
) -> User:
    existing = await get_user_by_email(db, email)
    if existing is not None:
        if existing.is_verified:
            raise EmailAlreadyRegisteredError
        existing.country_code = country_code or existing.country_code
        existing.phone_number = phone_number or existing.phone_number
        await db.commit()
        await db.refresh(existing)
        return existing

    user = User(email=email.lower(), country_code=country_code, phone_number=phone_number)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user: User, user_in: UserUpdate) -> User:
    update_data = user_in.model_dump(exclude_unset=True)
    password = update_data.pop("password", None)
    if password:
        update_data["password_hash"] = hash_password(password)
    for field, value in update_data.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


async def generate_membership_number(db: AsyncSession) -> str:
    for _ in range(10):
        candidate = f"1906{secrets.randbelow(1_000_000):06d}"
        exists = await db.scalar(select(User.id).where(User.membership_number == candidate))
        if exists is None:
            return candidate
    raise RuntimeError("Could not allocate a unique membership number")


# --- verification codes ----------------------------------------------------


def _hash_code(user_id: UUID, code: str) -> str:
    payload = f"{user_id}:{code}".encode()
    return hmac.new(settings.secret_key.encode(), payload, hashlib.sha256).hexdigest()


def generate_otp() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(settings.otp_length))


async def create_verification_code(
    db: AsyncSession, user: User, identifier: str, channel: str, purpose: str
) -> str:
    now = datetime.now(UTC)
    latest = await db.scalar(
        select(VerificationCode)
        .where(VerificationCode.user_id == user.id)
        .where(VerificationCode.purpose == purpose)
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    if latest is not None and latest.consumed_at is None:
        elapsed = (now - latest.created_at).total_seconds()
        if elapsed < settings.otp_resend_cooldown_seconds:
            raise OTPCooldownError(int(settings.otp_resend_cooldown_seconds - elapsed) + 1)

    code = generate_otp()
    record = VerificationCode(
        user_id=user.id,
        identifier=identifier,
        channel=channel,
        purpose=purpose,
        code_hash=_hash_code(user.id, code),
        expires_at=now + timedelta(seconds=settings.otp_ttl_seconds),
    )
    db.add(record)
    await db.commit()
    return code


async def verify_verification_code(
    db: AsyncSession, user_id: UUID, purpose: str, code: str
) -> None:
    now = datetime.now(UTC)
    record = await db.scalar(
        select(VerificationCode)
        .where(VerificationCode.user_id == user_id)
        .where(VerificationCode.purpose == purpose)
        .where(VerificationCode.consumed_at.is_(None))
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    if record is None:
        raise InvalidCodeError
    if record.expires_at <= now:
        raise CodeExpiredError
    if record.attempts >= settings.otp_max_attempts:
        raise TooManyAttemptsError

    record.attempts += 1
    if not hmac.compare_digest(record.code_hash, _hash_code(user_id, code)):
        await db.commit()
        raise InvalidCodeError

    record.consumed_at = now
    await db.commit()


# --- refresh tokens --------------------------------------------------------


async def create_refresh_token_db(
    db: AsyncSession, user_id: UUID, token: str, expires_at: datetime
) -> RefreshToken:
    rt = RefreshToken(user_id=user_id, token_hash=hash_token(token), expires_at=expires_at)
    db.add(rt)
    await db.commit()
    await db.refresh(rt)
    return rt


async def issue_token_pair(db: AsyncSession, user: User) -> TokenPair:
    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id)
    expires_at = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    await create_refresh_token_db(db, user.id, refresh_token, expires_at)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


async def get_valid_refresh_token(db: AsyncSession, token_hash: str) -> RefreshToken | None:
    return await db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
        .where(RefreshToken.revoked_at.is_(None))
        .where(RefreshToken.expires_at > datetime.now(UTC))
    )


async def revoke_refresh_token(db: AsyncSession, token_hash: str) -> None:
    rt = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if rt:
        rt.revoked_at = datetime.now(UTC)
        await db.commit()


async def revoke_all_user_refresh_tokens(db: AsyncSession, user_id: UUID) -> None:
    await db.execute(
        delete(RefreshToken)
        .where(RefreshToken.user_id == user_id)
        .where(RefreshToken.revoked_at.is_(None))
    )
    await db.commit()


def authenticate_user(user: User, password: str) -> bool:
    if not user.is_active or not user.password_hash:
        return False
    return verify_password(password, user.password_hash)
