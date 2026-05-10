import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiScreenerService } from './ai-screener.service';
import { ScreeningResult, Recommendation } from './entities/screening-result.entity';

// ─── Module-level mocks (hoisted by Jest) ─────────────────────────────────
jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
);

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
  })),
);

// ─── Fixtures ──────────────────────────────────────────────────────────────
const screenDto = {
  applicationId: 'app-uuid-1111',
  jobTitle: 'Senior Backend Engineer',
  jobDescription: 'Build scalable APIs',
  jobRequirements: 'Node.js, TypeScript, PostgreSQL',
  resumeText: '5 years Node.js, TypeScript, PostgreSQL expert',
};

const storedResult: Partial<ScreeningResult> = {
  id: 'result-uuid-1111',
  applicationId: 'app-uuid-1111',
  matchScore: 85,
  skillsMatch: ['Node.js', 'TypeScript'],
  missingSkills: [],
  strengths: ['Strong backend'],
  concerns: [],
  summary: 'Excellent fit',
  recommendation: Recommendation.YES,
  cached: false,
  screenedAt: new Date('2026-01-01'),
};

const claudeJsonPayload = {
  matchScore: 78,
  skillsMatch: ['TypeScript'],
  missingSkills: ['Kubernetes'],
  strengths: ['Solid TS skills'],
  concerns: ['No K8s experience'],
  summary: 'Good candidate with minor gaps',
  recommendation: 'maybe',
};

// ─── Repository mock factory ──────────────────────────────────────────────
const buildRepoMock = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  }),
});

// ─── Test suite ───────────────────────────────────────────────────────────
describe('AiScreenerService', () => {
  let service: AiScreenerService;
  let repoMock: ReturnType<typeof buildRepoMock>;

  beforeAll(() => {
    // Suppress NestJS logger noise in test output
    Logger.overrideLogger(false);
  });

  beforeEach(async () => {
    repoMock = buildRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiScreenerService,
        {
          provide: getRepositoryToken(ScreeningResult),
          useValue: repoMock,
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AiScreenerService>(AiScreenerService);
    jest.clearAllMocks();
  });

  // ─── screenResume() ───────────────────────────────────────────────────

  describe('screenResume()', () => {
    it('returns the existing DB record immediately — skips Redis and Claude', async () => {
      repoMock.findOne.mockResolvedValue(storedResult);

      const result = await service.screenResume(screenDto);

      expect(result).toEqual(storedResult);
      expect(repoMock.findOne).toHaveBeenCalledWith({
        where: { applicationId: screenDto.applicationId },
      });
      // Redis.get must NOT have been called
      const redis = (service as any).redis;
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('returns Redis-cached result (cached=true) without calling Claude on cache hit', async () => {
      repoMock.findOne.mockResolvedValue(null);

      const redis = (service as any).redis;
      redis.get.mockResolvedValue(JSON.stringify(claudeJsonPayload));

      const cachedRecord = { ...storedResult, cached: true };
      repoMock.create.mockReturnValue(cachedRecord);
      repoMock.save.mockResolvedValue(cachedRecord);

      const result = await service.screenResume(screenDto);

      expect(redis.get).toHaveBeenCalled();
      expect(repoMock.save).toHaveBeenCalled();
      expect(result.cached).toBe(true);

      // Claude API must NOT have been called
      const anthropic = (service as any).anthropic;
      expect(anthropic.messages.create).not.toHaveBeenCalled();
    });

    it('calls Claude API, stores in Redis, and saves to DB on full cache miss (cached=false)', async () => {
      repoMock.findOne.mockResolvedValue(null);

      const redis = (service as any).redis;
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');

      const anthropic = (service as any).anthropic;
      anthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(claudeJsonPayload) }],
      });

      const freshRecord = { ...storedResult, matchScore: 78, cached: false };
      repoMock.create.mockReturnValue(freshRecord);
      repoMock.save.mockResolvedValue(freshRecord);

      const result = await service.screenResume(screenDto);

      expect(anthropic.messages.create).toHaveBeenCalledTimes(1);
      expect(redis.setex).toHaveBeenCalled();
      expect(repoMock.save).toHaveBeenCalled();
      expect(result.cached).toBe(false);
    });
  });

  // ─── getScreeningResult() ─────────────────────────────────────────────

  describe('getScreeningResult()', () => {
    it('throws NotFoundException when no result exists for the applicationId', async () => {
      repoMock.findOne.mockResolvedValue(null);

      await expect(service.getScreeningResult('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the ScreeningResult when it exists', async () => {
      repoMock.findOne.mockResolvedValue(storedResult);

      const result = await service.getScreeningResult(screenDto.applicationId);

      expect(result).toEqual(storedResult);
      expect(repoMock.findOne).toHaveBeenCalledWith({
        where: { applicationId: screenDto.applicationId },
      });
    });
  });

  // ─── parseClaudeResponse() [private — tested via cast] ───────────────

  describe('parseClaudeResponse() [private]', () => {
    it('throws with "AI response parsing failed" when given invalid JSON', () => {
      expect(() => (service as any).parseClaudeResponse('not json at all {{{')).toThrow(
        'AI response parsing failed',
      );
    });

    it('strips markdown code fences before parsing', () => {
      const fenced = '```json\n{"matchScore":90}\n```';
      const parsed = (service as any).parseClaudeResponse(fenced);
      expect(parsed).toEqual({ matchScore: 90 });
    });

    it('returns parsed object for valid JSON', () => {
      const raw = JSON.stringify(claudeJsonPayload);
      const parsed = (service as any).parseClaudeResponse(raw);
      expect(parsed).toMatchObject({ matchScore: 78, recommendation: 'maybe' });
    });
  });
});
