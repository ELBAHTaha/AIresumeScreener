# AI Resume Screener

> A production-grade AI-powered resume screening platform built with NestJS microservices, a Python FastAPI ML pipeline, PostgreSQL, Redis, MinIO, and Docker.

---

## Architecture

```
                    ┌──────────────────────────┐
                    │      Next.js Frontend     │
                    │         :3004             │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │       API Gateway         │
                    │      NestJS :3000         │
                    │  Rate-limit · Logging     │
                    └──┬──────────┬────────┬───┘
                       │          │        │
          ┌────────────┘   ┌──────┘   ┌───┘
          │                │          │
  ┌───────▼──────┐  ┌──────▼──────┐  ┌──────▼──────────────┐
  │ Auth Service │  │ Job Service │  │  AI Screener Service │
  │ NestJS :3001 │  │ NestJS :3002│  │  Python FastAPI :3003│
  │  JWT · RBAC  │  │ CRUD · MinIO│  │ spacy · embeddings   │
  └──────────────┘  └─────────────┘  └─────────────────────┘
          │                │                    │
          └────────────────┼────────────────────┘
                           │
             ┌─────────────┴──────────────┐
             │                            │
      ┌──────▼──────┐             ┌───────▼──────┐
      │  PostgreSQL  │             │    Redis 7   │
      │  (shared DB) │             │ (cache +     │
      └─────────────┘             │  throttle)   │
                                  └──────────────┘
                    ┌─────────────────────────────┐
                    │           MinIO              │
                    │  S3-compatible storage :9000 │
                    │  Console UI          :9001   │
                    └─────────────────────────────┘
```

### Services at a glance

| Container          | Port      | Responsibility                                       |
|--------------------|-----------|------------------------------------------------------|
| `ars_postgres`     | 5432      | Shared PostgreSQL 16                                 |
| `ars_redis`        | 6379      | Redis 7 — AI result cache + throttle counters        |
| `ars_minio`        | 9000/9001 | MinIO S3-compatible object storage for PDF resumes   |
| `ars_auth`         | 3001      | JWT registration/login, RBAC, token verification     |
| `ars_job`          | 3002      | Job CRUD, applications, resume upload + text extract |
| `ars_ai`           | 3003      | Local ML screening, Redis cache, email notifications |
| `ars_gateway`      | 3000      | API Gateway — rate limiting, logging, HTTP proxy     |
| `ars_frontend`     | 3004      | Next.js 14 App Router frontend                       |

---

## Key Features

| Feature | Details |
|---|---|
| AI Screening | Local ML pipeline: spacy NER + sentence-transformer embeddings + cosine similarity. 0–100 match score, skills gap analysis, recommendation |
| PDF Text Extraction | Resume text extracted from PDF at upload time (pdf-parse); stored in DB so screener always has full CV content |
| Redis Caching | Identical resume+job content hashed and cached for 1 hr; cached hits respond in < 30ms |
| JWT + RBAC | Three roles: `admin`, `recruiter`, `candidate`; enforced at route level on every service |
| Rate Limiting | Global 10 req/60s; `POST /screen` restricted to 3 req/60s; backed by Redis |
| Resume Storage | PDF uploads forwarded by gateway as multipart → job-service → MinIO (`resumes/{jobId}/{candidateId}/{uuid}.pdf`) |
| Email Notifications | Optional SMTP notification to recruiter after each screening completes |
| Health Checks | `GET /api/v1/health` on every service: DB ping, Redis ping, uptime |
| Structured Logging | Winston JSON in production; colorized console in development |
| Global Error Handling | Consistent `{ statusCode, error, message, timestamp, path }` shape across all services |
| Ranked Pagination | `GET /screen/ranked/:jobId?page=&limit=&minScore=&recommendation=` |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker | 24.x+ | Docker Desktop or Docker Engine |
| Docker Compose | 2.x (V2) | `docker compose` (not `docker-compose`) |

No external API keys or cloud accounts are required. Everything runs locally via Docker.

---

## Environment Variables

Copy `.env.example` to `.env`. Most defaults work out of the box for local development.

