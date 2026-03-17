import { randomUUID } from 'crypto';

interface FaceReplaceJob {
  id: string;
  projectId: string;
  sourceImageUrl: string;
  targetVideoUrl: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  errorMessage?: string;
}

const mockFaceDb: Record<string, FaceReplaceJob> = {};

export const FaceReplaceService = {
  async queueJob(projectId: string, sourceImageUrl: string, targetVideoUrl: string): Promise<FaceReplaceJob> {
    console.log(`Queueing Face Replacement for project ${projectId}`);
    
    const job: FaceReplaceJob = {
      id: randomUUID(),
      projectId,
      sourceImageUrl,
      targetVideoUrl,
      status: 'queued'
    };
    
    mockFaceDb[job.id] = job;
    return job;
  },

  async processJob(jobId: string) {
    const job = mockFaceDb[jobId];
    if (!job) return;

    job.status = 'processing';
    console.log(`Processing Face Replacement Job ${jobId}...`);

    // Simulate AI FaceReplace time
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    job.status = 'completed';
    job.outputUrl = `https://storage.viprosell.com/face_replace/${job.projectId}_result.mp4`;
    console.log(`Face Replacement Job ${jobId} completed.`);
  },

  async getJobStatus(jobId: string) {
    const job = mockFaceDb[jobId];
    if (!job) return { status: 'not_found' };
    
    return {
      status: job.status,
      outputUrl: job.outputUrl,
      errorMessage: job.errorMessage
    };
  }
};
