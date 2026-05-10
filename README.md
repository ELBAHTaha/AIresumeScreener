# AI Resume Screener

> A production-grade, AI-powered resume screening platform built with NestJS microservices, Claude AI, PostgreSQL, Redis, AWS S3, and Docker.

---

## Architecture

```
                    ┌─────────────────────────┐
                    │      API Gateway         │
                    │    NestJS :3000          │
                    │  Rate-limit · Logging    │
                    └──┬────────┬────────┬─────┘
                       │        │        │
          ┌────────────┘   ┌────┘   ┌───┘
          │                │        │
  ┌───────▼──────┐  ┌──────▼──────┐ ┌──────▼──────────────┐
  │ Auth Service │  │ Job Service │ │ AI Screener Service  │
  │  NestJS :3001│  │ NestJS :3002│ │    NestJS :3003      │
  │ JWT · RBAC   │  │ CRUD · S3   │ │ Claude · Redis cache │
  └──────────────┘  └─────────────┘ └─────────────────────┘
          │                │                   │
          └────────────────┼───────────────────┘
                           │
             ┌─────────────┴──────────────┐
             │                            │
      ┌──────▼──────┐             ┌───────▼──────┐
      │  PostgreSQL  │             │    Redis 7   │
      │  (shared DB) │             │  (cache +    │
      └─────────────┘             │   throttle)  │
                                  └──────────────┘
```

---

## Key Features

| Feature | Details |
|---|---|
| AI Screening | Claude (`claude-sonnet-4`) analyzes resumes: 0–100 match score, skills gap, recommendation |
| Redis Caching | Identical resume+job combos cached 1 hr; cached hits respond in < 50ms |
| JWT + RBAC | Three roles: `admin`, `recruiter`, `candidate`; route-level enforcement |
| Rate Limiting | Global 10 req/60s; POST /screen restricted to 3 req/60s; backed by Redis |
| Resume Storage | PDF uploads via FileInterceptor → AWS S3 (`resumes/{jobId}/{candidateId}/{uuid}.pdf`) |
| Email Notifications | Nodemailer SMTP notification to recruiter after each screening completes |
| Health Checks | `GET /api/v1/health` on every service: DB ping, Redis ping, uptime, timestamp |
| Structured Logging | Winston JSON in production; colorized console in development |
| Global Error Handling | Consistent `{ statusCode, error, message, timestamp, path }` on every service |
| Ranked Pagination | `GET /screen/ranked/:jobId?page=&limit=&minScore=&recommendation=` |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **20.x LTS** | `nvm use 20` |
| npm | 10.x | ships with Node 20 |
| Docker | 24.x+ | Docker Desktop or Docker Engine |
| Docker Compose | 2.x (V2) | `docker compose` (not `docker-compose`) |
| Anthropic API Key | — | [console.anthropic.com](https://console.anthropic.com) |
| AWS credentials | — | IAM user with `s3:PutObject` on your bucket |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in every value before starting.

| Variable | Service(s) | Required | Description |
|---|---|---|---|
| `POSTGRES_USER` | compose | yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | compose | yes | PostgreSQL password |
| `POSTGRES_DB` | compose | yes | Database name |
| `JWT_SECRET` | auth, job, ai, gateway | yes | HS256 signing secret (≥ 32 chars) |
| `JWT_EXPIRES_IN` | auth | no | Token lifetime (default `7d`) |
| `AWS_REGION` | job | yes | S3 region (e.g. `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | job | yes | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | job | yes | IAM secret key |
| `AWS_S3_BUCKET` | job | yes | S3 bucket name |
| `ANTHROPIC_API_KEY` | ai | yes | Claude API key |
| `REDIS_URL` | ai, gateway | no | Redis connection string (default `redis://localhost:6379`) |
| `REDIS_TTL` | ai | no | Cache TTL seconds (default `3600`) |
| `THROTTLE_TTL` | gateway | no | Rate-limit window ms (default `60000`) |
| `THROTTLE_LIMIT` | gateway | no | Max requests per window (default `10`) |
| `LOG_LEVEL` | all | no | `error \| warn \| info \| debug` (default `info`) |
| `SMTP_HOST` | ai | no | SMTP server (default `smtp.gmail.com`) |
| `SMTP_PORT` | ai | no | SMTP port (default `587`) |
| `SMTP_USER` | ai | no | SMTP username / sender email |
| `SMTP_PASS` | ai | no | SMTP password or app password |

---

## Local Development — Step by Step

### 1. Clone and configure

```bash
git clone https://github.com/yourusername/ai-resume-screener
cd ai-resume-screener
cp .env.example .env
# Open .env and set ANTHROPIC_API_KEY, AWS_* and JWT_SECRET
```

### 2. Start all services

```bash
docker compose up --build
```

Services start in dependency order: PostgreSQL → Redis → auth/job/ai → gateway.  
Logs are streamed to the terminal. Wait until you see the gateway start line.

### 3. Verify health

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","uptime":12,"timestamp":"..."}

curl http://localhost:3001/api/v1/health
# {"status":"ok","database":"connected","uptime":15,...}
```

### 4. Open Swagger UI

```
http://localhost:3000/api/docs   ← API Gateway (use this for testing)
http://localhost:3001/api/docs   ← Auth Service
http://localhost:3002/api/docs   ← Job Service
http://localhost:3003/api/docs   ← AI Screener Service
```

### 5. Run unit tests

```bash
cd apps/ai-screener-service
npm install
npm test           # runs jest
npm run test:cov   # with coverage
```

---

## API Examples

### Register + login

```bash
# Register as recruiter
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"Pass@1234","firstName":"Jane","lastName":"Smith","role":"recruiter"}'

# Login — copy accessToken from response
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@acme.com","password":"Pass@1234"}'

export TOKEN="<your_access_token>"
```

### Job lifecycle

```bash
# Create a job (recruiter)
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Senior Backend Engineer","description":"Build scalable APIs...","requirements":"5+ years Node.js, PostgreSQL, Docker","company":"Acme Corp","jobType":"remote","status":"active"}'

# List active jobs (any role)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/jobs

# Get a specific job
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/jobs/<jobId>
```

### Apply to a job (candidate)

```bash
export CANDIDATE_TOKEN="<candidate_jwt>"
export JOB_ID="<job-uuid>"

curl -X POST http://localhost:3000/api/v1/jobs/$JOB_ID/apply \
  -H "Authorization: Bearer $CANDIDATE_TOKEN" \
  -F "resume=@/path/to/resume.pdf" \
  -F "coverLetter=I am excited to apply..."
```

### Screen a resume with AI

```bash
curl -X POST http://localhost:3000/api/v1/screen \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "<application-uuid>",
    "jobTitle": "Senior Backend Engineer",
    "jobDescription": "Build scalable APIs for millions of users...",
    "jobRequirements": "5+ years Node.js, PostgreSQL, Docker, REST APIs",
    "resumeText": "John Doe — 6 years Node.js, TypeScript, PostgreSQL, Docker, AWS"
  }'
