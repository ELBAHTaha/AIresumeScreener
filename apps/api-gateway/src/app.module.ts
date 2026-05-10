import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { HealthModule } from './health/health.module';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { RedisThrottlerStorage } from './throttler/redis-throttler.storage';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule.register({ timeout: 10000 }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: 'global',
            ttl: parseInt(process.env.THROTTLE_TTL || '60000'),
            limit: parseInt(process.env.THROTTLE_LIMIT || '10'),
          },
        ],
        storage: new RedisThrottlerStorage(
          process.env.REDIS_URL || 'redis://localhost:6379',
        ),
      }),
    }),
    HealthModule,
  ],
  controllers: [GatewayController],
  providers: [
    GatewayService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
