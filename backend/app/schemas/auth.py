from pydantic import BaseModel

from app.schemas.user import UserOut


class LoginRequest(BaseModel):
    identifier: str  # email OR registration number (spec §4.1)
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
