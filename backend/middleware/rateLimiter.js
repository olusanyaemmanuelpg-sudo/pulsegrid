import { redis } from '../config/redis.js';

/**
 * Distributed Sliding Window Rate Limiter using Redis Sorted Sets (ZSET).
 *
 * @param {Object} options
 * @param {string} options.prefix - Namespace for the rate limit key (e.g. 'auth', 'heartbeat')
 * @param {number} options.windowMs - Sliding window duration in milliseconds (e.g. 60000 for 1m)
 * @param {number} options.max - Maximum allowed requests within the window
 * @param {function} [options.keyGenerator] - Custom key extractor (defaults to client IP)
 */
export const createRateLimiter = ({
  prefix,
  windowMs = 60000,
  max = 10,
  keyGenerator,
}) => {
  return async (req, res, next) => {
    try {
      // 1. Determine client identifier (IP address or custom ID like monitorId)
      const identifier = keyGenerator
        ? keyGenerator(req)
        : req.ip ||
          req.headers['x-forwarded-for'] ||
          req.socket.remoteAddress ||
          'unknown';

      const key = `rate_limit:${prefix}:${identifier}`;
      const now = Date.now();
      const clearBefore = now - windowMs;

      // 2. Atomic Redis Pipeline: Clean old entries, get count, record new attempt
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, clearBefore); // Remove timestamps older than window
      pipeline.zcard(key); // Count remaining requests in current window
      pipeline.zadd(
        key,
        now,
        `${now}:${Math.random().toString(36).slice(2, 8)}`,
      ); // Add current attempt
      pipeline.expire(key, Math.ceil(windowMs / 1000) * 2); // Auto-expire unused keys

      const results = await pipeline.exec();
      const currentCount = results[1][1]; // Count before adding current request

      // 3. Exceeded limit?
      if (currentCount >= max) {
        const retryAfterSeconds = Math.ceil(windowMs / 1000);
        res.setHeader('Retry-After', retryAfterSeconds);
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', 0);

        return res.status(429).json({
          message: `Too many requests. Please wait ${retryAfterSeconds}s before trying again.`,
        });
      }

      // 4. Allowed: Attach standard rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, max - currentCount - 1),
      );

      return next();
    } catch (err) {
      // Resilience: If Redis ever has a hiccup, fail open so we don't bring down traffic
      console.warn(
        '⚠️ [RateLimiter] Redis rate limiting error (failing open):',
        err.message,
      );
      return next();
    }
  };
};
