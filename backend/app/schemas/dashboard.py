from typing import Optional

from pydantic import BaseModel


class StatusSummary(BaseModel):
    present: int = 0
    late: int = 0
    absent: int = 0
    pending: int = 0


class AdminDashboard(BaseModel):
    role: str = "admin"
    total_students: int
    total_teachers: int
    total_classes: int
    total_subjects: int
    total_sessions: int
    today_attendance_count: int
    today_summary: StatusSummary


class TeacherDashboard(BaseModel):
    role: str = "teacher"
    assigned_classes: int
    today_sessions: int
    open_sessions: int
    today_summary: StatusSummary


class StudentDashboard(BaseModel):
    role: str = "student"
    attendance_percentage: float
    present: int
    late: int
    absent: int
    total_marked: int
    face_registered: bool
