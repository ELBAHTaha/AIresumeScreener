import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly redis: Redis;

  constructor(private readonly dataSource: DataSource) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Service health check — returns DB, Redis connectivity and uptime' })
  async getHealth() {
    let database = 'connected';
    let redis = 'connected';

    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      database = 'disconnected';
    }

    try {
      await this.redis.ping();
    } catch {
      redis = 'disconnected';
    }

    const allOk = database === 'connected' && redis === 'connected';

    return {
      status: allOk ? 'ok' : 'error',
      database,
      redis,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
