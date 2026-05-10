import {
  Controller, Post, Get, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { AiScreenerService } from './ai-screener.service';
import { ScreenRequestDto } from './dto/screen-request.dto';
import { RankingQueryDto } from './dto/ranking-query.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('AI Screener')
@Controller('screen')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AiScreenerController {
  constructor(private readonly aiScreenerService: AiScreenerService) {}

  @Post()
  @Roles('admin', 'recruiter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Screen a resume against a job using Claude AI',
    description:
      'Analyzes resume text vs job requirements. Returns match score 0–100, skills gap analysis, and hiring recommendation. Results are cached in Redis for 1 hour and persisted to PostgreSQL.',
  })
  @ApiResponse({ status: 200, description: 'Screening complete — returns ScreeningResult' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Requires recruiter or admin role' })
  @ApiResponse({ status: 500, description: 'Claude API or database error' })
  screenResume(@Body() dto: ScreenRequestDto) {
    return this.aiScreenerService.screenResume(dto);
  }

  @Get(':applicationId')
  @Roles('admin', 'recruiter')
  @ApiOperation({
    summary: 'Get existing screening result for an application',
    description: 'Fetches a previously stored screening result by applicationId.',
  })
  @ApiParam({ name: 'applicationId', description: 'UUID of the application', type: String })
  @ApiResponse({ status: 200, description: 'Screening result found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Requires recruiter or admin role' })
  @ApiResponse({ status: 404, description: 'No screening result for this applicationId' })
  getResult(@Param('applicationId') applicationId: string) {
    return this.aiScreenerService.getScreeningResult(applicationId);
  }

  @Get('ranked/:jobId')
  @Roles('admin', 'recruiter')
  @ApiOperation({
    summary: 'Get all candidates ranked by AI score for a job',
    description:
      'Returns paginated screening results sorted by matchScore descending. Optional filters: minScore, recommendation.',
  })
  @ApiParam({ name: 'jobId', description: 'UUID of the job posting', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page (default 10, max 100)' })
  @ApiQuery({ name: 'minScore', required: false, type: Number, description: 'Minimum matchScore filter (0–100)' })
  @ApiQuery({ name: 'recommendation', required: false, enum: ['strong_yes', 'yes', 'maybe', 'no'] })
  @ApiResponse({ status: 200, description: 'Paginated list of ranked candidates' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Requires recruiter or admin role' })
  getRanked(@Param('jobId') jobId: string, @Query() query: RankingQueryDto) {
    return this.aiScreenerService.getRankedCandidates(jobId, query);
  }
}
