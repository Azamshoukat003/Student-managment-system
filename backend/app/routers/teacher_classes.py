from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models.klass import Class
from app.models.subject import Subject
from app.models.teacher_class import TeacherClass
from app.models.user import ROLE_ADMIN, ROLE_TEACHER, User
from app.schemas.teacher_class import TeacherClassCreate, TeacherClassDetail

router = APIRouter(prefix="/api/teacher-classes", tags=["teacher-classes"])


def _detail_rows(db: Session, query):
    """Join assignment rows with teacher/class/subject names for display."""
    rows = query.all()
    result = []
    for tc in rows:
        t = db.get(User, tc.teacher_id)
        c = db.get(Class, tc.class_id)
        s = db.get(Subject, tc.subject_id)
        result.append(
            TeacherClassDetail(
                id=tc.id,
                teacher_id=tc.teacher_id,
                teacher_name=t.full_name if t else "?",
                class_id=tc.class_id,
                class_name=c.name if c else "?",
                subject_id=tc.subject_id,
                subject_name=s.name if s else "?",
            )
        )
    return result


@router.get("", response_model=list[TeacherClassDetail])
def list_assignments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    teacher_id: Optional[int] = None,
):
    # Admins see all (optionally filtered); teachers see only their own.
    q = db.query(TeacherClass)
    if user.role == ROLE_TEACHER:
        q = q.filter(TeacherClass.teacher_id == user.id)
    elif user.role == ROLE_ADMIN:
        if teacher_id is not None:
            q = q.filter(TeacherClass.teacher_id == teacher_id)
    else:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return _detail_rows(db, q)


@router.post("", response_model=TeacherClassDetail, status_code=status.HTTP_201_CREATED)
def create_assignment(
    payload: TeacherClassCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    teacher = db.get(User, payload.teacher_id)
    if not teacher or teacher.role != ROLE_TEACHER:
        raise HTTPException(status_code=400, detail="teacher_id must reference a teacher")
    if not db.get(Class, payload.class_id):
        raise HTTPException(status_code=400, detail="class_id does not exist")
    subject = db.get(Subject, payload.subject_id)
    if not subject:
        raise HTTPException(status_code=400, detail="subject_id does not exist")
    if subject.class_id != payload.class_id:
        raise HTTPException(status_code=400, detail="subject does not belong to that class")

    exists = (
        db.query(TeacherClass)
        .filter(
            TeacherClass.teacher_id == payload.teacher_id,
            TeacherClass.class_id == payload.class_id,
            TeacherClass.subject_id == payload.subject_id,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Assignment already exists")

    obj = TeacherClass(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _detail_rows(db, db.query(TeacherClass).filter(TeacherClass.id == obj.id))[0]


@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(ROLE_ADMIN)),
):
    obj = db.get(TeacherClass, assignment_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(obj)
    db.commit()
    return {"success": True}
