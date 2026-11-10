from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class PasskeyRegisterVerifyRequest(BaseModel):
    credential: dict[str, Any]
    name: str | None = Field(None, max_length=100)


class PasskeyRegisterResponse(BaseModel):
    id: UUID
    credential_id: str
    name: str | None = None
    created_at: datetime


class PasskeyAuthenticateOptionsRequest(BaseModel):
    identifier: str | None = Field(None, max_length=255)


class PasskeyAuthenticateVerifyRequest(BaseModel):
    credential: dict[str, Any]
