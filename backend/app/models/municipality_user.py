from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str
    last_name: str
    phone_number: str
    department: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    phone_number: str | None = None
    semel_yish: int
    department: str | None
    role: str
    is_active: bool
    created_at: datetime


class UpdateUserRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone_number: str | None = None
    department: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserResponse


class MunicipalityUserRecord(BaseModel):
    """Loaded from DB for dependencies (internal)."""

    id: UUID
    email: str
    first_name: str
    last_name: str
    phone_number: str | None
    semel_yish: int
    department: str | None
    role: str
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
