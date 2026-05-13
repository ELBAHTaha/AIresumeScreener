-- AI Resume Screener - Database Schema
-- Run automatically by Docker on first start

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'candidate' CHECK (role IN ('admin', 'recruiter', 'candidate')),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Jobs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           VARCHAR(255) NOT NULL,
  description     TEXT NOT NULL,
  requirements    TEXT NOT NULL,
  company         VARCHAR(255) NOT NULL,
  location        VARCHAR(255),
  salary_min      INTEGER,
  salary_max      INTEGER,
  job_type        VARCHAR(20) DEFAULT 'full_time' CHECK (job_type IN ('full_time', 'part_time', 'contract', 'remote')),
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
  recruiter_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ─── Applications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id              UUID REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  resume_url          TEXT NOT NULL,
  resume_text         TEXT,
  cover_letter        TEXT,
  status              VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'screening', 'screened', 'interview', 'rejected', 'hired')),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);

-- ─── AI Screening Results ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS screening_results (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id      UUID REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
  match_score         INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  skills_match        JSONB DEFAULT '[]',
  missing_skills      JSONB DEFAULT '[]',
  strengths           JSONB DEFAULT '[]',
  concerns            JSONB DEFAULT '[]',
  summary             TEXT NOT NULL,
  recommendation      VARCHAR(20) CHECK (recommendation IN ('strong_yes', 'yes', 'maybe', 'no')),
  raw_response        TEXT,
  cached              BOOLEAN DEFAULT false,
  screened_at         TIMESTAMP DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter ON jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_screening_application ON screening_results(application_id);
CREATE INDEX IF NOT EXISTS idx_screening_score ON screening_results(match_score DESC);

-- ─── Seed Admin User ──────────────────────────────────────────
-- Password: Admin@123 (bcrypt hashed)
INSERT INTO users (email, password, first_name, last_name, role)
VALUES (
  'admin@ars.dev',
  '$2b$10$Z6a5pRZu5iR9CYdOPnmM1e/GfHLLMb6qCVZsejq1cFyMJm7ifzY6a',
  'Admin',
  'User',
  'admin'
) ON CONFLICT DO NOTHING;

DO $$ BEGIN RAISE NOTICE 'Database initialized successfully'; END $$;
