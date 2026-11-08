from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenPair,
    UserCreate,
    UserRead,
    UserUpdate,
)
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    create_refresh_token_db,
    create_user,
    decode_token,
    get_user_by_email,
    get_valid_refresh_token,
    hash_password,
    hash_token,
    revoke_all_user_refresh_tokens,
    revoke_refresh_token,
    update_user,
)

router = APIRouter(tags=["authentication"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    existing = await get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = await create_user(db, user_in)
    return user


@router.post("/login", response_model=TokenPair)
async def login(login_in: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    user = await authenticate_user(db, login_in.email, login_in.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id)

    expires_at = datetime.now(UTC) + timedelta(days=30)
    await create_refresh_token_db(db, user.id, refresh_token, expires_at)

    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenPair)
async def refresh(refresh_in: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    payload = decode_token(refresh_in.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_hash = hash_token(refresh_in.refresh_token)
    rt = await get_valid_refresh_token(db, token_hash)
    if not rt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or expired")

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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_hash = hash_token(refresh_in.refresh_token)
    await revoke_refresh_token(db, token_hash)


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_me(user_in: UserUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> User:
    if user_in.email and user_in.email != current_user.email:
        existing = await get_user_by_email(db, user_in.email)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    updated_user = await update_user(db, current_user, user_in)
    return updated_user