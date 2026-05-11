from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ScreenRequestDto(BaseModel):
    applicationId: str
    jobTitle: str
    jobDescription: str
    jobRequirements: str
    resumeText: str


class ScreeningResult(BaseModel):
    id: str
    applicationId: str
    matchScore: int
    skillsMatch: List[str]
    missingSkills: List[str]
    strengths: List[str]
    concerns: List[str]
    summary: str
    recommendation: str
    cached: bool
    screenedAt: datetime

    model_config = {"from_attributes": True}


class PaginatedResponse(BaseModel):
    data: List[ScreeningResult]
    total: int
    page: int
    limit: int
    totalPages: int
