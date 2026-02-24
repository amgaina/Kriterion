from typing import Optional, Any
from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Optional[Any] = None


class TokenPayload(BaseModel):
    sub: Optional[int] = None
    exp: Optional[int] = None
    type: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str
