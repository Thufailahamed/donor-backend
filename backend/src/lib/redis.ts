import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const redisHost = process.env.REDIS_HOST;
const redisKey = process.env.REDIS_KEY;
const redisPort = process.env.REDIS_PORT || '6380';

function createClient() {
  if (!redisHost || !redisKey) return null;

  try {
    return new Redis({
      host: redisHost,
      port: parseInt(redisPort),
      password: redisKey.trim(),
      tls: parseInt(redisPort) === 6380 ? {} : undefined,
      maxRetriesPerRequest: 10,
      connectTimeout: 10000,
      keepAlive: 30000,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });
  } catch (err) {
    logger.error('Failed to initialize Redis client:', err);
    return null;
  }
}

export const redis = createClient();

if (redis) {
  redis.on('connect', () => logger.info('🚀 Redis connected successfully'));
  redis.on('error', (err) => logger.error('❌ Redis connection error:', err));
} else {
  logger.warn('⚠️ REDIS_URL not found. Redis-dependent features will be disabled or fall back to in-memory.');
}

/**
 * Cache wrapper to handle cases where Redis might be unavailable
 */
export const cacheSet = async (key: string, value: any, ttlSeconds: number = 3600) => {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.error(`Redis set error for key ${key}:`, err);
  }
};

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error(`Redis get error for key ${key}:`, err);
    return null;
  }
};

export const cacheDel = async (key: string) => {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    logger.error(`Redis del error for key ${key}:`, err);
  }
};

