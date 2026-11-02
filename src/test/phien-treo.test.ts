/**
 * Phiên đăng nhập treo không được làm treo cả ứng dụng.
 *
 * Đo thật trên production ngày 29/10/2026, console in:
 *
 *     [Auth] getSession() timed out after 3s — resolving with no session
 *
 * `supabase.auth.getSession()` giành khoá navigator.locks và TREO VÔ HẠN khi khoá bị
 * giữ. `useAuth` đã sống chung bằng `Promise.race` kèm timeout, nhưng tầng service
 * thì không — `getSessionSafe` chỉ có `try/catch`, mà promise treo thì không ném lỗi.
 *
 * Hậu quả: nút "Lưu & Tải lên…" quay vô tận, không báo lỗi, và **không một dòng nào
 * được ghi xuống CSDL** suốt gần năm tiếng.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSessionSafe } from '@/lib/errorUtils';

/** Client giả có `getSession` không bao giờ resolve. */
function clientTreo() {
  return { auth: { getSession: () => new Promise(() => {}) } };
}

/** Client giả trả về phiên bình thường. */
function clientTot(id = 'user-1') {
  return {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok', user: { id } } } }),
    },
  };
}

describe('getSessionSafe khi phiên treo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('KHÔNG treo mãi — trả null sau 3 giây', async () => {
    const p = getSessionSafe(clientTreo());
    let xong = false;
    p.then(() => { xong = true; });

    await vi.advanceTimersByTimeAsync(2900);
    expect(xong, 'chưa tới 3 giây thì chưa được bỏ cuộc').toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    await expect(p).resolves.toBeNull();
  });

  it('phiên bình thường vẫn trả về ngay, không phải chờ hết giờ', async () => {
    const p = getSessionSafe(clientTot());
    await vi.advanceTimersByTimeAsync(0);
    const s = await p;
    expect(s?.access_token).toBe('tok');
    expect(s?.user?.id).toBe('user-1');
  });

  it('getSession ném lỗi thì trả null, không nổ', async () => {
    const client = { auth: { getSession: async () => { throw new Error('Lock broken'); } } };
    await expect(getSessionSafe(client)).resolves.toBeNull();
  });

  it('getSession trả về rỗng thì không nổ', async () => {
    const client = { auth: { getSession: async () => ({ data: { session: null } }) } };
    await expect(getSessionSafe(client)).resolves.toBeNull();
  });
});
