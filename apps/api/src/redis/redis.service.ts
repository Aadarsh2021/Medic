import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private isConnected = false;

  onModuleInit() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    this.client = new Redis({
      host,
      port,
      password,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log(`Connected to Redis 7 at ${host}:${port}`);
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.logger.error(`Redis Connection Error: ${err.message}`);
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    // Establish connection on init
    this.client.connect().catch((err) => {
      this.logger.warn(`Initial Redis connection attempt failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }

  isHealthy(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  private checkConnection() {
    if (!this.client || this.client.status === 'end') {
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: 'REDIS_UNAVAILABLE',
          message: 'Redis session and cache infrastructure is currently unavailable.',
        },
      });
    }
  }

  async get(key: string): Promise<string | null> {
    this.checkConnection();
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.error(`Redis GET error for key ${key}: ${err.message}`);
      throw new ServiceUnavailableException('Redis storage operation failed');
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.checkConnection();
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      this.logger.error(`Redis SET error for key ${key}: ${err.message}`);
      throw new ServiceUnavailableException('Redis storage operation failed');
    }
  }

  async del(...keys: string[]): Promise<number> {
    this.checkConnection();
    if (!keys || keys.length === 0) return 0;
    try {
      return await this.client.del(...keys);
    } catch (err) {
      this.logger.error(`Redis DEL error for keys ${keys.join(', ')}: ${err.message}`);
      throw new ServiceUnavailableException('Redis storage operation failed');
    }
  }

  async exists(key: string): Promise<boolean> {
    this.checkConnection();
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (err) {
      this.logger.error(`Redis EXISTS error for key ${key}: ${err.message}`);
      throw new ServiceUnavailableException('Redis storage operation failed');
    }
  }

  async incr(key: string): Promise<number> {
    this.checkConnection();
    try {
      return await this.client.incr(key);
    } catch (err) {
      this.logger.error(`Redis INCR error for key ${key}: ${err.message}`);
      throw new ServiceUnavailableException('Redis storage operation failed');
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    this.checkConnection();
    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
    } catch (err) {
      this.logger.error(`Redis EXPIRE error for key ${key}: ${err.message}`);
      throw new ServiceUnavailableException('Redis storage operation failed');
    }
  }

  async keys(pattern: string): Promise<string[]> {
    this.checkConnection();
    try {
      return await this.client.keys(pattern);
    } catch (err) {
      this.logger.error(`Redis KEYS error for pattern ${pattern}: ${err.message}`);
      throw new ServiceUnavailableException('Redis storage operation failed');
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
