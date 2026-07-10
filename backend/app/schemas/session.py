from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, model_validator


class SessionCreate(BaseModel):
    class_id: int
    subject_id: int
    session_date: date
    start_time: time
    end_time: time
    late_cutoff_time: Optional[time] = None
    latitude: float
    longitude: float
    allowed_radius_meters: int = 100

    @model_validator(mode="after")
    def check_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        if self.late_cutoff_time and self.late_cutoff_time < self.end_time:
            raise ValueError("late_cutoff_time cannot be before end_time")
        if self.allowed_radius_meters <= 0:
            raise ValueError("allowed_radius_meters must be positive")
        return self


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    class_id: int
    subject_id: int
    session_date: date
    start_time: time
    end_time: time
    late_cutoff_time: Optional[time] = None
    latitude: float
    longitude: float
    allowed_radius_meters: int
    status: str
    created_at: datetime


class SessionDetail(SessionOut):
    """Session enriched with display names + live window state."""

    class_name: str = ""
    subject_name: str = ""
    teacher_name: str = ""
    window_state: str = ""
    marked_count: int = 0


class ActiveSessionResponse(BaseModel):
    session: Optional[SessionDetail] = None
    already_marked: bool = False
    message: str = ""
