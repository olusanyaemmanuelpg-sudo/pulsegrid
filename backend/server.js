import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './config/db.js';
import { initDb } from './model/initDb.js';
import registerRouter from './routes/register.js';
import loginRouter from './routes/login.js';
import requireAuth from './middleware/requireAuth.js';
import monitorRoutes from './routes/monitors.js';
import heartbeatRoutes from './routes/heartbeatRoute.js';
import { startScheduler } from './service/scheduler.js';
import { getPublicStatus } from './controller/monitorController.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { startTelemetryFlusher } from './service/telemetryFlusher.js';
dotenv.config();

const app = express();
const port = process.env.PORT;
app.use(cors());
app.use(express.json());

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
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per windowMs
});

app.get('/api/status', getPublicStatus);
app.use('/api/auth/register', authLimiter, registerRouter);
app.use('/api/auth/login', authLimiter, loginRouter);
app.use('/api/heartbeat', heartbeatRoutes);

app.use(requireAuth);
app.use('/api/monitors', monitorRoutes);

initDb().then(() => {
  startScheduler(10000); // Ticks every 10 seconds
  startTelemetryFlusher(15000); // Flushes telemetry buffer every 15 seconds
});

app.listen(port, () => {
  console.log(`🚀 PulseGrid API listening at http://localhost:${port}`);

  query('SELECT 1')
    .then(() => console.log('Database connected'))
    .catch((error) =>
      console.error('Database connection failed:', error.message),
    );
});
