# FastAPI + FaceNet/MTCNN backend
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TF_CPP_MIN_LOG_LEVEL=3 \
    HF_HOME=/app/.cache \
    KERAS_HOME=/app/.cache/keras

# System libraries needed by OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Pre-download the FaceNet + MTCNN weights at build time so the first request is
# fast and works even without outbound internet at runtime.
RUN python -c "from keras_facenet import FaceNet; from mtcnn import MTCNN; FaceNet(); MTCNN()" || true

# Hosts inject $PORT (Render, etc.); Hugging Face Spaces expect 7860.
ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
