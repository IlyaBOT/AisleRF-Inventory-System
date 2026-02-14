from typing import Optional
from pydantic import BaseModel, Field


class UserPublic(BaseModel):
    id: int
    username: str
    is_admin: bool
    avatar_base64: Optional[str] = None


class UserUpdate(BaseModel):
    username: str = Field(min_length=3, max_length=64)


class PasswordUpdate(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class AvatarUpdate(BaseModel):
    avatar_base64: Optional[str] = None  # base64 payload, WITHOUT data: prefix
