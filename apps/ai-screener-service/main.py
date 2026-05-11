from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Any, Optional

import database as db
import cache
import screener
from auth import require_roles
from models import PaginatedResponse, ScreeningResult, ScreenRequestDto

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# ─── App state ───────────────────────────────────────────────────────────────

_START = time.time()
_models_loaded = False

app = FastAPI(title="AI Screener Service", version="2.0.0")

# ─── Error helpers ────────────────────────────────────────────────────────────

_HTTP_LABELS: dict[int, str] = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
}


def _error_body(req: Request, code: int, message: str) -> dict:
    return {
        "statusCode": code,
        "error": _HTTP_LABELS.get(code, "Error"),
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "path": req.url.path,
    }


@app.exception_handler(RequestValidationError)
async def _validation_handler(req: Request, exc: RequestValidationError):
    msgs = "; ".join(f"{e['loc'][-1]}: {e['msg']}" for e in exc.errors())
    return JSONResponse(status_code=422, content=_error_body(req, 422, msgs))


@app.exception_handler(HTTPException)
async def _http_handler(req: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(req, exc.status_code, str(exc.detail)),
    )


@app.exception_handler(Exception)
async def _generic_handler(req: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=_error_body(req, 500, "An unexpected error occurred"),
    )


# ─── Startup ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def _startup():
    global _models_loaded
    db.init_pool()
    cache.init_redis()
    screener.load_models()
    _models_loaded = True
    print("AI Screener ready — models loaded, DB and Redis connected")


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/api/v1/health")
def health():
    db_ok = db.ping()
    redis_ok = cache.ping()
    return {
        "status": "ok" if (db_ok and redis_ok) else "error",
        "model_loaded": _models_loaded,
        "db_connected": db_ok,
        "redis_connected": redis_ok,
        "uptime_seconds": int(time.time() - _START),
    }


# ─── DB row → ScreeningResult ─────────────────────────────────────────────────

_SELECT_COLS = (
    "id, application_id, match_score, skills_match, missing_skills, "
    "strengths, concerns, summary, recommendation, cached, screened_at"
)


def _row_to_result(row: tuple, cols: list[str]) -> ScreeningResult:
    d = dict(zip(cols, row))
    screened_at = d["screened_at"]
    if screened_at is not None and screened_at.tzinfo is None:
        screened_at = screened_at.replace(tzinfo=timezone.utc)
    return ScreeningResult(
        id=str(d["id"]),
        applicationId=str(d["application_id"]),
        matchScore=d["match_score"],
        skillsMatch=d["skills_match"] or [],
        missingSkills=d["missing_skills"] or [],
        strengths=d["strengths"] or [],
        concerns=d["concerns"] or [],
        summary=d["summary"],
        recommendation=d["recommendation"],
        cached=bool(d["cached"]),
        screenedAt=screened_at,
    )


def _fetch_by_application_id(application_id: str) -> ScreeningResult | None:
    sql = f"SELECT {_SELECT_COLS} FROM screening_results WHERE application_id = %s::uuid"
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, (application_id,))
        cols = [desc[0] for desc in cur.description]
        row = cur.fetchone()
        cur.close()
    return _row_to_result(row, cols) if row else None


def _insert_result(application_id: str, analysis: dict, cached: bool) -> ScreeningResult:
    sql = f"""
        INSERT INTO screening_results
            (application_id, match_score, skills_match, missing_skills,
             strengths, concerns, summary, recommendation, cached)
        VALUES (%s::uuid, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s)
        RETURNING {_SELECT_COLS}
    """
    params = (
        application_id,
        analysis["matchScore"],
        json.dumps(analysis["skillsMatch"]),
        json.dumps(analysis["missingSkills"]),
        json.dumps(analysis["strengths"]),
        json.dumps(analysis["concerns"]),
        analysis["summary"],
        analysis["recommendation"],
        cached,
    )
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, params)
        cols = [desc[0] for desc in cur.description]
        row = cur.fetchone()
        cur.close()
    return _row_to_result(row, cols)


# ─── Endpoints ────────────────────────────────────────────────────────────────
# IMPORTANT: /screen/ranked/{job_id} MUST be declared before /screen/{application_id}
# so FastAPI does not match the literal string "ranked" as an applicationId.

@app.get("/api/v1/screen/ranked/{job_id}", response_model=PaginatedResponse)
def get_ranked(
    job_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    minScore: Optional[int] = Query(None, ge=0, le=100),
    recommendation: Optional[str] = Query(None),
    _user: dict = Depends(require_roles("admin", "recruiter")),
):
    offset = (page - 1) * limit
    where_clauses: list[str] = ["a.job_id = %s::uuid"]
    params: list[Any] = [job_id]

    if minScore is not None:
        where_clauses.append("sr.match_score >= %s")
        params.append(minScore)
    if recommendation:
        where_clauses.append("sr.recommendation = %s")
        params.append(recommendation)

    where_sql = " AND ".join(where_clauses)

    count_sql = f"""
        SELECT COUNT(*) FROM screening_results sr
        JOIN applications a ON a.id = sr.application_id
        WHERE {where_sql}
    """
    data_sql = f"""
        SELECT sr.id, sr.application_id, sr.match_score, sr.skills_match,
               sr.missing_skills, sr.strengths, sr.concerns, sr.summary,
               sr.recommendation, sr.cached, sr.screened_at
        FROM screening_results sr
        JOIN applications a ON a.id = sr.application_id
        WHERE {where_sql}
        ORDER BY sr.match_score DESC
        LIMIT %s OFFSET %s
    """

    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(count_sql, params)
        total: int = cur.fetchone()[0]
        cur.execute(data_sql, params + [limit, offset])
        cols = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        cur.close()

    results = [_row_to_result(row, cols) for row in rows]
    return PaginatedResponse(
        data=results,
        total=total,
        page=page,
        limit=limit,
        totalPages=(total + limit - 1) // limit,
    )


@app.post("/api/v1/screen", response_model=ScreeningResult)
def screen_resume(
    body: ScreenRequestDto,
    _user: dict = Depends(require_roles("admin", "recruiter")),
):
    # 1. DB hit — application already screened
    existing = _fetch_by_application_id(body.applicationId)
    if existing:
        return existing

    # 2. Redis hit — same resume+job content seen before
    cache_key = cache.make_key(body.resumeText, body.jobDescription)
    cached_analysis = cache.get_cached(cache_key)
    is_cached = cached_analysis is not None

    # 3. Full miss — run local ML pipeline
    analysis = cached_analysis or screener.screen_resume(body)
    if not is_cached:
        cache.set_cached(cache_key, analysis)

    return _insert_result(body.applicationId, analysis, is_cached)


@app.get("/api/v1/screen/{application_id}", response_model=ScreeningResult)
def get_result(
    application_id: str,
    _user: dict = Depends(require_roles("admin", "recruiter")),
):
    result = _fetch_by_application_id(application_id)
    if not result:
        raise HTTPException(status_code=404, detail="Screening result not found")
    return result
