import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query, isUsingDedicatedReplica } from './config/db.js';
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
app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
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

const startServer = async () => {
  await initDb();
  startWorkerHeartbeat(); // Sends heartbeat to Redis cluster every 5s
  startScheduler(10000); // Ticks every 10 seconds
  startTelemetryFlusher(15000); // Flushes telemetry buffer every 15 seconds
  startAlertWorker(1000); // Message broker consumer worker for multi-channel alerts

  app.listen(port, () => {
    console.log(`🚀 PulseGrid API listening at http://localhost:${port}`);
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
