from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.baggage import BaggageCreate, BaggageRead, BaggageUpdate

router = APIRouter()


@router.post("", response_model=BaggageRead, status_code=status.HTTP_201_CREATED)
async def create_baggage(baggage_in: BaggageCreate, db: AsyncSession = Depends(get_db)) -> BaggageRead:
    # TODO: Implement with SQLAlchemy
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{baggage_id}", response_model=BaggageRead)
async def get_baggage(baggage_id: str, db: AsyncSession = Depends(get_db)) -> BaggageRead:
    # TODO: Implement with SQLAlchemy
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("", response_model=list[BaggageRead])
async def list_baggage(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)) -> list[BaggageRead]:
    # TODO: Implement with SQLAlchemy
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch("/{baggage_id}", response_model=BaggageRead)
async def update_baggage(baggage_id: str, baggage_in: BaggageUpdate, db: AsyncSession = Depends(get_db)) -> BaggageRead:
    # TODO: Implement with SQLAlchemy
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{baggage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_baggage(baggage_id: str, db: AsyncSession = Depends(get_db)) -> None:
    # TODO: Implement with SQLAlchemy
    raise HTTPException(status_code=501, detail="Not implemented")
