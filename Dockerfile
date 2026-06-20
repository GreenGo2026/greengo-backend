# ─────────────────────────────────────────────────────────────────────────────
# GreenGo Market — Production Dockerfile
#
# Build:  docker build -t greengo-api .
# Run:    docker run --env-file .env -p 8000:8000 greengo-api
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage: runtime image ──────────────────────────────────────────────────────
FROM python:3.11-slim

# Keeps Python output unbuffered so container logs appear in real-time
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy application code ─────────────────────────────────────────────────────
# .dockerignore keeps .env, __pycache__, venv, and git artefacts out of the image.
COPY . .

# ── Expose port ───────────────────────────────────────────────────────────────
EXPOSE 8000

# ── Health-check ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" \
    || exit 1

# ── Start server ──────────────────────────────────────────────────────────────
# Railway injects $PORT at runtime — fall back to 8000 for local docker run.
# All secrets arrive via Railway env vars at container start, never at build time.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