| Variable | Service(s) | Required | Description |
|---|---|---|---|
| `POSTGRES_USER` | compose | yes | PostgreSQL username (default `ars_user`) |
| `POSTGRES_PASSWORD` | compose | yes | PostgreSQL password (default `ars_password`) |
| `POSTGRES_DB` | compose | yes | Database name (default `ars_db`) |
| `JWT_SECRET` | auth, job, ai, gateway | yes | HS256 signing secret — must be identical across all services (≥ 32 chars) |
| `JWT_EXPIRES_IN` | auth | no | Token lifetime (default `7d`) |
| `MINIO_ACCESS_KEY` | job, compose | yes | MinIO root user (default `minio`) |
| `MINIO_SECRET_KEY` | job, compose | yes | MinIO root password (default `minio123456`) |
| `MINIO_BUCKET` | job, compose | no | Bucket name (default `ars-resumes`) |
| `MINIO_PUBLIC_URL` | job | no | Public base URL for resume links (default `http://localhost:9000`) |
| `REDIS_URL` | ai, gateway | no | Redis connection string (default `redis://localhost:6379`) |
| `REDIS_TTL` | ai | no | Screening result cache TTL in seconds (default `3600`) |
| `THROTTLE_TTL` | gateway | no | Rate-limit window in **seconds** (default `60`) |
| `THROTTLE_LIMIT` | gateway | no | Max requests per window (default `10`) |
| `LOG_LEVEL` | all | no | `error \| warn \| info \| debug` (default `info`) |
| `SMTP_HOST` | ai | no | SMTP server — email notify is skipped if unset |
| `SMTP_PORT` | ai | no | SMTP port (default `587`) |
| `SMTP_USER` | ai | no | SMTP username / sender address |
| `SMTP_PASS` | ai | no | SMTP password or app password |

> **Note:** `THROTTLE_TTL` uses **seconds** (not milliseconds). `@nestjs/throttler` v5 changed the unit — setting `60000` would create a 16.7-hour window.

---

## Running the Project

### Start everything

```bash
git clone https://github.com/ELBAHTaha/AIresumeScreener
cd ai-resume-screener
cp .env.example .env        # defaults work for local dev
docker compose up --build -d
```

Services start in dependency order: PostgreSQL → Redis → MinIO → auth/job/ai → gateway → frontend.  
The AI screener takes ~90 s on first start to load ML models (spacy + sentence-transformers). Wait for all health checks to pass:

```bash
docker compose ps          # all services should show "(healthy)"
```

### Verify health

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","upstreams":{...},"uptime":N}
```

### Stop

```bash
docker compose down          # keep volumes (data persists)
docker compose down -v       # wipe volumes (fresh DB + MinIO on next start)
```

### Rebuild a single service

```bash
docker compose up --build -d job-service
```

### View logs

```bash
docker compose logs -f api-gateway
docker compose logs -f ai-screener-service
```

### Access UIs

| URL | Description |
|---|---|
| http://localhost:3004 | Next.js frontend |
| http://localhost:3000/api/docs | Swagger — API Gateway |
| http://localhost:3001/api/docs | Swagger — Auth Service |
| http://localhost:3002/api/docs | Swagger — Job Service |
| http://localhost:3003/api/docs | Swagger — AI Screener |
| http://localhost:9001 | MinIO Console (bucket browser) |

Default MinIO credentials: `minio` / `minio123456`  
Seed admin account: `admin@ars.dev` / `Admin@123`

---

## API Endpoints

All routes go through the gateway at `http://localhost:3000/api/v1/`.

### Auth

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register with `{ email, password, firstName, lastName, role }` |
| POST | `/auth/login` | — | Login — returns `{ accessToken, user }` |
| GET | `/auth/profile` | any | Current user profile (requires Bearer token) |

### Jobs

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/jobs[?status=]` | any | List jobs (default: active; filter by `active\|draft\|closed`) |
| GET | `/jobs/:id` | any | Job details |
| POST | `/jobs` | recruiter/admin | Create a job posting |
| PATCH | `/jobs/:id` | recruiter (own) / admin | Update a job |
| DELETE | `/jobs/:id` | recruiter (own) / admin | Delete a job |

### Applications

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/jobs/:jobId/apply` | candidate | Upload PDF resume (`multipart/form-data` with `resume` field + optional `coverLetter`) |
| GET | `/jobs/:jobId/applications` | recruiter/admin | List all applications for a job |

### AI Screening

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/screen` | recruiter/admin | Screen a resume — rate-limited to 3 req/60s |
| GET | `/screen/:applicationId` | recruiter/admin | Get screening result for an application |
| GET | `/screen/ranked/:jobId` | recruiter/admin | Paginated ranked candidates (`?page=&limit=&minScore=&recommendation=`) |

---

## API Examples

### Register + login

```bash
# Register as recruiter
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"Pass@1234","firstName":"Jane","lastName":"Smith","role":"recruiter"}'

