from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User, WebAuthnCredential
from app.schemas.auth import AuthResponse, UserRead
from app.schemas.passkey import (
    PasskeyAuthenticateOptionsRequest,
    PasskeyAuthenticateVerifyRequest,
    PasskeyRegisterResponse,
    PasskeyRegisterVerifyRequest,
)
from app.services.auth import find_user_by_identifier, get_user_by_id, issue_token_pair
from app.services.passkey import (
    build_authentication_options,
    build_registration_options,
    verify_authentication,
    verify_registration,
)

router = APIRouter(prefix="/passkey", tags=["authentication"])


@router.post("/register/options")
async def register_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Creation options for navigator.credentials.create()."""
    credentials = (
        await db.scalars(
            select(WebAuthnCredential).where(WebAuthnCredential.user_id == current_user.id)
        )
    ).all()
    return build_registration_options(current_user, credentials)


@router.post(
    "/register/verify",
    response_model=PasskeyRegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_verify(
    body: PasskeyRegisterVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PasskeyRegisterResponse:
    try:
        credential_id, public_key, sign_count = verify_registration(
            current_user, body.credential
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    record = WebAuthnCredential(
        user_id=current_user.id,
        credential_id=credential_id,
        public_key=public_key,
        sign_count=sign_count,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return PasskeyRegisterResponse(
        id=record.id,
        credential_id=record.credential_id,
        name=body.name,
        created_at=record.created_at or datetime.now(UTC),
    )


@router.post("/authenticate/options")
async def authenticate_options(
    body: PasskeyAuthenticateOptionsRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    """Request options for navigator.credentials.get()."""
    user = None
    credentials: list[WebAuthnCredential] = []
    if body.identifier:
        user = await find_user_by_identifier(db, body.identifier)
        if user is not None:
            credentials = list(
                (
                    await db.scalars(
                        select(WebAuthnCredential).where(
                            WebAuthnCredential.user_id == user.id
                        )
                    )
                ).all()
            )
    return build_authentication_options(user, credentials)


@router.post("/authenticate/verify", response_model=AuthResponse)
async def authenticate_verify(
    body: PasskeyAuthenticateVerifyRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    credential_id = body.credential.get("id") or body.credential.get("rawId")
    if not isinstance(credential_id, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Credential id is required"
        )

    record = await db.scalar(
        select(WebAuthnCredential).where(WebAuthnCredential.credential_id == credential_id)
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown passkey"
        )

    try:
        new_sign_count = verify_authentication(record, body.credential)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    record.sign_count = new_sign_count
    record.last_used_at = datetime.now(UTC)
    await db.commit()

    user = await get_user_by_id(db, record.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Member not found")

    tokens = await issue_token_pair(db, user)
    return AuthResponse(**tokens.model_dump(), user=UserRead.model_validate(user))
