"""Import every model so Base.metadata sees all tables for create_all()."""
from app.models.user import User
from app.models.klass import Class
from app.models.subject import Subject
from app.models.teacher_class import TeacherClass
from app.models.face_embedding import FaceEmbedding
from app.models.attendance_session import AttendanceSession
from app.models.attendance_record import AttendanceRecord
from app.models.activity_log import ActivityLog

__all__ = [
    "User",
    "Class",
    "Subject",
    "TeacherClass",
    "FaceEmbedding",
    "AttendanceSession",
    "AttendanceRecord",
    "ActivityLog",
]
