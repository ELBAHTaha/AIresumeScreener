import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'API Gateway health check — returns uptime and configured upstreams' })
  getHealth() {
    return {
      status: 'ok',
      upstreams: {
        auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
        job: process.env.JOB_SERVICE_URL || 'http://localhost:3002',
        ai: process.env.AI_SERVICE_URL || 'http://localhost:3003',
      },
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
