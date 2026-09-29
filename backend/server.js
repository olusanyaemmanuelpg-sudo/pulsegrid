import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './config/db.js';
import { initDb } from './model/initDb.js';
import registerRouter from './routes/register.js';
dotenv.config();

const app = express();
const port = process.env.PORT;
app.use(cors());
app.use(express.json());
app.use('/api/auth/register', registerRouter);

// Base Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

initDb();

app.listen(port, () => {
  console.log(`🚀 PulseGrid API listening at http://localhost:${port}`);

  query('SELECT 1')
    .then(() => console.log('Database connected'))
    .catch((error) =>
      console.error('Database connection failed:', error.message),
    );
});
