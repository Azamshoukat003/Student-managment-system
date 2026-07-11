from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.core.security import hash_password
from app.database import get_db
from app.models.user import ROLE_ADMIN, User
from app.schemas.user import (
    ProfileUpdate,
    ResetPasswordRequest,
    UserCreate,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/api/users", tags=["users"])


# ── Self-service profile (any logged-in user) ─────────────────────────────────
@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_me(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Users edit own name/phone/profile image (spec §4.4). Reg no/role/class locked."""
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


# ── Admin user management (spec §3.1, §4.2, §4.5) ─────────────────────────────
@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    email = payload.email.strip().lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    if payload.registration_number and db.query(User).filter(
        User.registration_number == payload.registration_number
    ).first():
        raise HTTPException(status_code=409, detail="Registration number already exists")

    user = User(
        full_name=payload.full_name,
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        registration_number=payload.registration_number,
        class_id=payload.class_id,
        semester=payload.semester,
        department=payload.department,
        phone=payload.phone,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
    role: Optional[str] = None,
    class_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if class_id is not None:
        q = q.filter(User.class_id == class_id)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(User.full_name.ilike(like), User.email.ilike(like),
                         User.registration_number.ilike(like)))
    return q.order_by(User.full_name).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"]:
        data["email"] = data["email"].strip().lower()
        if data["email"] != user.email and db.query(User).filter(
            func.lower(User.email) == data["email"]
        ).first():
            raise HTTPException(status_code=409, detail="Email already exists")
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(ROLE_ADMIN)),
):
    """Soft-delete: deactivate rather than hard delete (spec §4.5)."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    user.is_active = False
    # deactivated students must not be recognized in live attendance (spec §4.5)
    from app.models.face_embedding import FaceEmbedding
    db.query(FaceEmbedding).filter(FaceEmbedding.student_id == user.id).update(
        {FaceEmbedding.is_active: False}
    )
    db.commit()
    return {"success": True}


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    """Admin sets a temporary password (spec §4.3)."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"success": True}
