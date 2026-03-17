import { randomUUID } from 'crypto';
import { EncodeService } from './encode.service';
import { CreditService } from './credit.service';

interface CompositionJob {
  id: string;
  projectId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  mode?: string;
  compositionUrl?: string;
  encodeJobId?: string;
}

const mockCompDb: Record<string, CompositionJob> = {};

export const CompositionService = {
  async startComposition(projectId: string, sceneGraph: any, aspect: string, mode: string): Promise<CompositionJob> {
    console.log(`Starting Remotion composition for project ${projectId} (Aspect: ${aspect}, Mode: ${mode})`);
    
    const job: CompositionJob = {
      id: randomUUID(),
      projectId,
      status: 'queued',
      mode
    };
    
    mockCompDb[job.id] = job;
    return job;
  },

  async processComposition(jobId: string, aspect: string) {
    const job = mockCompDb[jobId];
    if (!job) return;

    job.status = 'processing';
    console.log(`Composition Job ${jobId} resolving React tree...`);

    // Mock specific mode processing logic
    if (job.mode === 'simple_crop') console.log(`Applying simple_crop logic: Centering and scaling to fit ${aspect}.`);
    if (job.mode === 'smart_pan') console.log(`Applying smart_pan logic: Panning across AI focal points for ${aspect} canvas.`);
    if (job.mode === 'relayout') console.log(`Applying relayout logic: Shifting text and elements based on ${aspect} safe zones.`);

    // Simulate Remotion build time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    job.status = 'completed';
    job.compositionUrl = `https://storage.viprosell.com/compositions/${job.projectId}_bundle.zip`;
    console.log(`Composition Job ${jobId} completed.`);
    
    // Automatically trigger encode
    const encodeJob = await EncodeService.startEncode(job.projectId, job.compositionUrl, aspect);
    job.encodeJobId = encodeJob.id;
    
    // Process encode
    EncodeService.processEncode(encodeJob.id)
      .then(async () => {
        const status = await EncodeService.getJobStatus(encodeJob.id);
        if (status.status === 'completed') {
           console.log(`Full render pipeline complete. Deducting credits.`);
           await CreditService.deductCredits(job.projectId, 1);
        }
      })
      .catch(err => console.error(err));
  },

  async getJobStatus(jobId: string) {
    const job = mockCompDb[jobId];
    if (!job) return { status: 'not_found' };
    
    return {
      status: job.status,
      compositionUrl: job.compositionUrl,
      encodeJobId: job.encodeJobId
    };
  }
};
