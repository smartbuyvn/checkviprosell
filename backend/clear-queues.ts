import { Queue } from 'bullmq';
import 'dotenv/config';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = { url: REDIS_URL };

async function clearQueues() {
  console.log('Connecting to Redis at', REDIS_URL);
  
  const aiQueue = new Queue('ai-jobs', { connection });
  const renderQueue = new Queue('render-jobs', { connection });

  console.log('Clearing ai-jobs queue...');
  await aiQueue.obliterate({ force: true });
  console.log('ai-jobs cleared.');

  console.log('Clearing render-jobs queue...');
  await renderQueue.obliterate({ force: true });
  console.log('render-jobs cleared.');

  process.exit(0);
}

clearQueues().catch(console.error);
