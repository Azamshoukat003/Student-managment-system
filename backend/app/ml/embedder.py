"""Face embedding via ONNX Runtime — lightweight, no TensorFlow.

Detection: OpenCV YuNet (5-point landmarks).
Embedding: ArcFace MobileFaceNet (w600k_mbf, 512-d), aligned to the standard
112x112 template. Runs on CPU in a few ms and fits a 512 MB host.

Same public API as before: extract_embedding(frame_b64) -> (list|None, error).
"""
import base64
import os
import threading

import numpy as np

_MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
_YUNET_PATH = os.path.join(_MODELS_DIR, "face_detection_yunet_2023mar.onnx")
_ARCFACE_PATH = os.path.join(_MODELS_DIR, "w600k_mbf.onnx")

DETECTION_THRESHOLD = 0.6  # YuNet confidence

# Canonical 5-point template ArcFace was trained on (112x112).
_ARCFACE_DST = np.array(
    [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366],
     [41.5493, 92.3655], [70.7299, 92.2041]],
    dtype=np.float32,
)

_init_lock = threading.Lock()
_infer_lock = threading.Lock()
_detector = None
_session = None
_arc_input = None


def _load():
    global _detector, _session, _arc_input
    if _session is not None:
        return
    with _init_lock:
        if _session is not None:
            return
        import cv2
        import onnxruntime as ort

        det = cv2.FaceDetectorYN.create(_YUNET_PATH, "", (320, 320), DETECTION_THRESHOLD, 0.3, 5000)
        sess = ort.InferenceSession(_ARCFACE_PATH, providers=["CPUExecutionProvider"])
        _detector, _session, _arc_input = det, sess, sess.get_inputs()[0].name
        print("[ML] ONNX face models loaded (YuNet + ArcFace mbf).")


def _decode(frame_b64: str):
    import cv2

    raw = base64.b64decode(frame_b64.split(",")[-1])
    arr = np.frombuffer(raw, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def extract_embedding(frame_b64: str):
    """Return (embedding: list[float] | None, error: str | None).

    Detects the most confident face, aligns it, and embeds to a 512-d
    L2-normalised vector.
    """
    import cv2

    _load()
    img = _decode(frame_b64)
    if img is None:
        return None, "Invalid image"

    with _infer_lock:
        h, w = img.shape[:2]
        _detector.setInputSize((w, h))
        _, faces = _detector.detect(img)
        if faces is None or len(faces) == 0:
            return None, "No face detected"

        face = max(faces, key=lambda r: r[14])
        if face[14] < DETECTION_THRESHOLD:
            return None, "Face not clear enough — move closer with good lighting"

        lmk = face[4:14].reshape(5, 2).astype(np.float32)
        matrix, _ = cv2.estimateAffinePartial2D(lmk, _ARCFACE_DST, method=cv2.LMEDS)
        if matrix is None:
            return None, "Could not align the face — try again"
        aligned = cv2.warpAffine(img, matrix, (112, 112))

        blob = cv2.dnn.blobFromImage(aligned, 1.0 / 127.5, (112, 112), (127.5, 127.5, 127.5), swapRB=True)
        emb = _session.run(None, {_arc_input: blob})[0][0]

    norm = float(np.linalg.norm(emb))
    if norm == 0:
        return None, "Embedding failed"
    return (emb / norm).astype(float).tolist(), None


def cosine_similarity(a, b) -> float:
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))
