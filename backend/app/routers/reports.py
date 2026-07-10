import csv
import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.record import RecordDetail
from app.services.reports import CSV_HEADER, query_records, to_csv_row, to_detail

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _filters(
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    student_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    return dict(
        class_id=class_id,
        subject_id=subject_id,
        student_id=student_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/attendance", response_model=list[RecordDetail])
def attendance_report(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    filters: dict = Depends(_filters),
):
    rows = query_records(db, user, limit=2000, **filters)
    return [to_detail(r) for r in rows]


@router.get("/attendance/export")
def export_attendance_csv(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    filters: dict = Depends(_filters),
):
    """CSV export of attendance, scoped by role and filtered (spec §16, §25)."""
    rows = query_records(db, user, limit=100000, **filters)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_HEADER)
    for r in rows:
        writer.writerow(to_csv_row(r))
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_report.csv"},
    )
