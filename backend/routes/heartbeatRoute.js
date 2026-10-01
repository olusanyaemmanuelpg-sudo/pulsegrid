import { Router } from 'express';
import { receiveHeartbeat } from '../controller/heartbeats.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const heartbeatLimiter = createRateLimiter({
  prefix: 'heartbeat',
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each monitor to 10 requests per windowMs
  keyGenerator: (req) => req.params.id, // Use monitor ID as the unique key for rate limiting
});

const router = Router();

router.get('/:id', heartbeatLimiter, receiveHeartbeat);
router.post('/:id', heartbeatLimiter, receiveHeartbeat);

export default router;