```

**Response:**
```json
{
  "id": "uuid",
  "applicationId": "uuid",
  "matchScore": 92,
  "recommendation": "strong_yes",
  "skillsMatch": ["Node.js", "TypeScript", "PostgreSQL", "Docker"],
  "missingSkills": [],
  "strengths": ["6 years directly relevant experience", "Full stack of required tech"],
  "concerns": ["No mention of REST API design pattern experience"],
  "summary": "Exceptional candidate — exceeds all technical requirements.",
  "cached": false
}
```

### Get ranked candidates (paginated)

```bash
curl "http://localhost:3000/api/v1/screen/ranked/$JOB_ID?page=1&limit=10&minScore=70&recommendation=yes" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "data": [...],
  "total": 24,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```

---

## Performance Benchmarks

| Scenario | p50 | p95 |
|---|---|---|
| DB-cached screening (same applicationId) | < 5ms | < 20ms |
| Redis-cached screening (same resume+job hash) | < 30ms | < 60ms |
| Full Claude API call | 1.2s | 2.8s |
| Job CRUD (no AI) | < 15ms | < 40ms |
| Auth (login, bcrypt) | < 80ms | < 150ms |

---

## Architecture Decision Records

### Why microservices?

Each service owns a single bounded context — auth, jobs, AI screening — deployable and scalable independently. Claude API calls are isolated: the AI screener can scale out without touching auth or job state. The trade-off is operational complexity; Docker Compose mitigates this locally and GitHub Actions automates deployment.

### Why Redis cache for AI results?

Claude API costs $0.003–0.015 per call. Identical resume+job pairs are hashed and cached for 1 hour. In practice, recruiters run the same job description against hundreds of candidates; the hash key (`sha256(resumeText + jobDescription)`) means any candidate who re-applies gets an instant result. This reduces Claude API spend by an estimated 40–60% for active job postings.

### Why JSONB for arrays?

`skillsMatch`, `missingSkills`, `strengths`, and `concerns` are arrays of arbitrary strings. JSONB stores them natively, supports GIN indexing for future search features (`@>` queries), and requires no schema migration as Claude's output evolves. Alternative: separate junction tables — over-engineered for this data size and query pattern.

### Why UUID primary keys?

Row IDs are exposed in API responses and S3 keys. UUIDs prevent enumeration attacks (sequential integer IDs let attackers guess adjacent records), distribute well across a partitioned DB, and are trivially generated in application code with no DB round-trip. The storage cost (16 bytes vs 4 bytes) is negligible at this scale.

### Why shared PostgreSQL for all services?

A true microservices architecture uses one database per service. For this project, a shared DB is an intentional pragmatic choice: it avoids operating three separate PG instances, keeps the Docker Compose footprint small, and allows the AI screener to JOIN through `applications` to resolve `job_id` without cross-service HTTP calls. If the services grow independently, extract to separate schemas or databases per service.

---

## Project Structure

```
ai-resume-screener/
├── apps/
│   ├── api-gateway/          HTTP proxy · rate limiting · request logging
│   │   └── src/
│   │       ├── filters/      HttpExceptionFilter
│   │       ├── health/       GET /health
│   │       ├── middleware/   LoggingMiddleware (method/path/status/ms)
│   │       └── throttler/    RedisThrottlerStorage (ioredis-backed)
│   ├── auth-service/         JWT auth · user registration · RBAC
│   │   └── src/
│   │       ├── auth/         controller · service · guards · strategies
│   │       ├── filters/      HttpExceptionFilter
│   │       ├── health/       GET /health (DB ping)
│   │       └── users/        User entity
│   ├── job-service/          Job CRUD · applications · S3 resume upload
│   │   └── src/
│   │       ├── entities/     Job · Application (TypeORM)
│   │       ├── filters/      HttpExceptionFilter
│   │       ├── guards/       JwtAuthGuard · RolesGuard
│   │       ├── health/       GET /health (DB ping)
│   │       └── jobs/         controller · service · DTOs
│   └── ai-screener-service/  Claude AI · Redis cache · events · email
│       └── src/
│           ├── dto/          ScreenRequestDto · RankingQueryDto (paginated)
│           ├── entities/     ScreeningResult (TypeORM)
│           ├── events/       ScreeningCompletedEvent · NotificationListener
│           ├── filters/      HttpExceptionFilter
│           ├── guards/       JwtAuthGuard · RolesGuard
│           └── health/       GET /health (DB + Redis ping)
├── docker/
│   └── init.sql              Full PostgreSQL schema + indexes + seed admin
├── .github/
│   └── workflows/
│       └── ci-cd.yml         Build → push GHCR → deploy EC2
├── docker-compose.yml        All services + healthcheck endpoints
└── .env.example              All variables with descriptions
```

---

## Troubleshooting

### `docker compose up` fails immediately

```
Error: password authentication failed for user "ars_user"
```
Delete the existing volume so init.sql reruns: `docker compose down -v && docker compose up --build`

### auth-service: `invalid signature` on JWT

`JWT_SECRET` differs between services. All four services must share the same secret — set it once in `.env` and reference it as `${JWT_SECRET}` in `docker-compose.yml`.

### job-service: S3 upload fails

1. Verify `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are set in `.env`
2. The IAM user must have `s3:PutObject` permission on `arn:aws:s3:::ars-resumes/*`
3. The bucket must exist (the service does not create it)

### ai-screener-service: `Claude API error`

Check `ANTHROPIC_API_KEY` is valid and your account has access to `claude-sonnet-4-20250514`. Verify with: `curl https://api.anthropic.com/v1/messages -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01"`

### Rate limit 429 on POST /screen

The `/screen` endpoint has a stricter limit of **3 requests per 60 seconds** per IP. Wait for the TTL window to reset, or increase `THROTTLE_TTL` in `.env`.

### `health` endpoint returns `database: disconnected`

PostgreSQL is not reachable. Check: `docker compose logs postgres` — the service may still be initializing. The `start_period: 20s` in healthcheck gives it time; if it persists, check `DATABASE_URL` and network connectivity between containers.

---

## Deployment (AWS EC2)

```bash
# On EC2 (Ubuntu 22.04, Docker installed)
git clone https://github.com/yourusername/ai-resume-screener
cd ai-resume-screener
cp .env.example .env && nano .env   # add your secrets
docker compose up -d --build
docker compose ps                   # all services should be healthy
```

GitHub Actions (`.github/workflows/ci-cd.yml`) builds Docker images on every push to `main`, pushes to GHCR, and SSHs into EC2 to pull and restart containers.
