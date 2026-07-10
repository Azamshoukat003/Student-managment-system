from typing import Optional

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TimestampMixin


class Class(Base, TimestampMixin):
    """A class/program group, e.g. 'BSCS Semester 2' (spec §19)."""

    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    program: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    semester: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
