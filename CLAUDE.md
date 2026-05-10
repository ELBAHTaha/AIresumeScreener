# CLAUDE.md — AI Resume Screener

## Project Overview

NestJS microservices monorepo for AI-powered resume screening. Uses Claude AI (Anthropic) to score and rank candidates against job postings. Full-stack: 4 NestJS backends + Next.js frontend, all containerized via Docker Compose.

---

## Architecture

```
Frontend (Next.js :3004)
        │
        ▼
  API Gateway (:3000)   ← single entry point for all clients
  ├── rate limiting (Redis-backed ThrottlerGuard)
  ├── request logging (Winston middleware)
  └── HTTP proxy to upstream services
        │
  ┌─────┼──────┐
  ▼     ▼      ▼
Auth  Job    AI Screener
:3001 :3002  :3003
  │     │      │
  └─────┴──────┘
         │
    PostgreSQL :5432 (shared DB — all services same instance)
    Redis      :6379 (AI result cache + rate-limit counters)
```

### Services at a glance

| Container         | Port | Responsibility                                      |
|-------------------|------|-----------------------------------------------------|
| `ars_postgres`    | 5432 | Shared PostgreSQL 16                                |
| `ars_redis`       | 6379 | Redis 7 — AI cache + throttle storage               |
| `ars_auth`        | 3001 | JWT registration/login, RBAC, token verification   |
| `ars_job`         | 3002 | Job CRUD, applications, S3 resume uploads           |
| `ars_ai`          | 3003 | Claude AI screening, Redis cache, email notify      |
| `ars_gateway`     | 3000 | API Gateway — rate limit, logging, proxy            |
| `ars_frontend`    | 3004 | Next.js 14 App Router frontend                      |

---

## Running the Project

### Start everything (Docker)

```bash
docker compose up --build -d
```

Services start in dependency order (Postgres → Redis → auth/job/ai → gateway → frontend). Wait ~30 s for all health checks to pass.