# Login — copy accessToken
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"Pass@1234"}'

export TOKEN="<your_access_token>"
```

### Create a job + apply

```bash
# Create a job (recruiter)
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Senior Backend Engineer","description":"Build scalable APIs","requirements":"5+ years Node.js, PostgreSQL, Docker","company":"Acme Corp","jobType":"remote","status":"active"}'

export JOB_ID="<job-uuid>"

# Apply as candidate (PDF upload)
export CANDIDATE_TOKEN="<candidate_jwt>"
curl -X POST http://localhost:3000/api/v1/jobs/$JOB_ID/apply \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -F "resume=@/path/to/resume.pdf" \
  -F "coverLetter=I am excited to apply..."
```

### Screen a resume

```bash
# applicationId comes from the apply response or GET /jobs/:jobId/applications
curl -X POST http://localhost:3000/api/v1/screen \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<application-uuid>",
    "jobTitle": "Senior Backend Engineer",
    "jobDescription": "Build scalable APIs for millions of users",
    "jobRequirements": "5+ years Node.js, PostgreSQL, Docker, REST APIs"
  }'
```

> `resumeText` is optional — if omitted or empty, the screener uses the text extracted from the uploaded PDF automatically.

**Response:**
```json
{
  "id": "uuid",
  "applicationId": "uuid",
  "matchScore": 87,
  "recommendation": "yes",
  "skillsMatch": ["Node.js", "PostgreSQL", "Docker"],
  "missingSkills": ["REST"],
  "strengths": ["Proficient in Node.js", "Proficient in PostgreSQL", "Proficient in Docker"],
  "concerns": ["Missing required skill: REST"],
  "summary": "Candidate matches 3 of 4 required skills with a semantic similarity score of 91/100. Recommended for interview with minor gaps in REST.",
  "cached": false,
  "screenedAt": "2026-05-13T10:00:00Z"
}
```

### Get ranked candidates

```bash
curl "http://localhost:3000/api/v1/screen/ranked/$JOB_ID?page=1&limit=10&minScore=70" \
  -H "Authorization: Bearer $TOKEN"
