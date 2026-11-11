from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.schemas.auth import CommunicationPrefs, UserRead

router = APIRouter(tags=["users"])


@router.get("/profile", response_model=UserRead)
async def get_profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.put("/preferences", response_model=UserRead)
async def update_preferences(
    prefs: CommunicationPrefs,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    current_user.communication_prefs = prefs.model_dump()
    await db.commit()
    await db.refresh(current_user)
    return current_user
