from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.schemas.auth import (
    AuthResponse,
    RefreshRequest,
    SigninRequest,
    SigninResponse,
    SigninVerifyRequest,
    SignupInitiateRequest,
    SignupInitiateResponse,
    SignupVerifyRequest,
    TokenPair,
    UserRead,
    UserUpdate,
)
from app.services.auth import (
    AuthError,
    EmailAlreadyRegisteredError,
    OTPCooldownError,
    authenticate_user,
    create_access_token,
    create_pending_user,
    create_refresh_token,
    create_refresh_token_db,
    create_verification_code,
    decode_token,
    find_user_by_identifier,
    generate_membership_number,
    get_user_by_email,
    get_user_by_id,
    get_valid_refresh_token,
    hash_password,
    hash_token,
    issue_token_pair,
    revoke_refresh_token,
    update_user,
    verify_verification_code,
)
from app.services.email import send_verification_code

router = APIRouter(tags=["authentication"])

settings = get_settings()


def _otp_error(exc: AuthError) -> HTTPException:
    if isinstance(exc, OTPCooldownError):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers={"Retry-After": str(exc.retry_after)},
        )
    if isinstance(exc, EmailAlreadyRegisteredError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc) or "Invalid code")


def _destination(channel: str, email: str, country_code: str | None, phone_number: str | None) -> str:
    if channel == "sms":
        return f"{country_code or ''}{phone_number or ''}"
    return email


@router.post(
    "/signup/initiate",
    response_model=SignupInitiateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def signup_initiate(
    signup_in: SignupInitiateRequest, db: AsyncSession = Depends(get_db)
) -> SignupInitiateResponse:
    if signup_in.channel == "sms" and not signup_in.phone_number:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="phone_number is required for the SMS channel",
        )

    try:
        user = await create_pending_user(
            db, signup_in.email, signup_in.country_code, signup_in.phone_number
        )
    except EmailAlreadyRegisteredError as exc:
        raise _otp_error(exc) from exc

    destination = _destination(
        signup_in.channel, str(signup_in.email), signup_in.country_code, signup_in.phone_number
    )
    try:
        code = await create_verification_code(db, user, destination, signup_in.channel, "signup")
    except AuthError as exc:
        raise _otp_error(exc) from exc

    await send_verification_code(signup_in.channel, destination, code)

    return SignupInitiateResponse(
        signup_id=user.id,
        channel=signup_in.channel,
        expires_in=settings.otp_ttl_seconds,
        resend_cooldown_seconds=settings.otp_resend_cooldown_seconds,
    )


@router.post("/signup/verify", response_model=AuthResponse)
async def signup_verify(
    verify_in: SignupVerifyRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    try:
        await verify_verification_code(db, verify_in.signup_id, "signup", verify_in.code)
    except AuthError as exc:
        raise _otp_error(exc) from exc

    user = await get_user_by_id(db, verify_in.signup_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signup not found")

    user.is_verified = True
    if user.membership_number is None:
        user.membership_number = await generate_membership_number(db)
    if verify_in.title is not None:
        user.title = verify_in.title
    if verify_in.family_name is not None:
        user.family_name = verify_in.family_name
    if verify_in.given_names is not None:
        user.given_names = verify_in.given_names
    if verify_in.date_of_birth is not None:
        user.date_of_birth = verify_in.date_of_birth
    if verify_in.country_code is not None:
        user.country_code = verify_in.country_code
    if verify_in.phone_number is not None:
        user.phone_number = verify_in.phone_number
    if verify_in.communication_prefs is not None:
        user.communication_prefs = verify_in.communication_prefs.model_dump()
    if verify_in.password:
        user.password_hash = hash_password(verify_in.password)

    await db.commit()
    await db.refresh(user)

    tokens = await issue_token_pair(db, user)
    return AuthResponse(**tokens.model_dump(), user=UserRead.model_validate(user))


@router.post("/signin", response_model=SigninResponse)
async def signin(signin_in: SigninRequest, db: AsyncSession = Depends(get_db)) -> SigninResponse:
    user = await find_user_by_identifier(db, signin_in.identifier)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    if user.password_hash is not None:
        if not signin_in.password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This account requires a password",
            )
        if not authenticate_user(user, signin_in.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )
        tokens = await issue_token_pair(db, user)
        return SigninResponse(**tokens.model_dump())

    channel = "email"
    destination = user.email
    if not destination:
        channel = "sms"
        destination = f"{user.country_code or ''}{user.phone_number or ''}"

    try:
        code = await create_verification_code(db, user, destination, channel, "signin")
    except AuthError as exc:
        raise _otp_error(exc) from exc

    await send_verification_code(channel, destination, code)

    return SigninResponse(
        otp_required=True,
        challenge_id=user.id,
        channel=channel,
        expires_in=settings.otp_ttl_seconds,
    )


@router.post("/signin/verify", response_model=AuthResponse)
async def signin_verify(
    verify_in: SigninVerifyRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    try:
        await verify_verification_code(db, verify_in.challenge_id, "signin", verify_in.code)
    except AuthError as exc:
        raise _otp_error(exc) from exc

    user = await get_user_by_id(db, verify_in.challenge_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    tokens = await issue_token_pair(db, user)
    return AuthResponse(**tokens.model_dump(), user=UserRead.model_validate(user))


@router.post("/refresh", response_model=TokenPair)
async def refresh(refresh_in: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    payload = decode_token(refresh_in.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    token_hash = hash_token(refresh_in.refresh_token)
    rt = await get_valid_refresh_token(db, token_hash)
    if not rt:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revoked or expired",
        )

    user_id = UUID(payload["sub"])
    await revoke_refresh_token(db, token_hash)

    access_token = create_access_token(user_id, payload.get("email", ""))
    new_refresh_token = create_refresh_token(user_id)

    expires_at = datetime.now(UTC) + timedelta(days=30)
    await create_refresh_token_db(db, user_id, new_refresh_token, expires_at)

    return TokenPair(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(refresh_in: RefreshRequest, db: AsyncSession = Depends(get_db)) -> None:
    payload = decode_token(refresh_in.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    await revoke_refresh_token(db, hash_token(refresh_in.refresh_token))


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if user_in.email and user_in.email.lower() != current_user.email.lower():
        existing = await get_user_by_email(db, str(user_in.email))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Email already in use"
            )

    return await update_user(db, current_user, user_in)
