from __future__ import annotations

from typing import List

import spacy
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

SKILLS_VOCABULARY: set[str] = {
    # Languages
    "Python", "Java", "TypeScript", "JavaScript", "Go", "Rust", "C++", "C#",
    "Ruby", "PHP", "Swift", "Kotlin", "Scala",
    # Frontend
    "React", "Next.js", "Vue", "Angular", "Svelte", "Tailwind",
    # Backend
    "NestJS", "FastAPI", "Spring Boot", "Django", "Flask", "Express", "Node.js",
    # Databases
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "SQLite", "SQL",
    # Cloud & infra
    "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Terraform", "Ansible",
    # Messaging
    "Kafka", "RabbitMQ", "gRPC", "REST", "GraphQL",
    # ML / data
    "TensorFlow", "PyTorch", "scikit-learn", "pandas", "NumPy", "Spark",
    # DevOps / tooling
    "Git", "CI/CD", "Jenkins", "GitHub Actions", "Linux", "Bash",
    # Methodologies
    "Microservices", "DevOps", "Agile", "Scrum",
}

_nlp: spacy.language.Language | None = None
_embed: SentenceTransformer | None = None


def load_models() -> None:
    global _nlp, _embed
    _nlp = spacy.load("en_core_web_md")
    _embed = SentenceTransformer("all-MiniLM-L6-v2")


def extract_skills(text: str) -> List[str]:
    """Return all SKILLS_VOCABULARY entries found in text (case-insensitive)."""
    text_lower = text.lower()
    return [skill for skill in SKILLS_VOCABULARY if skill.lower() in text_lower]


def _semantic_score(resume_text: str, job_text: str) -> int:
    vecs = _embed.encode([resume_text, job_text])
    sim = cosine_similarity([vecs[0]], [vecs[1]])[0][0]
    return int(float(sim) * 100)


def screen_resume(payload) -> dict:
    """
    Run the full offline screening pipeline and return an analysis dict
    with the same keys the NestJS service produced via Claude.
    """
    candidate_skills = set(extract_skills(payload.resumeText))
    required_skills = set(extract_skills(payload.jobRequirements))

    matched: List[str] = sorted(candidate_skills & required_skills)
    missing: List[str] = sorted(required_skills - candidate_skills)

    semantic = _semantic_score(payload.resumeText, payload.jobDescription)
    coverage = (len(matched) / len(required_skills) * 100) if required_skills else 0
    score = int(0.6 * semantic + 0.4 * coverage)

    # Clamp to valid range (cosine similarity can be slightly > 1.0 due to float errors)
    score = max(0, min(100, score))

    if score >= 90:
        rec = "strong_yes"
    elif score >= 70:
        rec = "yes"
    elif score >= 50:
        rec = "maybe"
    else:
        rec = "no"

    strengths: List[str] = [f"Proficient in {s}" for s in matched[:3]]
    if semantic > 75:
        strengths.append(f"Strong semantic alignment with job description ({semantic}/100)")
    if not strengths:
        strengths = ["Resume submitted for review"]

    concerns: List[str] = [f"Missing required skill: {s}" for s in missing[:3]]
    if score < 50:
        concerns.append(f"Low overall match score ({score}/100) — significant gaps detected")
    if not concerns:
        concerns = ["No significant gaps identified"]

    n_req = len(required_skills)
    gap_str = ", ".join(missing[:2]) if missing else "no key areas"
    summary = (
        f"Candidate matches {len(matched)} of {n_req} required skills "
        f"with a semantic similarity score of {semantic}/100. "
    )
    if rec in ("strong_yes", "yes"):
        summary += f"Recommended for interview with minor gaps in {gap_str}."
    elif rec == "maybe":
        summary += f"May be considered with additional evaluation; gaps in {gap_str}."
    else:
        summary += f"Does not meet key requirements; significant gaps in {gap_str}."

    return {
        "matchScore": score,
        "skillsMatch": matched,
        "missingSkills": missing,
        "strengths": strengths,
        "concerns": concerns,
        "summary": summary,
        "recommendation": rec,
    }
