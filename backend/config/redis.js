import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

export const redis = new Redis(redisUrl, {
  // Prevent crash if Redis is temporarily unreachable
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('⚡ Redis: In-memory hot state engine connected.');
});
redis.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err.message);
});
