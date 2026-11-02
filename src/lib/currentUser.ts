import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/lib/errorUtils';

/**
 * Id của người đang đăng nhập, null khi chưa đăng nhập.
 *
 * ── Vì sao mọi truy vấn "của tôi" phải gọi hàm này ──
 *
 * Không được tin RLS lọc hộ: chính sách "Admins read all projects" cố tình trả về
 * hàng của mọi user cho tài khoản admin, nên một truy vấn thiếu điều kiện `user_id`
 * sẽ đem dữ liệu của khách ra hiện trong trang cá nhân của admin — đã xảy ra ngày
 * 29/10/2026: dashboard hiện 10 video, chỉ 2 là của chủ tài khoản.
 *
 * ── Vì sao KHÔNG đi hỏi `getSession()` ──
 *
 * `supabase.auth.getSession()` giành một khoá dùng chung (navigator.locks) và nó
 * TREO VÔ HẠN khi khoá bị giữ. Đo thật ngày 29/10 trên production, console in:
 *
 *     [Auth] getSession() timed out after 3s — resolving with no session
 *
 * `useAuth` đã sống chung với chuyện này bằng `Promise.race` kèm timeout 3 giây, còn
 * tầng service thì không — nên nút "Lưu & Tải lên…" quay mãi, không báo lỗi, không
 * ghi được dòng nào xuống CSDL. Promise treo không phải là lỗi, nên `try/catch`
 * không bắt được.
 *
 * Cách giải: lấy id từ CHÍNH SỰ KIỆN đăng nhập. `onAuthStateChange` đưa thẳng
 * `session` vào callback — không đọc kho lưu trữ, không giành khoá, không treo. Sự
 * kiện `INITIAL_SESSION` bắn ngay lúc trang nạp xong, nên gần như lúc nào cũng có
 * sẵn id trước khi người dùng kịp bấm gì.
 *
 * `getSession()` chỉ còn là đường lui cho khoảnh khắc chưa có sự kiện nào — và
 * đường lui đó giờ có timeout riêng.
 */

/** `undefined` = chưa biết. `null` = đã biết, không có ai đăng nhập. */
let daNho: string | null | undefined;

/** Lời gọi đang dang dở, để nhiều nơi hỏi cùng lúc dùng chung một lần đọc. */
let dangDoc: Promise<string | null> | null = null;

/**
 * Chờ tối đa bao lâu cho đường lui `getSession()`.
 *
 * Bằng mức `useAuth` đang dùng. Hết giờ thì coi như chưa đăng nhập — thà báo "Chưa
 * đăng nhập" để người dùng đăng nhập lại, còn hơn quay vô tận không nói gì.
 */
const HET_GIO_MS = 3000;

// Lấy id thẳng từ sự kiện. Đây là đường chính, `getSession()` chỉ là dự phòng.
supabase.auth.onAuthStateChange((suKien, session) => {
  const id = session?.user?.id ?? null;

  if (id) {
    daNho = id;
  } else if (suKien === 'SIGNED_OUT') {
    // Đăng xuất thật: nhớ `null` là đúng.
    daNho = null;
  } else {
    // Sự kiện không kèm phiên mà KHÔNG phải đăng xuất — ví dụ `INITIAL_SESSION` bắn
    // trước khi đọc xong kho lưu trữ, hay một lần làm mới token đang dở.
    //
    // Nhớ `null` ở đây là sai, và đã gây lỗi thật ngày 29/10: số dư nạp được lúc vào
    // trang (nên rõ ràng có phiên), nhưng tới lúc bấm Render thì báo "Chưa đăng
    // nhập". Vì `daNho !== undefined` chặn đường đọc lại, cái `null` đó dính vĩnh
    // viễn cho tới khi tải lại trang.
    //
    // `undefined` nghĩa là CHƯA BIẾT — lần hỏi sau sẽ đọc lại phiên.
    daNho = undefined;
  }

  dangDoc = null;
});

/**
 * Đọc id thẳng từ phiên Supabase lưu trong localStorage.
 *
 * Đây là đường cuối, dùng khi sự kiện chưa bắn và `getSession()` hết giờ. Đọc
 * localStorage là thao tác đồng bộ, không qua khoá nào, nên nó KHÔNG THỂ treo — đúng
 * thứ cần khi mọi đường khác đã kẹt.
 *
 * Supabase lưu phiên dưới khoá dạng `sb-<mã-dự-án>-auth-token`. Quét theo khuôn thay
 * vì viết cứng mã dự án: đổi dự án mà quên sửa chỗ này thì nó hỏng âm thầm.
 *
 * KHÔNG kiểm hạn token ở đây. Token hết hạn vẫn cho biết ĐANG LÀ AI, và đó là tất cả
 * những gì hàm này cần — việc làm mới token là của supabase-js. Từ chối vì token cũ
 * là quay lại đúng lỗi "Chưa đăng nhập" mà ta đang sửa.
 */
function idTuLocalStorage(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const khoa = localStorage.key(i);
      if (!khoa || !/^sb-.*-auth-token$/.test(khoa)) continue;
      const tho = localStorage.getItem(khoa);
      if (!tho) continue;
      const phien = JSON.parse(tho);
      const id = phien?.user?.id ?? phien?.currentSession?.user?.id;
      if (typeof id === 'string' && id) return id;
    }
  } catch {
    // localStorage bị chặn, hoặc JSON hỏng. Không có gì để làm ngoài bỏ qua.
  }
  return null;
}

export async function currentUserId(): Promise<string | null> {
  if (daNho !== undefined) return daNho;
  if (dangDoc) return dangDoc;

  dangDoc = (async () => {
    try {
      const session = await Promise.race([
        getSessionSafe(supabase),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            console.warn('[Auth] currentUserId: getSession() quá 3 giây — coi như chưa đăng nhập');
            resolve(null);
          }, HET_GIO_MS)
        ),
      ]);

      // Đường cuối: `getSession()` hết giờ thì đọc thẳng localStorage.
      const id = session?.user?.id ?? idTuLocalStorage();

      // CHỈ nhớ khi đọc được thật. Nhớ `null` do hết giờ sẽ khoá người dùng ở trạng
      // thái "chưa đăng nhập" cho tới khi tải lại trang, dù họ đã đăng nhập rồi.
      if (id) daNho = id;
      return id;
    } finally {
      dangDoc = null;
    }
  })();

  return dangDoc;
}

/** Quên id đã nhớ. Dùng khi cần đọc lại phiên ngay. */
export function quenUserId(): void {
  daNho = undefined;
  dangDoc = null;
}
