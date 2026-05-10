import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, Headers,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes,
  ApiResponse, ApiParam, ApiQuery, ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GatewayService } from './gateway.service';

@Controller()
export class GatewayController {
  constructor(private readonly gateway: GatewayService) {}

  // ─── Auth ─────────────────────────────────────────────────────────────

  @ApiTags('Auth')
  @Post('auth/register')
  @ApiOperation({ summary: 'Register a new user', description: 'Creates an account with role: admin | recruiter | candidate' })
  @ApiBody({ schema: { example: { email: 'jane@co.com', password: 'Pass@1234', firstName: 'Jane', lastName: 'Smith', role: 'recruiter' } } })
  @ApiResponse({ status: 201, description: 'User registered — returns JWT token' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() body: any) {
    return this.gateway.proxy('auth', '/api/v1/auth/register', 'POST', body);
  }

  @ApiTags('Auth')
  @Post('auth/login')
  @ApiOperation({ summary: 'Login and receive a JWT token' })
  @ApiBody({ schema: { example: { email: 'jane@co.com', password: 'Pass@1234' } } })
  @ApiResponse({ status: 200, description: 'Login successful — returns accessToken + user profile' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() body: any) {
    return this.gateway.proxy('auth', '/api/v1/auth/login', 'POST', body);
  }

  @ApiTags('Auth')
  @Get('auth/profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  profile(@Headers() headers: any) {
    return this.gateway.proxy('auth', '/api/v1/auth/profile', 'GET', null, headers);
  }

  // ─── Jobs ─────────────────────────────────────────────────────────────

  @ApiTags('Jobs')
  @Post('jobs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a job posting', description: 'Recruiter or admin only. Creates job with status=draft by default.' })
  @ApiBody({ schema: { example: { title: 'Senior Engineer', description: '...', requirements: '5+ years Node.js', company: 'Acme', jobType: 'remote' } } })
  @ApiResponse({ status: 201, description: 'Job created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Requires recruiter or admin role' })
  createJob(@Body() body: any, @Headers() headers: any) {
    return this.gateway.proxy('job', '/api/v1/jobs', 'POST', body, headers);
  }

  @ApiTags('Jobs')
  @Get('jobs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List job postings', description: 'Defaults to active jobs. Pass ?status=draft|closed to filter.' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'closed', 'draft'] })
  @ApiResponse({ status: 200, description: 'Array of job postings' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  listJobs(@Query() query: any, @Headers() headers: any) {
    const qs = query.status ? `?status=${query.status}` : '';
    return this.gateway.proxy('job', `/api/v1/jobs${qs}`, 'GET', null, headers);
  }

  @ApiTags('Jobs')
  @Get('jobs/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific job by ID' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job details' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  getJob(@Param('id') id: string, @Headers() headers: any) {
    return this.gateway.proxy('job', `/api/v1/jobs/${id}`, 'GET', null, headers);
  }

  @ApiTags('Jobs')
  @Patch('jobs/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a job posting', description: 'Recruiter can only edit their own jobs. Admin can edit any.' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Updated job' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Not the job owner' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  updateJob(@Param('id') id: string, @Body() body: any, @Headers() headers: any) {
    return this.gateway.proxy('job', `/api/v1/jobs/${id}`, 'PATCH', body, headers);
  }

  @ApiTags('Jobs')
  @Delete('jobs/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a job posting' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 204, description: 'Job deleted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Not the job owner' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  deleteJob(@Param('id') id: string, @Headers() headers: any) {
    return this.gateway.proxy('job', `/api/v1/jobs/${id}`, 'DELETE', null, headers);
  }

  // ─── Applications ──────────────────────────────────────────────────────

  @ApiTags('Applications')
  @Post('jobs/:jobId/apply')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Apply to a job (candidates only)', description: 'Upload resume PDF via multipart/form-data. Resume is stored in AWS S3.' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiBody({ schema: { type: 'object', required: ['resume'], properties: { resume: { type: 'string', format: 'binary' }, coverLetter: { type: 'string' } } } })
  @ApiResponse({ status: 201, description: 'Application submitted' })
  @ApiResponse({ status: 400, description: 'Not a PDF or job is not active' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Requires candidate role' })
  @ApiResponse({ status: 409, description: 'Already applied to this job' })
  apply(@Param('jobId') jobId: string, @Body() body: any, @Headers() headers: any) {
    return this.gateway.proxy('job', `/api/v1/jobs/${jobId}/apply`, 'POST', body, headers);
  }

  @ApiTags('Applications')
  @Get('jobs/:jobId/applications')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all applications for a job', description: 'Recruiters see only applications for their own jobs. Admins see all.' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Array of applications with resume URLs' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Not the job owner or insufficient role' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  getApplications(@Param('jobId') jobId: string, @Headers() headers: any) {
    return this.gateway.proxy('job', `/api/v1/jobs/${jobId}/applications`, 'GET', null, headers);
  }

  // ─── AI Screening ──────────────────────────────────────────────────────

  @ApiTags('AI Screening')
  @Post('screen')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Screen a resume with Claude AI',
    description: 'Analyzes resume text vs job requirements. Stricter rate limit: 3 req/60s. Results cached in Redis for 1 hour.',
  })
  @ApiBody({ schema: { example: { applicationId: 'uuid', jobTitle: 'Engineer', jobDescription: '...', jobRequirements: '...', resumeText: '...' } } })
  @ApiResponse({ status: 200, description: 'Screening result with matchScore 0–100 and recommendation' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Requires recruiter or admin role' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded — max 3 screening requests per 60 seconds' })
  @ApiResponse({ status: 500, description: 'Claude API error' })
  screen(@Body() body: any, @Headers() headers: any) {
    return this.gateway.proxy('ai', '/api/v1/screen', 'POST', body, headers);
  }

  @ApiTags('AI Screening')
  @Get('screen/:applicationId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get screening result for an application' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiResponse({ status: 200, description: 'Screening result' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Requires recruiter or admin role' })
  @ApiResponse({ status: 404, description: 'No screening result found' })
  getScreening(@Param('applicationId') applicationId: string, @Headers() headers: any) {
    return this.gateway.proxy('ai', `/api/v1/screen/${applicationId}`, 'GET', null, headers);
  }

  @ApiTags('AI Screening')
  @Get('screen/ranked/:jobId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all candidates ranked by AI score for a job' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'minScore', required: false, type: Number })
  @ApiQuery({ name: 'recommendation', required: false, enum: ['strong_yes', 'yes', 'maybe', 'no'] })
  @ApiResponse({ status: 200, description: 'Paginated ranked candidates list' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Requires recruiter or admin role' })
  getRanked(@Param('jobId') jobId: string, @Query() query: any, @Headers() headers: any) {
    const params = new URLSearchParams(query).toString();
    const path = `/api/v1/screen/ranked/${jobId}${params ? `?${params}` : ''}`;
    return this.gateway.proxy('ai', path, 'GET', null, headers);
  }
}
