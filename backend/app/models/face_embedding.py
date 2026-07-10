from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base
from app.models.mixins import TimestampMixin


class FaceEmbedding(Base, TimestampMixin):
    """A stored 512-d FaceNet embedding for a student (spec §19, §10).

    We compare a captured face only against the logged-in student's embeddings,
    so no global classifier / retrain is needed.
    """

    __tablename__ = "face_embeddings"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    embedding: Mapped[list] = mapped_column(JSON, nullable=False)  # list[float], length 512
    image_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