### Check health

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","upstreams":{...},"uptime":N}
```

### Stop

```bash
docker compose down          # keep volumes (data persists)
docker compose down -v       # wipe volumes (fresh DB on next start)
```

### Rebuild a single service

```bash
docker compose up --build -d api-gateway
```

### View logs

```bash
docker compose logs -f api-gateway
docker compose logs -f ai-screener-service
```

### Access UIs

| URL                              | Description              |
|----------------------------------|--------------------------|
| http://localhost:3004            | Next.js frontend         |
| http://localhost:3000/api/docs   | Swagger (gateway)        |
| http://localhost:3001/api/docs   | Swagger (auth)           |
| http://localhost:3002/api/docs   | Swagger (job)            |
| http://localhost:3003/api/docs   | Swagger (ai-screener)    |

---

## Environment Variables (.env)

Copy `.env.example` → `.env`. Key variables:

| Variable              | Used by           | Notes                                              |
|-----------------------|-------------------|----------------------------------------------------|
| `JWT_SECRET`          | all services      | Must be ≥ 32 chars; identical across all services  |
| `ANTHROPIC_API_KEY`   | ai-screener       | Get from console.anthropic.com; AI screening fails without it |
| `AWS_ACCESS_KEY_ID`   | job-service       | IAM user with `s3:PutObject` on the S3 bucket      |
| `AWS_SECRET_ACCESS_KEY` | job-service     | Pair with above                                    |
| `AWS_S3_BUCKET`       | job-service       | Bucket must already exist                          |
| `THROTTLE_TTL`        | api-gateway       | **Seconds** (not ms) — `@nestjs/throttler` v5 uses seconds |
| `THROTTLE_LIMIT`      | api-gateway       | Max requests per TTL window                        |
| `SMTP_USER/SMTP_PASS` | ai-screener       | Optional — email notify after screening; service runs without it |

---

## Critical Gotchas / Known Issues

### 1. `@nestjs/throttler` v5 — TTL is in SECONDS, not milliseconds

The gateway `app.module.ts` reads `THROTTLE_TTL` and passes it to `ThrottlerModule`. v5 changed the unit to **seconds**. The `.env` default is `THROTTLE_TTL=60` (60 seconds). Setting it to `60000` would create a 16.7-hour window and lock out all traffic after 10 requests.

If the gateway ever returns 429 on the health endpoint, flush Redis and restart:
```bash
docker exec ars_redis redis-cli FLUSHALL
docker compose restart api-gateway
```

### 2. Health endpoint must skip throttle

`apps/api-gateway/src/health/health.controller.ts` has `@SkipThrottle()` on the class. Docker health checks hit `GET /api/v1/health` every 30 s — without this decorator those checks would consume rate-limit quota and eventually 429 themselves, causing the container to go unhealthy.

### 3. `NEXT_PUBLIC_API_URL` is baked in at build time

Next.js bakes `NEXT_PUBLIC_*` variables into the client bundle at `next build`. If you change the gateway URL after building the frontend image, you must rebuild the image. The `.env.local` file sets `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1` for local dev.

### 4. Shared PostgreSQL — one DB for all services

This is intentional (see README Architecture Decision Records). The AI screener queries `applications` by `applicationId` which lives in the job-service schema. Cross-service data access goes directly through the shared DB, not via HTTP.

### 5. AI screening requires a real `ANTHROPIC_API_KEY`

Without the key, `POST /screen` returns a 500 from ai-screener-service. The rest of the app (auth, jobs, applications) works normally with placeholder credentials.

---

## Project Structure

```
ai-resume-screener/
├── apps/
│   ├── api-gateway/          Rate limiting · logging · HTTP proxy to upstreams
│   │   └── src/
│   │       ├── gateway.controller.ts   Proxy logic — forwards to auth/job/ai
│   │       ├── throttler/              RedisThrottlerStorage (ioredis)
│   │       ├── health/                 GET /health — @SkipThrottle()
│   │       ├── middleware/             LoggingMiddleware (method/path/status/ms)
│   │       └── filters/               HttpExceptionFilter
│   ├── auth-service/         JWT auth · user registration · RBAC
│   │   └── src/
│   │       ├── auth/                   Register · login · verify · profile
│   │       └── users/                  User entity (TypeORM)
│   ├── job-service/          Job CRUD · applications · S3 resume uploads
│   │   └── src/
│   │       ├── entities/               Job · Application (TypeORM)
│   │       └── jobs/                   Controller · service · DTOs
│   ├── ai-screener-service/  Claude AI · Redis cache · events · email
│   │   └── src/
│   │       ├── ai-screener.service.ts  Core: Claude call, Redis hash cache
│   │       ├── entities/               ScreeningResult (TypeORM, JSONB arrays)
│   │       ├── dto/                    ScreenRequestDto · RankingQueryDto
│   │       └── events/                 Email notification after screening
│   └── frontend/             Next.js 14 App Router + Tailwind CSS v4
│       ├── app/                        Pages (all client components)
│       │   ├── login/ · register/      Auth pages
│       │   ├── dashboard/              Role-based home
│       │   ├── jobs/                   List · detail · new · edit
│       │   ├── jobs/[id]/applications/ Application management
│       │   ├── jobs/[id]/ranked/       AI-ranked candidates
│       │   └── screen/[applicationId]/ Full screening report
│       ├── components/
│       │   ├── AuthContext.tsx          Auth state (user, token, login, logout)
│       │   ├── AppShell.tsx            AuthProvider + Navbar wrapper
│       │   └── Navbar.tsx              Nav with role badge
│       └── lib/
│           ├── api.ts                  Typed fetch wrapper — all API calls
│           └── auth.ts                 Token/user localStorage helpers
├── docker/
│   └── init.sql              PostgreSQL schema + indexes + seed admin user
├── docker-compose.yml
├── .env                      Local secrets (gitignored)
└── .env.example
```

---

## API Endpoints

All routes go through the gateway at `http://localhost:3000/api/v1/`.

### Auth (`/auth`)
- `POST /auth/register` — `{ email, password, firstName, lastName, role }` → `{ accessToken, user }`
- `POST /auth/login` — `{ email, password }` → `{ accessToken, user }`
- `GET /auth/profile` — requires Bearer token

