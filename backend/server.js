import express from 'express';
import cors from 'cors';
import { configDotenv } from 'dotenv';
configDotenv();

const app = express();
const port = process.env.PORT;
app.use(cors());
app.use(express.json()); // Essential: enables req.body JSON parsing!

// Base Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`🚀 PulseGrid API listening at http://localhost:${port}`);
});
