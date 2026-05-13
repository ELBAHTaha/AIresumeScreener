import {
  Injectable, NotFoundException, ForbiddenException,
  ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { Job, JobStatus } from '../entities/job.entity';
import { Application } from '../entities/application.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

type AuthUser = { id: string; role: string };

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly s3: S3Client;
  private readonly bucket = process.env.AWS_S3_BUCKET || 'ars-resumes';

  constructor(
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
  ) {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.MINIO_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  // ─── Jobs CRUD ────────────────────────────────────────────────

  async create(dto: CreateJobDto, recruiterId: string): Promise<Job> {
    const job = this.jobRepo.create({ ...dto, recruiterId });
    return this.jobRepo.save(job);
  }

  async findAll(status?: JobStatus): Promise<Job[]> {
    const where = status ? { status } : { status: JobStatus.ACTIVE };
    return this.jobRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  async update(id: string, dto: UpdateJobDto, user: AuthUser): Promise<Job> {
    const job = await this.findOne(id);
    this.assertOwnership(job, user);
    Object.assign(job, dto);
    return this.jobRepo.save(job);
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const job = await this.findOne(id);
    this.assertOwnership(job, user);
    await this.jobRepo.remove(job);
  }

  // ─── Applications ─────────────────────────────────────────────

  async apply(
    jobId: string,
    file: Express.Multer.File,
    candidateId: string,
    coverLetter?: string,
  ): Promise<Application> {
    const job = await this.findOne(jobId);
    if (job.status !== JobStatus.ACTIVE) {
      throw new BadRequestException('This job is not currently accepting applications');
    }

    const duplicate = await this.appRepo.findOne({ where: { jobId, candidateId } });
    if (duplicate) throw new ConflictException('You have already applied to this job');

    const resumeUrl = await this.uploadResume(file, candidateId, jobId);
    const resumeText = await this.extractText(file.buffer);
    const application = this.appRepo.create({ jobId, candidateId, resumeUrl, resumeText, coverLetter });
    return this.appRepo.save(application);
  }

  async getApplications(jobId: string, user: AuthUser): Promise<Application[]> {
    // Admin sees all; recruiter must own the job
    if (user.role !== 'admin') {
      const job = await this.findOne(jobId);
      if (job.recruiterId !== user.id) {
        throw new ForbiddenException('You can only view applications for your own job postings');
      }
    }

    return this.appRepo.find({ where: { jobId }, order: { createdAt: 'DESC' } });
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private assertOwnership(job: Job, user: AuthUser): void {
    if (user.role !== 'admin' && job.recruiterId !== user.id) {
      throw new ForbiddenException('You can only modify your own job postings');
    }
  }

  private async extractText(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text?.trim() || '';
    } catch {
      this.logger.warn('PDF text extraction failed — storing empty text');
      return '';
    }
  }

  private async uploadResume(
    file: Express.Multer.File,
    candidateId: string,
    jobId: string,
  ): Promise<string> {
    const key = `resumes/${jobId}/${candidateId}/${uuidv4()}.pdf`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: 'application/pdf',
        ContentLength: file.size,
        Metadata: {
          candidateId,
          jobId,
          originalName: encodeURIComponent(file.originalname),
        },
      }),
    );

    this.logger.log(`Uploaded resume: ${key}`);
    const publicUrl = process.env.MINIO_PUBLIC_URL || 'http://localhost:9000';
    return `${publicUrl}/${this.bucket}/${key}`;
  }
}
