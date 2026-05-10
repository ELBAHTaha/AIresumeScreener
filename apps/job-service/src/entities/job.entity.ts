import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum JobType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  REMOTE = 'remote',
}

export enum JobStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  DRAFT = 'draft',
}

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  requirements: string;

  @Column()
  company: string;

  @Column({ nullable: true })
  location: string;

  @Column({ name: 'salary_min', nullable: true, type: 'int' })
  salaryMin: number;

  @Column({ name: 'salary_max', nullable: true, type: 'int' })
  salaryMax: number;

  @Column({ name: 'job_type', type: 'varchar', default: JobType.FULL_TIME })
  jobType: JobType;

  @Column({ type: 'varchar', default: JobStatus.DRAFT })
  status: JobStatus;

  @Column({ name: 'recruiter_id' })
  recruiterId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
