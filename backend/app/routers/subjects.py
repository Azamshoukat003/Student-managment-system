from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.klass import Class
from app.models.subject import Subject
from app.models.user import ROLE_ADMIN, User
from app.schemas.subject import SubjectCreate, SubjectOut, SubjectUpdate

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


@router.get("", response_model=list[SubjectOut])
def list_subjects(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    class_id: Optional[int] = None,
):
    q = db.query(Subject)
    if class_id is not None:
        q = q.filter(Subject.class_id == class_id)
    return q.order_by(Subject.name).all()


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    if not db.get(Class, payload.class_id):
        raise HTTPException(status_code=400, detail="class_id does not exist")
    obj = Subject(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    obj = db.get(Subject, subject_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Subject not found")
    data = payload.model_dump(exclude_unset=True)
    if "class_id" in data and not db.get(Class, data["class_id"]):
        raise HTTPException(status_code=400, detail="class_id does not exist")
    for field, value in data.items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{subject_id}")
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    obj = db.get(Subject, subject_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(obj)
    db.commit()
    return {"success": True}
