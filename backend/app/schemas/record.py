from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class LocationCheckRequest(BaseModel):
    latitude: float
    longitude: float
    gps_accuracy: Optional[float] = None


class LocationCheckResponse(BaseModel):
    eligible: bool
    session_id: Optional[int] = None
    distance: Optional[float] = None
    within_radius: bool = False
    accuracy_ok: bool = False
    message: str = ""


class MarkFaceRequest(BaseModel):
    latitude: float
    longitude: float
    gps_accuracy: Optional[float] = None
    frame: str  # base64 data URL of the captured face


class MarkResponse(BaseModel):
    success: bool
    status: str
    approval_status: str
    confidence: Optional[float] = None
    distance: Optional[float] = None
    message: str


class ManualMarkRequest(BaseModel):
    session_id: int
    student_id: int
    status: str  # present | late | absent
    reason: str


class ApprovalRequest(BaseModel):
    comment: Optional[str] = None


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    student_id: int
    status: str
    method: str
    approval_status: str
    confidence_score: Optional[float] = None
    distance_from_session: Optional[float] = None
    gps_accuracy: Optional[float] = None
    reason: Optional[str] = None
    marked_by: Optional[int] = None
    marked_at: Optional[datetime] = None
    created_at: datetime


class RecordDetail(RecordOut):
    student_name: str = ""
    registration_number: Optional[str] = None
    class_name: str = ""
    subject_name: str = ""
    session_date: Optional[str] = None
