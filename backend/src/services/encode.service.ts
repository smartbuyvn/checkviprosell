import { randomUUID } from 'crypto';

export interface EncodeJob {
  id: string;
  projectId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputUrl?: string;
  render_time_ms?: number;
  error_details?: any;
}

const mockEncodeDb: Record<string, EncodeJob> = {};

export const EncodeService = {
  async startEncode(projectId: string, compositionUrl: string, aspect: string): Promise<EncodeJob> {
    console.log(`Starting encode job for project ${projectId} with aspect ${aspect} from ${compositionUrl}`);
    
    const job: EncodeJob = {
      id: randomUUID(),
      projectId,
      status: 'queued',
      progress: 0
    };
    
    mockEncodeDb[job.id] = job;
    return job;
  },

  async processEncode(jobId: string) {
    const job = mockEncodeDb[jobId];
    if (!job) return;

    job.status = 'processing';
    console.log(`Job ${jobId} processing FFmpeg NVENC...`);
    const startTime = Date.now();

    // Random failure simulation for beta testing
    if (Math.random() < 0.1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      job.status = 'failed';
      job.error_details = { code: 'FFMPEG_TIMEOUT', step: 'muxing', message: 'Video encoding failed due to timeout.' };
      job.render_time_ms = Date.now() - startTime;
      console.error(`Encode Job ${jobId} failed:`, job.error_details);
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    job.progress = 50;
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    job.progress = 100;
    job.status = 'completed';
    job.outputUrl = `https://storage.viprosell.com/renders/${job.projectId}_final.mp4`;
    job.render_time_ms = Date.now() - startTime;

    console.log(`Encode Job ${jobId} completed successfully in ${job.render_time_ms}ms.`);
  },

  async getJobStatus(jobId: string) {
    const job = mockEncodeDb[jobId];
    if (!job) return { status: 'not_found' };
    
    return {
      status: job.status,
      progress: job.progress,
      outputUrl: job.outputUrl,
      render_time_ms: job.render_time_ms,
      error_details: job.error_details
    };
  }
};
