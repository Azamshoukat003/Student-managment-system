from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse
from app.schemas.user import UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Login by email or registration number (spec §4.1)."""
    ident = payload.identifier.strip()
    user = (
        db.query(User)
        .filter(or_(User.email == ident, User.registration_number == ident))
        .first()
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=user)


@router.post("/logout")
def logout(_: User = Depends(get_current_user)):
    """JWT is stateless — the client discards the token. Endpoint kept for symmetry."""
    return {"success": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.put("/password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """User changes own password (spec §4.3 step 4)."""
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Current password incorrect")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"success": True}
