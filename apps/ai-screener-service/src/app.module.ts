import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AiScreenerController } from './ai-screener.controller';
import { AiScreenerService } from './ai-screener.service';
import { ScreeningResult } from './entities/screening-result.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { NotificationListener } from './events/notification.listener';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [ScreeningResult],
      synchronize: false,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    TypeOrmModule.forFeature([ScreeningResult]),
    PassportModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', maxListeners: 10 }),
    HealthModule,
  ],
  controllers: [AiScreenerController],
  providers: [AiScreenerService, JwtStrategy, NotificationListener],
})
export class AppModule {}