### Jobs (`/jobs`)
- `GET /jobs[?status=active|draft|closed]` — all roles
- `GET /jobs/:id` — all roles
- `POST /jobs` — recruiter/admin only
- `PATCH /jobs/:id` — recruiter (own jobs only) / admin
- `DELETE /jobs/:id` — recruiter (own jobs only) / admin

### Applications (`/jobs/:jobId/apply`)
- `POST /jobs/:jobId/apply` — candidate only; `multipart/form-data` with `resume` (PDF, max 10 MB) + optional `coverLetter`
- `GET /jobs/:jobId/applications` — recruiter/admin only

### AI Screening (`/screen`)
- `POST /screen` — recruiter/admin; body: `{ applicationId, jobTitle, jobDescription, jobRequirements, resumeText }`
- `GET /screen/:applicationId` — recruiter/admin
- `GET /screen/ranked/:jobId[?page=&limit=&minScore=&recommendation=]` — recruiter/admin

---

## Roles

| Role        | Can do                                                       |
|-------------|--------------------------------------------------------------|
| `candidate` | View jobs, apply to jobs                                     |
| `recruiter` | All candidate actions + create/edit/delete own jobs, view own job applications, trigger AI screening |
| `admin`     | All recruiter actions + manage any job                       |

A seed admin user is created by `docker/init.sql` on first DB init.

---

## Frontend Notes

- **Auth token**: stored in `localStorage` as `ars_token`; user object as `ars_user`. Cleared on logout.
- **API base**: `NEXT_PUBLIC_API_URL` env var (baked at build time). Defaults to `http://localhost:3000/api/v1`.
- **`useSearchParams()` requires `<Suspense>`**: In Next.js App Router, any component calling `useSearchParams()` must be wrapped in a `<Suspense>` boundary. The `JobsList` component inside `app/jobs/page.tsx` is already set up this way.
- **File uploads**: The `apply` function in `lib/api.ts` uses raw `fetch` (not the `request` wrapper) because it sends `FormData` without a `Content-Type` header (browser sets boundary automatically).
- **Tailwind CSS v4**: uses `@import "tailwindcss"` syntax in globals.css (not the v3 `@tailwind base/components/utilities` directives).

---

## Adding the Anthropic API Key

1. Edit `.env` — set `ANTHROPIC_API_KEY=sk-ant-...`
2. Restart only the AI screener (no rebuild needed):
   ```bash
   docker compose restart ai-screener-service
   ```
3. Test:
   ```bash
   curl -X POST http://localhost:3000/api/v1/screen \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"applicationId":"...","jobTitle":"...","jobDescription":"...","jobRequirements":"...","resumeText":"..."}'
   ```

---

## Adding AWS S3 (Resume Uploads)

1. Create an S3 bucket (e.g. `ars-resumes`) in your chosen region.
2. Create an IAM user with `s3:PutObject` on `arn:aws:s3:::ars-resumes/*`.
3. Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` in `.env`.
4. Restart job-service:
   ```bash
   docker compose restart job-service
   ```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Gateway returns 429 on all requests | Throttler counter stuck in Redis | `docker exec ars_redis redis-cli FLUSHALL && docker compose restart api-gateway` |
| `invalid signature` on JWT | `JWT_SECRET` mismatch between services | Ensure `.env` has one `JWT_SECRET`; all services share it via `docker-compose.yml` |
| S3 upload fails | Missing/wrong AWS credentials | Check `AWS_ACCESS_KEY_ID`, IAM permissions, bucket exists |
| AI screening returns 500 | Missing `ANTHROPIC_API_KEY` | Add key to `.env`, restart ai-screener-service |
| DB password auth failed | Stale volume with different credentials | `docker compose down -v && docker compose up --build` |
| Frontend shows blank page | Build-time env var not set | Rebuild frontend image with correct `NEXT_PUBLIC_API_URL` |
| `useSearchParams` prerender error | Missing `<Suspense>` boundary | Wrap component using `useSearchParams()` in `<Suspense>` |
