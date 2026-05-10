import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn,
} from 'typeorm';

export enum Recommendation {
  STRONG_YES = 'strong_yes',
  YES = 'yes',
  MAYBE = 'maybe',
  NO = 'no',
}

@Entity('screening_results')
export class ScreeningResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', unique: true })
  applicationId: string;

  @Column({ name: 'match_score' })
  matchScore: number;

  @Column({ name: 'skills_match', type: 'jsonb', default: [] })
  skillsMatch: string[];

  @Column({ name: 'missing_skills', type: 'jsonb', default: [] })
  missingSkills: string[];

  @Column({ type: 'jsonb', default: [] })
  strengths: string[];

  @Column({ type: 'jsonb', default: [] })
  concerns: string[];

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'varchar', nullable: true })
  recommendation: Recommendation;

  @Column({ default: false })
  cached: boolean;

  @CreateDateColumn({ name: 'screened_at' })
  screenedAt: Date;
}
