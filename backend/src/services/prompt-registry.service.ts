/**
 * Viprosell — Nạp prompt từ CSDL, có dự phòng là hằng số trong code
 *
 * Trước đây trang Admin ghi prompt vào bảng `prompts` còn pipeline dùng hằng số
 * viết cứng, hai bên không nối với nhau: sửa prompt trong Admin báo thành công
 * nhưng render vẫn chạy prompt cũ. Đây là nơi nối hai thứ đó.
 *
 * Nguyên tắc: CSDL có bản hợp lệ thì dùng, không có thì dùng hằng số. KHÔNG bao
 * giờ để pipeline chết vì bảng prompts rỗng hay CSDL không gọi được — prompt cũ
 * vẫn chạy được, còn hơn không render được gì.
 */
import { createClient } from '@supabase/supabase-js';

/** Khoá định danh prompt trong bảng, lưu ở cột `name`. */
export type PromptKey =
  | 'tier1_brief_system'
  | 'tier2_strategy_system'
  | 'tier3_scene_graph_system'
  | 'tier4_render_plan_system'
  // Luong dung clip khach tu quay — hai call, khong di qua chuoi 4 tang.
  | 'video_call1_read_clip'
  | 'video_call2_edit_plan';

interface CacheEntry {
  content: string;
  /** Mốc hết hạn, tính bằng Date.now(). */
  expiresAt: number;
  source: 'csdl' | 'ma-nguon';
}

const cache = new Map<PromptKey, CacheEntry>();

/**
 * Giữ bản nạp được trong 60 giây.
 *
 * Không cache thì mỗi lần render là 4 lượt hỏi CSDL, mà prompt gần như không đổi.
 * Cache quá lâu thì admin sửa xong phải chờ mới thấy tác dụng. 60 giây là mức
 * admin sửa rồi thử lại ngay vẫn kịp, mà không làm phiền CSDL.
 */
const TTL_MS = parseInt(process.env.PROMPT_CACHE_TTL_MS || '60000', 10);

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Xoá cache — dùng sau khi admin sửa prompt để thấy tác dụng ngay. */
export function clearPromptCache(): void {
  cache.clear();
}

/**
 * Lấy nội dung prompt theo khoá.
 *
 * @param key      tên prompt trong bảng
 * @param fallback hằng số trong mã nguồn, dùng khi CSDL không có bản hợp lệ
 */
export async function getPrompt(key: PromptKey, fallback: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.content;

  const client = getClient();
  if (!client) {
    cache.set(key, { content: fallback, expiresAt: now + TTL_MS, source: 'ma-nguon' });
    return fallback;
  }

  try {
    const { data, error } = await client
      .from('prompts')
      .select('content, version')
      .eq('name', key)
      .eq('is_active', true)
      // Nhiều bản cùng tên thì lấy bản mới nhất. Bảng không có ràng buộc duy nhất
      // trên `name` nên đây là tình huống có thật, không phải phòng xa.
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(`[Prompt] Khong doc duoc "${key}" tu CSDL (${error.message}) — dung ban trong ma nguon.`);
    } else if (data?.content && String(data.content).trim().length >= 20) {
      const content = String(data.content);
      cache.set(key, { content, expiresAt: now + TTL_MS, source: 'csdl' });
      return content;
    } else if (data?.content) {
      // Prompt quá ngắn gần như chắc chắn là sửa nhầm hoặc dán hụt. Dùng nó thì
      // model mất hết chỉ dẫn và cho ra JSON sai — hỏng âm thầm, khó lần ra.
      console.warn(`[Prompt] "${key}" trong CSDL chi co ${String(data.content).trim().length} ky tu — bo qua, dung ban trong ma nguon.`);
    }
  } catch (err: any) {
    console.warn(`[Prompt] Loi khi doc "${key}": ${err.message} — dung ban trong ma nguon.`);
  }

  cache.set(key, { content: fallback, expiresAt: now + TTL_MS, source: 'ma-nguon' });
  return fallback;
}

/** Cho biết mỗi prompt đang lấy từ đâu — dùng để kiểm tra nhanh khi vận hành. */
export function promptSources(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of cache.entries()) out[k] = v.source;
  return out;
}
