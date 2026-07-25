from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, model_validator

from app.models.user import ROLE_STUDENT, ROLE_TEACHER, ROLES


class UserCreate(BaseModel):
    """Admin creates a student or teacher (spec §4.2)."""

    full_name: str
    email: EmailStr
    password: str
    role: str
    # student
    registration_number: Optional[str] = None
    class_id: Optional[int] = None
    semester: Optional[int] = None
    father_name: Optional[str] = None
    program: Optional[str] = None
    section: Optional[str] = None
    address: Optional[str] = None
    # teacher
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True

    @model_validator(mode="after")
    def check_role_fields(self):
        if self.role not in (ROLE_STUDENT, ROLE_TEACHER):
            raise ValueError("role must be 'student' or 'teacher'")
        if self.role == ROLE_STUDENT and not self.registration_number:
            raise ValueError("registration_number is required for students")
        return self


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    class_id: Optional[int] = None
    semester: Optional[int] = None
    father_name: Optional[str] = None
    program: Optional[str] = None
    section: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class ProfileUpdate(BaseModel):
    """Self-service profile edit (spec §4.4)."""

    full_name: Optional[str] = None
    phone: Optional[str] = None
    profile_image: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    """Admin sets a temporary password (spec §4.3)."""

    new_password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str  # plain str on output: already validated on input, and tolerates internal domains
    role: str
    registration_number: Optional[str] = None
    department: Optional[str] = None
    class_id: Optional[int] = None
    semester: Optional[int] = None
    # SRS student-record fields (docs §3.3 ERD: Student entity)
    father_name: Optional[str] = None
    program: Optional[str] = None
    section: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    profile_image: Optional[str] = None
    is_active: bool
    face_registered: bool
    created_at: datetime
