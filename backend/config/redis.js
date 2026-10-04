import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

export const redis = new Redis(redisUrl, {
  // Prevent crash if Redis is temporarily unreachable
  maxRetriesPerRequest: 3,
  lazyConnect: process.env.NODE_ENV === 'test',
  retryStrategy(times) {
    if (process.env.NODE_ENV === 'test') return null;
    // Exponential backoff capped at 5000ms, retries indefinitely in production
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('⚡ Redis: In-memory hot state engine connected.');
});
redis.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err.message);
});
