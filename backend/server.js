import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query, isUsingDedicatedReplica, closePools } from './config/db.js';
import { redis } from './config/redis.js';
import { initDb } from './model/initDb.js';
import registerRouter from './routes/register.js';
import loginRouter from './routes/login.js';
import requireAuth from './middleware/requireAuth.js';
import monitorRoutes from './routes/monitors.js';
import heartbeatRoutes from './routes/heartbeatRoute.js';
import alertRoutes from './routes/alerts.js';
import { startScheduler } from './service/scheduler.js';
import { getPublicStatus } from './controller/monitorController.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { startTelemetryFlusher } from './service/telemetryFlusher.js';
import { startWorkerHeartbeat } from './service/workerRegistry.js';
import { startAlertWorker } from './service/alertBroker.js';
import { corsOptions } from './security/cors.js';
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const INSTANCE_ID = process.env.INSTANCE_ID || `api-${process.pid}`;

app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Served-By', INSTANCE_ID);
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), fullscreen=(self)',
  );
  next();
});

// Base Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    instance: INSTANCE_ID,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

const authLimiter = createRateLimiter({
  prefix: 'auth',
  windowMs: 60 * 1000,
  max: 5,
  failOpen: process.env.RATE_LIMIT_FAIL_OPEN === 'true',
});

app.get('/api/status', getPublicStatus);
app.use('/api/auth/register', authLimiter, registerRouter);
app.use('/api/auth/login', authLimiter, loginRouter);
app.use('/api/heartbeat', heartbeatRoutes);

app.use(requireAuth);
app.use('/api/monitors', monitorRoutes);
app.use('/api/alerts', alertRoutes);

let serverInstance = null;
let isShuttingDown = false;

const handleServerShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`🛑 [PulseGrid API ${INSTANCE_ID}] Received ${signal}, initiating graceful shutdown...`);

  const forceTimeout = setTimeout(() => {
    console.error(`⚠️ [${INSTANCE_ID}] Graceful shutdown timed out (10s). Forcing process exit.`);
    process.exit(1);
  }, 10000);
  forceTimeout.unref();

  if (serverInstance) {
    serverInstance.close(async () => {
      console.log(`🔒 [${INSTANCE_ID}] Stopped accepting new HTTP connections.`);
      try {
        await closePools();
        await redis.quit();
        console.log(`✅ [${INSTANCE_ID}] API node shut down cleanly.`);
        process.exit(0);
      } catch (err) {
        console.error(`❌ [${INSTANCE_ID}] Error closing resources:`, err.message);
        process.exit(1);
      }
    });
  } else {
    await closePools();
    await redis.quit();
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleServerShutdown('SIGTERM'));
process.on('SIGINT', () => handleServerShutdown('SIGINT'));

const startServer = async () => {
  await initDb();
  const runWorkers = process.env.RUN_WORKERS !== 'false';

  if (runWorkers) {
    startWorkerHeartbeat(); // Sends heartbeat to Redis cluster every 5s
    startScheduler(10000); // Ticks every 10 seconds
    startTelemetryFlusher(15000); // Flushes telemetry buffer every 15 seconds
    startAlertWorker(1000); // Message broker consumer worker for multi-channel alerts
  } else {
    console.log(
      `🌐 [Web Tier API] Node "${INSTANCE_ID}" running in stateless API mode (Prober workers offloaded).`,
    );
  }

  serverInstance = app.listen(port, () => {
    console.log(`🚀 PulseGrid API [${INSTANCE_ID}] listening at http://localhost:${port}`);
    console.log(
      `📊 Database topology: ${isUsingDedicatedReplica ? 'read replica enabled' : 'primary-only mode (reads use primary)'}`,
    );

    query('SELECT 1')
      .then(() => console.log('Database connected'))
      .catch((error) =>
        console.error('Database connection failed:', error.message),
      );
  });
};

startServer().catch((error) => {
  console.error('Backend startup failed:', error.message);
  process.exit(1);
});
