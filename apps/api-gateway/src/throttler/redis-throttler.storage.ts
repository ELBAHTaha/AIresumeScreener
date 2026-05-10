import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

interface StorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { lazyConnect: true });
    this.redis.connect().catch(() => {});
  }

  async increment(key: string, ttl: number): Promise<StorageRecord> {
    const hitKey = `throttle:hits:${key}`;

    try {
      const pipe = this.redis.pipeline();
      pipe.incr(hitKey);
      pipe.pexpire(hitKey, ttl);
      const results = await pipe.exec();
      const totalHits = (results?.[0]?.[1] as number) ?? 1;

      return { totalHits, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
    } catch {
      // If Redis is unavailable, fail open so requests are not blocked
      return { totalHits: 1, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
