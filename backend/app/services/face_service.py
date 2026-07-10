"""Face registration and identity verification (spec §10).

Verification compares a captured face only against the logged-in student's own
stored embeddings, so one student can never mark using another's face.
"""
from sqlalchemy.orm import Session

from app.ml.embedder import cosine_similarity, extract_embedding
from app.models.face_embedding import FaceEmbedding


def register_frames(db: Session, student, frames: list[str]) -> int:
    """Replace the student's embeddings with new ones from the given frames.

    Returns the number of usable samples saved.
    """
    # Deactivate previous embeddings (re-registration replaces old face data).
    db.query(FaceEmbedding).filter(FaceEmbedding.student_id == student.id).update(
        {FaceEmbedding.is_active: False}
    )

    saved = 0
    for frame in frames:
        emb, err = extract_embedding(frame)
        if emb is None:
            continue
        db.add(FaceEmbedding(student_id=student.id, embedding=emb, is_active=True))
        saved += 1

    if saved:
        student.face_registered = True
    db.commit()
    return saved


def verify_identity(db: Session, student, frame: str, match_threshold: float, pending_threshold: float) -> dict:
    """Compare a captured face against the student's active embeddings.

    Returns dict: face_detected, confidence, matched, pending, error.
    """
    emb, err = extract_embedding(frame)
    if emb is None:
        return {"face_detected": False, "confidence": 0.0, "matched": False, "pending": False, "error": err}

    rows = (
        db.query(FaceEmbedding)
        .filter(FaceEmbedding.student_id == student.id, FaceEmbedding.is_active.is_(True))
        .all()
    )
    if not rows:
        return {
            "face_detected": True,
            "confidence": 0.0,
            "matched": False,
            "pending": False,
            "error": "No registered face found. Please register your face first.",
        }

    best = max(cosine_similarity(emb, r.embedding) for r in rows)
    return {
        "face_detected": True,
        "confidence": round(best, 3),
        "matched": best >= match_threshold,
        "pending": pending_threshold <= best < match_threshold,
        "error": None,
    }
