from typing import Optional

from pydantic import BaseModel, ConfigDict


class ClassCreate(BaseModel):
    name: str
    program: Optional[str] = None
    semester: Optional[int] = None


class ClassUpdate(BaseModel):
    name: Optional[str] = None
    program: Optional[str] = None
    semester: Optional[int] = None


class ClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    program: Optional[str] = None
    semester: Optional[int] = None
