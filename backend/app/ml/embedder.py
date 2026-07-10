"""Face embedding via MTCNN (detect) + FaceNet (embed).

Reuses the MVP's model stack, but produces per-face 512-d embeddings instead of
training a global classifier. Models are lazy-loaded once, thread-safely.
"""
import base64
import os
import threading

import numpy as np

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

_lock = threading.Lock()
_detector = None
_embedder = None

DETECTION_THRESHOLD = 0.90
FACE_SIZE = 160


def _load():
    global _detector, _embedder
    if _embedder is not None:
        return
    with _lock:
        if _embedder is not None:
            return
        from keras_facenet import FaceNet
        from mtcnn import MTCNN

        det = MTCNN()
        emb = FaceNet()
        _detector, _embedder = det, emb


def _decode(frame_b64: str):
    import cv2

    raw = base64.b64decode(frame_b64.split(",")[-1])
    arr = np.frombuffer(raw, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def extract_embedding(frame_b64: str):
    """Return (embedding: list[float] | None, error: str | None).

    Detects the most confident face, crops with margin, and embeds to 512-d.
    """
    import cv2

    _load()
    img_bgr = _decode(frame_b64)
    if img_bgr is None:
        return None, "Invalid image"

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    faces = _detector.detect_faces(img_rgb)
    if not faces:
        return None, "No face detected"

    fd = max(faces, key=lambda f: f["confidence"])
    if fd["confidence"] < DETECTION_THRESHOLD:
        return None, "Face not clear enough — move closer with good lighting"

    x, y, w, h = fd["box"]
    x, y = max(0, x), max(0, y)
    margin = int(0.15 * max(w, h))
    x1, y1 = max(0, x - margin), max(0, y - margin)
    x2 = min(img_rgb.shape[1], x + w + margin)
    y2 = min(img_rgb.shape[0], y + h + margin)
    face = img_rgb[y1:y2, x1:x2]
    if face.size == 0:
        return None, "Empty face crop"

    face = cv2.resize(face, (FACE_SIZE, FACE_SIZE))
    emb = _embedder.embeddings(np.expand_dims(face, 0))[0]
    return emb.astype(float).tolist(), None


def cosine_similarity(a, b) -> float:
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))
