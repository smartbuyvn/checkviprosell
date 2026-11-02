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

/** Dạng UUID. Chặn ở đây để chuỗi rác thành 400 chứ không thành lỗi Postgres rồi 500. */
const DANG_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Giống `requireProjectOwner` nhưng vào bằng `renderId`.
 *
 * ── Vì sao cần một hàm riêng ──
 *
 * Bảng `renders` KHÔNG có cột `user_id`. Quyền sở hữu đi vòng:
 * `renders.project_id → projects.user_id`. Endpoint nào chỉ cầm `renderId` thì không
 * dùng được `requireProjectOwner`, và trước ngày 02/11/2026 thì chúng đơn giản là
 * không kiểm gì cả.
 *
 * ── Render không có chủ thì TỪ CHỐI ──
 *
 * `project_id` rỗng nghĩa là không ai chứng minh được quyền sở hữu. Cho qua là cho
 * tất cả mọi người, nên đây phải đóng. Đo ngày 02/11/2026: 0/36 dòng thiếu
 * `project_id`, nên nhánh này hiện không chặn ai — nhưng `QuickAdsRenderService.startRender`
 * chèn vào `renders` mà KHÔNG đặt `project_id`, nên nó có thể phát sinh.
 *
 * Trả về cả dòng render để nơi gọi khỏi đọc lại lần nữa.
 */
export async function requireRenderOwner(
  request: FastifyRequest,
  reply: FastifyReply,
  renderId: string,
  deps?: {
    db?: { from: (b: string) => any };
    layUserId?: (authHeader: string | undefined) => Promise<string | null>;
    kiemAdmin?: (userId: string) => Promise<boolean>;
  },
): Promise<{ userId: string; render: Record<string, any> } | null> {
  const db = deps?.db ?? supabaseClient();
  const layUserId = deps?.layUserId ?? getVerifiedUserId;
  const kiemAdmin = deps?.kiemAdmin ?? isAdmin;

  if (!renderId || !DANG_UUID.test(renderId)) {
    reply.status(400).send({ error: 'renderId khong hop le' });
    return null;
  }

  const userId = await layUserId(request.headers.authorization);
  if (!userId) {
    reply.status(401).send({ error: 'Invalid or expired token' });
    return null;
  }

  const { data: r } = await db.from('renders').select('*').eq('id', renderId).single();
  const render = r as Record<string, any> | null;
  if (!render) {
    reply.status(404).send({ error: 'Render not found' });
    return null;
  }

  if (!render.project_id) {
    reply.status(403).send({ error: 'Forbidden: render khong gan voi du an nao.' });
    return null;
  }

  const { data: p } = await db.from('projects').select('user_id').eq('id', render.project_id).single();
  const project = p as { user_id: string } | null;
  if (!project) {
    // Du an bi xoa cung that ma khoa ngoai hong cung the: khong chung minh duoc quyen
    // thi khong cho qua.
    reply.status(404).send({ error: 'Project not found' });
    return null;
  }

  if (project.user_id !== userId) {
    // Chi hoi vai tro admin KHI khong phai chu — do la mot luot truy van nua, khong
    // dang tra cho moi request cua nguoi dung binh thuong. `isAdmin` fail-closed.
    if (!(await kiemAdmin(userId))) {
      reply.status(403).send({ error: 'Forbidden: You do not own this render.' });
      return null;
    }
  }

  return { userId, render };
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
