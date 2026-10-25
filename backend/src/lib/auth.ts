import { createClient } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Khởi tạo trễ: thiếu env thì chỉ một request hỏng, thay vì cả tiến trình chết lúc import
let client: ReturnType<typeof createClient> | null = null;
function supabaseClient() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'anon',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return client;
}

/**
 * Verify the Bearer access token with Supabase Auth (signature, expiry, revoked session).
 * Returns the user id, or null when the header is missing or the token is invalid.
 */
export async function getVerifiedUserId(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (token.split('.').length !== 3) return null;

  try {
    const { data, error } = await supabaseClient().auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch (err: any) {
    // Lỗi mạng tới Supabase Auth khác với token sai → log để không nhầm thành "user bị đăng xuất hàng loạt"
    console.warn(`[Auth] Token verification failed (Supabase Auth unreachable?): ${err?.message}`);
    return null;
  }
}

/** True when the user holds the admin role; false on any lookup error (fail closed). */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseClient()
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .limit(1);
  if (error) {
    console.warn(`[Auth] Admin role lookup failed for ${userId}: ${error.message}`);
    return false;
  }
  return !!data && data.length > 0;
}

/**
 * Resolve the verified caller and ensure they own the project.
 * Returns the user id, or null after sending 401 / 404 / 403 on the reply.
 */
export async function requireProjectOwner(
  request: FastifyRequest,
  reply: FastifyReply,
  projectId: string
): Promise<string | null> {
  const userId = await getVerifiedUserId(request.headers.authorization);
  if (!userId) {
    reply.status(401).send({ error: 'Invalid or expired token' });
    return null;
  }

  const { data } = await supabaseClient().from('projects').select('user_id').eq('id', projectId).single();
  const project = data as { user_id: string } | null;
  if (!project) {
    reply.status(404).send({ error: 'Project not found' });
    return null;
  }
  if (project.user_id !== userId) {
    reply.status(403).send({ error: 'Forbidden: You do not own this project.' });
    return null;
  }
  return userId;
}
