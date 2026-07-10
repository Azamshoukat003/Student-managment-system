from typing import Optional

from pydantic import BaseModel, ConfigDict


class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    class_id: int


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    class_id: Optional[int] = None


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: Optional[str] = None
    class_id: int
