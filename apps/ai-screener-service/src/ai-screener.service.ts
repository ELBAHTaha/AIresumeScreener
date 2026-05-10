import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Anthropic from '@anthropic-ai/sdk';
import { Redis } from 'ioredis';
import { ScreeningResult } from './entities/screening-result.entity';
import { ScreenRequestDto } from './dto/screen-request.dto';
import { RankingQueryDto, PaginatedResult } from './dto/ranking-query.dto';
import { ScreeningCompletedEvent } from './events/screening-completed.event';

@Injectable()
export class AiScreenerService {
  private readonly logger = new Logger(AiScreenerService.name);
  private readonly anthropic: Anthropic;
  private readonly redis: Redis;
  private readonly CACHE_TTL = parseInt(process.env.REDIS_TTL || '3600');

  constructor(
    @InjectRepository(ScreeningResult)
    private readonly screeningRepo: Repository<ScreeningResult>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async screenResume(dto: ScreenRequestDto): Promise<ScreeningResult> {
    // 1. DB hit — already screened
    const existing = await this.screeningRepo.findOne({
      where: { applicationId: dto.applicationId },
    });
    if (existing) {
      this.logger.log(`Returning existing screening for application ${dto.applicationId}`);
      return existing;
    }

    // 2. Redis hit — same resume+job content seen before
    const cacheKey = `screen:${this.hashContent(dto.resumeText + dto.jobDescription)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`Redis cache hit for application ${dto.applicationId}`);
      const parsed = JSON.parse(cached);
      const result = await this.saveScreeningResult(dto.applicationId, parsed, true);
      this.emitCompletedEvent(result, dto);
      return result;
    }

    // 3. Full miss — call Claude
    this.logger.log(`Calling Claude API for application ${dto.applicationId}`);
    const analysis = await this.callClaudeForScreening(dto);
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(analysis));
    const result = await this.saveScreeningResult(dto.applicationId, analysis, false);
    this.emitCompletedEvent(result, dto);
    return result;
  }

  // ─── Ranked candidates with pagination ──────────────────────────────────

  async getRankedCandidates(
    jobId: string,
    query: RankingQueryDto,
  ): Promise<PaginatedResult<ScreeningResult>> {
    const { page = 1, limit = 10, minScore, recommendation } = query;
    const skip = (page - 1) * limit;

    // Join through applications table to resolve job_id → screening results.
    // All services share the same PostgreSQL instance, so this join is valid.
    const qb = this.screeningRepo
      .createQueryBuilder('sr')
      .innerJoin('applications', 'a', 'a.id::text = sr.application_id::text')
      .where('a.job_id = :jobId', { jobId });

    if (minScore !== undefined) {
      qb.andWhere('sr.match_score >= :minScore', { minScore });
    }
    if (recommendation) {
      qb.andWhere('sr.recommendation = :recommendation', { recommendation });
    }

    qb.orderBy('sr.match_score', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getScreeningResult(applicationId: string): Promise<ScreeningResult> {
    const result = await this.screeningRepo.findOne({ where: { applicationId } });
    if (!result) throw new NotFoundException('Screening result not found');
    return result;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async callClaudeForScreening(dto: ScreenRequestDto) {
    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: this.buildScreeningPrompt(dto) }],
    });

    const rawText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('');

    return this.parseClaudeResponse(rawText);
  }

  private buildScreeningPrompt(dto: ScreenRequestDto): string {
    return `You are an expert technical recruiter. Analyze this resume against the job description and respond with ONLY a JSON object (no markdown, no explanation).

JOB TITLE: ${dto.jobTitle}

JOB DESCRIPTION:
${dto.jobDescription}

JOB REQUIREMENTS:
${dto.jobRequirements}

CANDIDATE RESUME:
${dto.resumeText}

Respond with this exact JSON structure:
{
  "matchScore": <integer 0-100>,
  "skillsMatch": [<list of skills the candidate has that match requirements>],
  "missingSkills": [<list of required skills the candidate is missing>],
  "strengths": [<2-4 specific strengths relevant to this role>],
  "concerns": [<1-3 specific concerns or gaps>],
  "summary": "<2-3 sentence professional summary of the candidate's fit>",
  "recommendation": "<one of: strong_yes | yes | maybe | no>"
}

Scoring guide:
- 90-100: Exceptional match, exceeds requirements
- 70-89: Strong match, meets most requirements
- 50-69: Partial match, meets core requirements but has gaps
- 30-49: Weak match, significant gaps
- 0-29: Poor match, does not meet key requirements`;
  }

  private parseClaudeResponse(rawText: string) {
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      this.logger.error('Failed to parse Claude response', rawText);
      throw new Error('AI response parsing failed');
    }
  }

  private async saveScreeningResult(
    applicationId: string,
    analysis: any,
    cached: boolean,
  ): Promise<ScreeningResult> {
    const result = this.screeningRepo.create({
      applicationId,
      matchScore: analysis.matchScore,
      skillsMatch: analysis.skillsMatch,
      missingSkills: analysis.missingSkills,
      strengths: analysis.strengths,
      concerns: analysis.concerns,
      summary: analysis.summary,
      recommendation: analysis.recommendation,
      cached,
    });
    return this.screeningRepo.save(result);
  }

  private emitCompletedEvent(result: ScreeningResult, dto: ScreenRequestDto) {
    // recruiterEmail is not in ScreenRequestDto — callers should pass it via dto
    // extension; for now we use a placeholder so the event is always emitted.
    const recruiterEmail = (dto as any).recruiterEmail || 'recruiter@ars.dev';
    this.eventEmitter.emit(
      'screening.completed',
      new ScreeningCompletedEvent(
        result.applicationId,
        result.matchScore,
        result.recommendation,
        recruiterEmail,
      ),
    );
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
