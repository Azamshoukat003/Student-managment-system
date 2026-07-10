from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.klass import Class
from app.models.user import ROLE_ADMIN, ROLE_STUDENT, ROLE_TEACHER, User
from app.schemas.klass import ClassCreate, ClassOut, ClassUpdate
from app.schemas.user import UserOut

router = APIRouter(prefix="/api/classes", tags=["classes"])


@router.get("/{class_id}/students", response_model=list[UserOut])
def class_students(
    class_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_TEACHER, ROLE_ADMIN)),
):
    """Active students in a class — used by teachers for manual attendance."""
    return (
        db.query(User)
        .filter(User.role == ROLE_STUDENT, User.class_id == class_id, User.is_active.is_(True))
        .order_by(User.full_name)
        .all()
    )


@router.get("", response_model=list[ClassOut])
def list_classes(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    # readable by any logged-in user (needed by teachers/forms); edits are admin-only
    return db.query(Class).order_by(Class.name).all()


@router.post("", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
def create_class(
    payload: ClassCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    obj = Class(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{class_id}", response_model=ClassOut)
def update_class(
    class_id: int,
    payload: ClassUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    obj = db.get(Class, class_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Class not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{class_id}")
def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    obj = db.get(Class, class_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Class not found")
    db.delete(obj)
    db.commit()
    return {"success": True}
