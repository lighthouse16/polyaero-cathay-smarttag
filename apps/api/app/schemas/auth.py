from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    title: str | None = Field(None, max_length=20)
    date_of_birth: datetime | None = None
    phone: str | None = Field(None, max_length=30)
    country: str | None = Field(None, max_length=100)
    marketing_opt_in: bool = False


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    email: EmailStr | None = Field(None, max_length=255)
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    title: str | None = Field(None, max_length=20)
    date_of_birth: datetime | None = None
    phone: str | None = Field(None, max_length=30)
    country: str | None = Field(None, max_length=100)
    marketing_opt_in: bool | None = None
    password: str | None = Field(None, min_length=8, max_length=128)


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    phone_verified: bool
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str
