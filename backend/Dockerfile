# FastAPI + ONNX (YuNet + ArcFace) backend — lightweight, fits a 512 MB host.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System libraries needed by OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# App code (includes the ONNX face models under app/ml/models/)
COPY . .

# Hosts inject $PORT (Render, etc.); default 8000.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
