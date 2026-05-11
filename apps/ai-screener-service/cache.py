from __future__ import annotations

import hashlib
import json
import os

import redis as redis_lib

_REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
_TTL: int = int(os.environ.get("REDIS_TTL", "3600"))
_client: redis_lib.Redis | None = None


def init_redis() -> None:
    global _client
    _client = redis_lib.from_url(_REDIS_URL, decode_responses=True)


def ping() -> bool:
    try:
        _client.ping()
        return True
    except Exception:
        return False


def make_key(resume_text: str, job_description: str) -> str:
    digest = hashlib.md5((resume_text + job_description).encode()).hexdigest()
    return f"screen:{digest}"


def get_cached(key: str) -> dict | None:
    try:
        val = _client.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def set_cached(key: str, value: dict) -> None:
    try:
        _client.setex(key, _TTL, json.dumps(value))
    except Exception:
        pass
