/**
 * `currentUserId()` không được báo "chưa đăng nhập" khi người dùng ĐANG đăng nhập.
 *
 * ── Hai lỗi thật, cùng một lượt sửa ngày 29/10/2026 ──
 *
 * 1. Bản vá đầu ghi nhớ `null` với BẤT KỲ sự kiện auth nào không kèm phiên:
 *
 *        daNho = session?.user?.id ?? null;
 *
 *    `INITIAL_SESSION` có thể bắn trước khi đọc xong kho lưu trữ. Vì `daNho !==
 *    undefined` chặn đường đọc lại, cái `null` đó dính vĩnh viễn. Triệu chứng đo
 *    được: số dư nạp bình thường lúc vào trang (rõ ràng có phiên), nhưng bấm Render
 *    thì báo **"Chưa đăng nhập"**.
 *
 * 2. `getSession()` hết 3 giây cũng cho ra `null`, dù phiên vẫn nằm trong
 *    localStorage. Giờ có đường cuối đọc thẳng localStorage — thao tác đồng bộ,
 *    không qua khoá, không thể treo.
 *
 * Test nạp lại module mỗi lần để trạng thái nhớ không rò giữa các phép kiểm.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type HamSuKien = (suKien: string, session: unknown) => void;

let batSuKien: HamSuKien | null = null;
let phienTra: unknown = null;
let getSessionTreo = false;
let soLanGoiGetSession = 0;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: HamSuKien) => {
        batSuKien = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession: async () => {
        soLanGoiGetSession++;
        if (getSessionTreo) return new Promise(() => {});
        return { data: { session: phienTra } };
      },
    },
  },
}));

async function napLai() {
  vi.resetModules();
  batSuKien = null;
  return import('@/lib/currentUser');
}

const KHOA_SB = 'sb-abcdefghijklmnop-auth-token';

/**
 * localStorage giả.
 *
 * Môi trường test không cấp sẵn, và `currentUserId` đọc nó qua `length`/`key(i)` chứ
 * không chỉ `getItem` — nên bản giả phải đủ ba thứ đó.
 */
const kho = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    get length() { return kho.size; },
    key: (i: number) => [...kho.keys()][i] ?? null,
    getItem: (k: string) => kho.get(k) ?? null,
    setItem: (k: string, v: string) => { kho.set(k, String(v)); },
    removeItem: (k: string) => { kho.delete(k); },
    clear: () => kho.clear(),
  },
});

beforeEach(() => {
  phienTra = null;
  getSessionTreo = false;
  soLanGoiGetSession = 0;
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('currentUserId', () => {
  it('lấy id từ sự kiện đăng nhập', async () => {
    const { currentUserId } = await napLai();
    batSuKien!('SIGNED_IN', { user: { id: 'u-1' } });
    await expect(currentUserId()).resolves.toBe('u-1');
  });

  it('sự kiện KHÔNG kèm phiên mà không phải đăng xuất thì KHÔNG nhớ null', async () => {
    // Đây chính là lỗi "Chưa đăng nhập" dù đang đăng nhập.
    const { currentUserId } = await napLai();
    batSuKien!('INITIAL_SESSION', null);

    // Sau đó phiên có thật — phải đọc lại được, không được dính cái null cũ.
    phienTra = { user: { id: 'u-2' } };
    await expect(currentUserId()).resolves.toBe('u-2');
  });

  it('đăng xuất THẬT thì nhớ null', async () => {
    const { currentUserId } = await napLai();
    batSuKien!('SIGNED_IN', { user: { id: 'u-1' } });
    batSuKien!('SIGNED_OUT', null);
    await expect(currentUserId()).resolves.toBeNull();
  });

  it('getSession treo thì đọc localStorage, KHÔNG báo chưa đăng nhập', async () => {
    vi.useFakeTimers();
    localStorage.setItem(KHOA_SB, JSON.stringify({ user: { id: 'u-3' } }));
    getSessionTreo = true;

    const { currentUserId } = await napLai();
    const p = currentUserId();
    await vi.advanceTimersByTimeAsync(3100);
    await expect(p).resolves.toBe('u-3');
  });

  it('đọc được cả dạng cũ currentSession trong localStorage', async () => {
    vi.useFakeTimers();
    localStorage.setItem(KHOA_SB, JSON.stringify({ currentSession: { user: { id: 'u-4' } } }));
    getSessionTreo = true;

    const { currentUserId } = await napLai();
    const p = currentUserId();
    await vi.advanceTimersByTimeAsync(3100);
    await expect(p).resolves.toBe('u-4');
  });

  it('localStorage hỏng thì trả null chứ không nổ', async () => {
    vi.useFakeTimers();
    localStorage.setItem(KHOA_SB, 'không phải JSON');
    getSessionTreo = true;

    const { currentUserId } = await napLai();
    const p = currentUserId();
    await vi.advanceTimersByTimeAsync(3100);
    await expect(p).resolves.toBeNull();
  });

  it('bỏ qua khoá localStorage không phải của Supabase', async () => {
    vi.useFakeTimers();
    localStorage.setItem('linh-tinh', JSON.stringify({ user: { id: 'sai' } }));
    getSessionTreo = true;

    const { currentUserId } = await napLai();
    const p = currentUserId();
    await vi.advanceTimersByTimeAsync(3100);
    await expect(p).resolves.toBeNull();
  });

  it('nhiều nơi hỏi cùng lúc chỉ đọc phiên MỘT lần', async () => {
    // Dashboard gọi bốn lần lúc tải trang, `uploadAsset` gọi một lần MỖI FILE. Không
    // gộp thì mười lời gọi là mười lần xếp hàng chờ khoá — đúng nguồn gốc của treo.
    soLanGoiGetSession = 0;
    phienTra = { user: { id: 'u-5' } };
    const { currentUserId } = await napLai();

    const ra = await Promise.all([currentUserId(), currentUserId(), currentUserId()]);
    expect(ra).toEqual(['u-5', 'u-5', 'u-5']);
    expect(soLanGoiGetSession, 'Ba lời gọi đồng thời phải dùng chung một lần đọc').toBe(1);
  });

  it('quenUserId() buộc đọc lại', async () => {
    const { currentUserId, quenUserId } = await napLai();
    batSuKien!('SIGNED_IN', { user: { id: 'u-6' } });
    await expect(currentUserId()).resolves.toBe('u-6');

    quenUserId();
    phienTra = { user: { id: 'u-7' } };
    await expect(currentUserId()).resolves.toBe('u-7');
  });
});
