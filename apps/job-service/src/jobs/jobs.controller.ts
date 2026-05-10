import {
  Controller, Post, Get, Patch, Delete,
  Param, Body, Query, Request, UploadedFile,
  UseGuards, UseInterceptors, HttpCode, HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiConsumes, ApiBody, ApiQuery,
} from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { JobStatus } from '../entities/job.entity';

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // ─── CRUD ─────────────────────────────────────────────────────

  @Post()
  @Roles('recruiter', 'admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new job posting (recruiters/admins only)' })
  @ApiResponse({ status: 201, description: 'Job created successfully' })
  create(@Body() dto: CreateJobDto, @Request() req) {
    return this.jobsService.create(dto, req.user.id);
  }

  @Get()
  @Roles('admin', 'recruiter', 'candidate')
  @ApiOperation({ summary: 'List jobs — defaults to active; filter by status via query param' })
  @ApiQuery({ name: 'status', enum: JobStatus, required: false })
  findAll(@Query('status') status?: JobStatus) {
    return this.jobsService.findAll(status);
  }

  @Get(':id')
  @Roles('admin', 'recruiter', 'candidate')
  @ApiOperation({ summary: 'Get a single job by ID' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Patch(':id')
  @Roles('recruiter', 'admin')
  @ApiOperation({ summary: 'Update a job posting — recruiters can only edit their own' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the job owner' })
  update(@Param('id') id: string, @Body() dto: UpdateJobDto, @Request() req) {
    return this.jobsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles('recruiter', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a job posting — recruiters can only delete their own' })
  remove(@Param('id') id: string, @Request() req) {
    return this.jobsService.remove(id, req.user);
  }

  // ─── Applications ─────────────────────────────────────────────

  @Post(':jobId/apply')
  @Roles('candidate')
  @UseInterceptors(
    FileInterceptor('resume', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Only PDF files are accepted'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['resume'],
      properties: {
        resume: { type: 'string', format: 'binary', description: 'PDF resume (max 10 MB)' },
        coverLetter: { type: 'string', description: 'Optional cover letter text' },
      },
    },
  })
  @ApiOperation({ summary: 'Apply to a job — uploads resume PDF to S3 (candidates only)' })
  @ApiResponse({ status: 201, description: 'Application submitted' })
  @ApiResponse({ status: 400, description: 'Not a PDF or job not active' })
  @ApiResponse({ status: 409, description: 'Already applied to this job' })
  async apply(
    @Param('jobId') jobId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('coverLetter') coverLetter: string,
    @Request() req,
  ) {
    if (!file) throw new BadRequestException('Resume PDF is required');
    return this.jobsService.apply(jobId, file, req.user.id, coverLetter);
  }

  @Get(':jobId/applications')
  @Roles('recruiter', 'admin')
  @ApiOperation({ summary: 'Get all applications for a job — recruiters see only their jobs' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the job owner' })
  getApplications(@Param('jobId') jobId: string, @Request() req) {
    return this.jobsService.getApplications(jobId, req.user);
  }
}
