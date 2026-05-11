FROM python:3.11-slim

WORKDIR /app

# ─── System dependencies ─────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# ─── Python dependencies ─────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Bake ML models into the image so the first request is fast ──────────────
# sentence-transformers and HuggingFace caches land in /app/model_cache,
# which will be chowned to the non-root user below.
ENV SENTENCE_TRANSFORMERS_HOME=/app/model_cache
ENV HF_HOME=/app/model_cache
ENV TRANSFORMERS_CACHE=/app/model_cache

RUN python -m spacy download en_core_web_md
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# ─── Application code ────────────────────────────────────────────────────────
COPY main.py screener.py models.py database.py cache.py auth.py ./

# ─── Non-root user ───────────────────────────────────────────────────────────
RUN groupadd --system appgroup \
    && useradd --system --gid appgroup --no-create-home appuser \
    && chown -R appuser:appgroup /app

USER appuser

# ─── Runtime ─────────────────────────────────────────────────────────────────
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3003/api/v1/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3003", "--workers", "1"]