```

---

## How AI Screening Works

The screener uses a fully local ML pipeline — no external API calls, no usage costs.

1. **Skill extraction** — spacy (`en_core_web_md`) and a curated vocabulary of ~60 tech skills scan both the resume and job requirements for known skill tokens (case-insensitive).
2. **Semantic similarity** — `sentence-transformers` (`all-MiniLM-L6-v2`) encodes resume text and job description into embeddings; cosine similarity gives a 0–100 semantic score.
3. **Match score** — `score = 0.6 × semantic + 0.4 × skill_coverage`, clamped to [0, 100].
4. **Recommendation** — `strong_yes` (≥ 90), `yes` (≥ 70), `maybe` (≥ 50), `no` (< 50).
5. **Caching** — result stored in PostgreSQL; Redis caches by `sha256(resumeText + jobDescription)` for 1 hr so identical pairs skip recomputation.

For best results, make sure:
- The job `requirements` field lists specific skills (e.g. `"Node.js, PostgreSQL, Docker"`)
- Candidates upload a text-selectable PDF (not a scanned image)

---

## Roles

| Role | Can do |
|---|---|
| `candidate` | View jobs, apply to jobs |
| `recruiter` | All candidate actions + create/edit/delete own jobs, view own job applications, trigger AI screening |
| `admin` | All recruiter actions + manage any job or application |

---

## Project Structure

```
ai-resume-screener/
├── apps/
│   ├── api-gateway/          Rate limiting · logging · HTTP proxy
│   │   └── src/
│   │       ├── gateway.controller.ts   Route definitions + multipart proxy
│   │       ├── gateway.service.ts      proxy() + proxyUpload() methods
│   │       ├── health/                 GET /health — @SkipThrottle()
│   │       ├── middleware/             LoggingMiddleware
│   │       ├── filters/               HttpExceptionFilter
│   │       └── throttler/             RedisThrottlerStorage (ioredis)
│   ├── auth-service/         JWT auth · user registration · RBAC
│   │   └── src/
│   │       ├── auth/                   Register · login · verify · profile
│   │       └── users/                  User entity (TypeORM)
│   ├── job-service/          Job CRUD · applications · MinIO uploads · PDF extraction
│   │   └── src/
│   │       ├── entities/               Job · Application (TypeORM)
│   │       └── jobs/                   Controller · service · DTOs
│   └── ai-screener-service/  Python FastAPI · local ML · Redis cache · email
│       ├── main.py                     FastAPI app, endpoints, startup
│       ├── screener.py                 ML pipeline: spacy + sentence-transformers
│       ├── cache.py                    Redis get/set helpers
│       ├── database.py                 psycopg2 connection pool
│       ├── auth.py                     JWT verification + role guard
│       └── models.py                   Pydantic schemas
├── apps/frontend/            Next.js 14 App Router + Tailwind CSS v4
│   ├── app/
│   │   ├── login/ · register/          Auth pages
│   │   ├── dashboard/                  Role-based home
│   │   ├── jobs/                       List · detail · new · edit
│   │   ├── jobs/[id]/applications/     Application management + AI screen trigger
│   │   ├── jobs/[id]/ranked/           AI-ranked candidates view
│   │   └── screen/[applicationId]/    Full screening report
│   ├── components/
│   │   ├── AuthContext.tsx             Auth state (user, token, login, logout)
│   │   ├── AppShell.tsx               AuthProvider + Navbar wrapper
│   │   └── Navbar.tsx                 Nav with role badge
│   └── lib/
│       ├── api.ts                      Typed fetch wrapper — all API calls
│       └── auth.ts                     Token/user localStorage helpers
├── docker/
│   └── init.sql              PostgreSQL schema + indexes + seed admin user
├── docker-compose.yml
├── .env.example
└── CLAUDE.md                 Developer notes and gotchas
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `dependency failed to start: ars_minio is unhealthy` | MinIO slow to start | Increase `start_period` or wait and re-run `docker compose up -d` |
| `dependency failed to start: ars_ai is unhealthy` | ML models still loading (takes ~90s) | Wait — `start_period: 90s` is set; check logs with `docker compose logs ai-screener-service` |
| Gateway returns 429 on all requests | Throttle counter stuck in Redis | `docker exec ars_redis redis-cli FLUSHALL && docker compose restart api-gateway` |
| `invalid signature` on JWT | `JWT_SECRET` mismatch between services | Ensure one `JWT_SECRET` in `.env`; all services share it via `docker-compose.yml` |
| Resume upload fails (400) | Gateway not forwarding multipart correctly | Gateway uses `FileInterceptor` + `proxyUpload()` — ensure you're on the latest image |
| AI score is 0 for a matching resume | PDF text not extracted (scanned image PDF) | Use a text-selectable PDF; check `resume_text` column is populated after upload |
| Frontend shows blank page | `NEXT_PUBLIC_API_URL` not set at build time | Rebuild frontend image: `docker compose up --build -d frontend` |
| DB password auth failed | Stale volume with different credentials | `docker compose down -v && docker compose up --build` |
| `useSearchParams` prerender error | Missing `<Suspense>` boundary in Next.js App Router | Wrap any component calling `useSearchParams()` in `<Suspense>` |

---

## Architecture Decision Records

### Why local ML instead of Claude API?

The screener uses spacy + sentence-transformers running entirely inside the Docker container. This means zero per-call cost, no API key requirement, sub-second inference after model warm-up, and full offline capability. The trade-off is that the image is larger (~2 GB with models baked in) and nuanced reasoning (e.g. interpreting career context) is weaker than a large language model. For a high-volume screening tool where cost matters, local ML is the right default.

### Why MinIO instead of AWS S3?

MinIO provides a fully S3-compatible API locally, so the job-service uses the standard `@aws-sdk/client-s3` with `forcePathStyle: true` and an `endpoint` override — zero code changes needed to swap in real S3. This keeps the development environment self-contained with no cloud account required.

### Why shared PostgreSQL for all services?

True microservices use one database per service. Here a shared DB is an intentional pragmatic choice: it avoids running three separate PostgreSQL instances, keeps the Docker Compose footprint small, and lets the AI screener JOIN through `applications` to resolve `job_id` without cross-service HTTP calls. If services grow independently, extract to separate schemas or separate databases per service.

### Why UUID primary keys?

Row IDs are exposed in API responses and MinIO keys. UUIDs prevent enumeration attacks, distribute well across a partitioned DB, and are generated in application code without a DB round-trip.

### Why JSONB for skill arrays?

`skillsMatch`, `missingSkills`, `strengths`, and `concerns` are arrays of arbitrary strings. JSONB stores them natively and supports GIN indexing for future `@>` queries. Separate junction tables would be over-engineered for this data size and query pattern.
