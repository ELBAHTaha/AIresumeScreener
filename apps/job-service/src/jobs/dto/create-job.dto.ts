import { IsString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType, JobStatus } from '../../entities/job.entity';

export class CreateJobDto {
  @ApiProperty({ example: 'Senior Backend Engineer' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'We are looking for a talented backend engineer...' })
  @IsString()
  description: string;

  @ApiProperty({ example: '5+ years Node.js, PostgreSQL, REST APIs...' })
  @IsString()
  requirements: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  company: string;

  @ApiPropertyOptional({ example: 'New York, NY' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: 80000 })
  @IsInt()
  @Min(0)
  @IsOptional()
  salaryMin?: number;

  @ApiPropertyOptional({ example: 120000 })
  @IsInt()
  @Min(0)
  @IsOptional()
  salaryMax?: number;

  @ApiPropertyOptional({ enum: JobType, default: JobType.FULL_TIME })
  @IsEnum(JobType)
  @IsOptional()
  jobType?: JobType;

  @ApiPropertyOptional({ enum: JobStatus, default: JobStatus.DRAFT })
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;
}
