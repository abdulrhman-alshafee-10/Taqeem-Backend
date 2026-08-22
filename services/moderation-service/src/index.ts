import express from 'express';
import cors from 'cors';
import { reportRoutes } from './routes/report.routes';
import { moderationRoutes } from './routes/moderation.routes';
import { appealRoutes } from './routes/appeal.routes';

// Import workers to start them
import './workers/s3-export.worker';
import './workers/sla-escalator';

export const app = express();

app.use(cors());
app.use(express.json());

// Apply routes
app.use('/api/reports', reportRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/moderation/reviews', appealRoutes); // For appeals

const port = process.env.PORT || 4012;

export function start() {
  app.listen(port, () => {
    console.log(`Moderation Service running on port ${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start();
}
