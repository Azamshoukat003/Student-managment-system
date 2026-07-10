from pydantic import BaseModel, ConfigDict


class TeacherClassCreate(BaseModel):
    teacher_id: int
    class_id: int
    subject_id: int


class TeacherClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    class_id: int
    subject_id: int


class TeacherClassDetail(BaseModel):
    """Assignment enriched with names for display."""

    id: int
    teacher_id: int
    teacher_name: str
    class_id: int
    class_name: str
    subject_id: int
    subject_name: str
