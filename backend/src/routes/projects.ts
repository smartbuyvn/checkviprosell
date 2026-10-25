import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { getVerifiedUserId } from '../lib/auth';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function projectRoutes(fastify: FastifyInstance) {
  // POST /api/v1/projects/:id/trash
  fastify.post('/:id/trash', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!id) return reply.status(400).send({ error: 'Missing project ID' });

      // Bắt buộc token đã xác minh — trước đây thiếu token thì bỏ qua kiểm tra chủ sở hữu
      const userId = await getVerifiedUserId(request.headers['authorization']);
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

      // 1. Fetch current project state
      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Check authorization
      if (project.user_id !== userId) {
         console.error(`[Trash] User ID mismatch! Token User: ${userId}, Project User: ${project.user_id}`);
         return reply.status(403).send({ error: 'Forbidden: You do not own this project.' });
      }

      // 2. Determine action based on status
      const isProcessing = ['analyzing', 'queued', 'processing', 'rendering'].includes(project.status);
      
      const now = new Date().toISOString();
      let updatePayload: any = {
        deleted_at: now,
        deleted_by: userId,
        delete_reason: 'User triggered trash from UI',
      };

      if (isProcessing) {
        // If it's processing, we set cancel_requested_at. It will NOT resurrect.
        updatePayload.cancel_requested_at = now;
      } else {
        // If it's completed/draft/failed, set purge_after to 30 days
        const purgeAfter = new Date();
        purgeAfter.setDate(purgeAfter.getDate() + 30);
        updatePayload.purge_after = purgeAfter.toISOString();
      }

      // 3. Update the database
      const { error: updateError } = await supabase
        .from('projects')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) {
        throw new Error(`Failed to trash project: ${updateError.message}`);
      }

      // Optional: Cascade deleted_at to renders so they don't show up independently
      await supabase
        .from('renders')
        .update({ deleted_at: now })
        .eq('project_id', id);

      return reply.send({ success: true, message: 'Project trashed successfully', cancel_requested: isProcessing });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /api/v1/projects/:id/restore
  fastify.post('/:id/restore', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      if (!id) return reply.status(400).send({ error: 'Missing project ID' });

      const userId = await getVerifiedUserId(request.headers['authorization']);
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

      const { data: project } = await supabase.from('projects').select('user_id').eq('id', id).single();
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      if (project.user_id !== userId) {
         return reply.status(403).send({ error: 'Forbidden' });
      }

      const { error: updateError } = await supabase
        .from('projects')
        .update({
          deleted_at: null,
          deleted_by: null,
          delete_reason: null,
          purge_after: null,
          cancel_requested_at: null,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Restore renders
      await supabase
        .from('renders')
        .update({ deleted_at: null })
        .eq('project_id', id);

      return reply.send({ success: true, message: 'Project restored' });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
