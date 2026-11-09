from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.tag import TagCreate, TagRead, TagUpdate

router = APIRouter()


@router.post("", response_model=TagRead, status_code=status.HTTP_201_CREATED)
async def create_tag(tag_in: TagCreate, db: AsyncSession = Depends(get_db)) -> TagRead:
    # TODO: Implement with SQLAlchemy
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{tag_id}", response_model=TagRead)
async def get_tag(tag_id: str, db: AsyncSession = Depends(get_db)) -> TagRead:
    # TODO: Implement with SQLAlchemy
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("", response_model=list[TagRead])
async def list_tags(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)) -> list[TagRead]:
    # TODO: Implement with SQLAlchemy
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch("/{tag_id}", response_model=TagRead)
async def update_tag(tag_id: str, tag_in: TagUpdate, db: AsyncSession = Depends(get_db)) -> TagRead:
    # TODO: Implement with SQLAlchemy
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(tag_id: str, db: AsyncSession = Depends(get_db)) -> None:
    # TODO: Implement with SQLAlchemy
    raise HTTPException(status_code=501, detail="Not implemented")
