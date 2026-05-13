import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum ApplicationStatus {
  PENDING = 'pending',
  SCREENING = 'screening',
  SCREENED = 'screened',
  INTERVIEW = 'interview',
  REJECTED = 'rejected',
  HIRED = 'hired',
}

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'job_id' })
  jobId: string;

  @Column({ name: 'candidate_id' })
  candidateId: string;

  @Column({ name: 'resume_url', type: 'text' })
  resumeUrl: string;

  @Column({ name: 'resume_text', type: 'text', nullable: true })
  resumeText: string;

  @Column({ name: 'cover_letter', type: 'text', nullable: true })
  coverLetter: string;

  @Column({ type: 'varchar', default: ApplicationStatus.PENDING })
  status: ApplicationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
