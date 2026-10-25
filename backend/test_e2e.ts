import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const REDIS_URL = process.env.REDIS_URL || 'redis://:ViproRedis2026!@vps.ninhle.com:6379';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const aiQueue = new Queue('ai-jobs', { connection });

async function runTest() {
  console.log('--- STARTING E2E TEST ---');

  // 1. Create a fake user via DB
  console.log('[1] Creating test user...');
  const fakeUserId = '00000000-0000-0000-0000-000000000001';
  
  // We'll just create a dummy project instead of full auth flow since this is backend test
  console.log('[2] Creating a test project...');
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .insert({
      user_id: fakeUserId,
      name: 'E2E Test Project',
      status: 'pending',
      media_urls: ['https://example.com/video.mp4'],
      face_url: 'https://example.com/face.jpg'
    })
    .select('id')
    .single();

  if (pErr) {
    // If user doesn't exist, foreign key constraint might fail.
    console.log('Skipping DB insert due to foreign key constraints, pushing directly to queue.');
  }

  const projectId = project?.id || 'fake-project-uuid-for-test';

  console.log(`[3] Pushing to AI Queue for project: ${projectId}`);
  const job = await aiQueue.add('product_intel', {
    projectId: projectId,
    type: 'product_intel',
    userId: fakeUserId
  });

  console.log(`Job ${job.id} added. Waiting for completion...`);

  // Wait for 10 seconds to let local workers process it
  await new Promise(resolve => setTimeout(resolve, 10000));

  const state = await job.getState();
  console.log(`[4] Job state after 10s: ${state}`);

  console.log('--- TEST COMPLETE ---');
  process.exit(0);
}

runTest().catch(console.error);
