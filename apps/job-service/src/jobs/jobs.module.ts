import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../entities/job.entity';
import { Application } from '../entities/application.entity';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { RolesGuard } from '../guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Job, Application])],
  controllers: [JobsController],
  providers: [JobsService, RolesGuard],
})
export class JobsModule {}
