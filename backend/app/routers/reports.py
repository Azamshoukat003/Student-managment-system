import csv
import io

from flask import Blueprint, Response, g

from app.core.deps import require_auth
from app.services.reports import CSV_HEADER, query_records, to_csv_row, to_detail
from app.web import dump, q_date, q_int, q_str

bp = Blueprint("reports", __name__, url_prefix="/api/reports")


def _filters():
    return dict(
        class_id=q_int("class_id"),
        subject_id=q_int("subject_id"),
        student_id=q_int("student_id"),
        status=q_str("status"),
        date_from=q_date("date_from"),
        date_to=q_date("date_to"),
    )


@bp.get("/attendance")
@require_auth
def attendance_report():
    rows = query_records(g.db, g.user, limit=2000, **_filters())
    return [dump(to_detail(r)) for r in rows]


@bp.get("/attendance/export")
@require_auth
def export_attendance_csv():
    """CSV export of attendance, scoped by role and filtered (spec §16, §25)."""
    rows = query_records(g.db, g.user, limit=100000, **_filters())

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_HEADER)
    for r in rows:
        writer.writerow(to_csv_row(r))
    buf.seek(0)

    return Response(
        buf.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_report.csv"},
    )
