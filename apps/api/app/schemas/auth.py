from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CommunicationPrefs(BaseModel):
    email_notifications: bool = True
    sms_notifications: bool = False
    promotional_offers: bool = False


class UserBase(BaseModel):
    email: EmailStr
    title: str | None = Field(None, max_length=20)
    family_name: str | None = Field(None, max_length=100)
    given_names: str | None = Field(None, max_length=100)
    date_of_birth: date | None = None
    country_code: str | None = Field(None, max_length=10)
    phone_number: str | None = Field(None, max_length=30)
    communication_prefs: CommunicationPrefs | None = None


class UserUpdate(BaseModel):
    email: EmailStr | None = Field(None, max_length=255)
    title: str | None = Field(None, max_length=20)
    family_name: str | None = Field(None, max_length=100)
    given_names: str | None = Field(None, max_length=100)
    date_of_birth: date | None = None
    country_code: str | None = Field(None, max_length=10)
    phone_number: str | None = Field(None, max_length=30)
    communication_prefs: CommunicationPrefs | None = None
    password: str | None = Field(None, min_length=8, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    membership_number: str | None
    title: str | None
    family_name: str | None
    given_names: str | None
    date_of_birth: date | None
    email: EmailStr
    country_code: str | None
    phone_number: str | None
    membership_tier: str
    status_points: int
    communication_prefs: dict[str, bool]
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(TokenPair):
    user: UserRead


class SignupInitiateRequest(BaseModel):
    email: EmailStr
    country_code: str | None = Field(None, max_length=10)
    phone_number: str | None = Field(None, max_length=30)
    channel: Literal["email", "sms"] = "email"


class SignupInitiateResponse(BaseModel):
    signup_id: UUID
    channel: str
    expires_in: int
    resend_cooldown_seconds: int
    message: str = "Verification code sent"


class SignupVerifyRequest(BaseModel):
    signup_id: UUID
    code: str = Field(..., min_length=4, max_length=10)
    title: str | None = Field(None, max_length=20)
    family_name: str | None = Field(None, max_length=100)
    given_names: str | None = Field(None, max_length=100)
    date_of_birth: date | None = None
    country_code: str | None = Field(None, max_length=10)
    phone_number: str | None = Field(None, max_length=30)
    communication_prefs: CommunicationPrefs | None = None
    password: str | None = Field(None, min_length=8, max_length=128)


class SigninRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=255)
    password: str | None = Field(None, max_length=128)


class SigninResponse(BaseModel):
    otp_required: bool = False
    challenge_id: UUID | None = None
    channel: str | None = None
    expires_in: int | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"


class SigninVerifyRequest(BaseModel):
    challenge_id: UUID
    code: str = Field(..., min_length=4, max_length=10)


class RefreshRequest(BaseModel):
    refresh_token: str
