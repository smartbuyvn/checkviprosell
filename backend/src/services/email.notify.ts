/**
 * Viprosell — Gửi thư giao dịch từ các luồng nghiệp vụ
 *
 * Lớp mỏng giữa `email.provider` (gửi) và `email-templates` (nội dung). Nó tồn tại
 * để hai chỗ gọi — webhook thanh toán và callback render — chỉ cần một dòng, và để
 * phần đọc hồ sơ / tính số dư không bị chép hai lần.
 *
 * ── Nguyên tắc duy nhất ──
 *
 * **Email hỏng KHÔNG được làm hỏng đường tiền.** Mọi hàm ở đây nuốt lỗi tại chỗ và
 * trả về `void`. Khách mất một lá thư thì phiền; khách trả tiền mà webhook vỡ vì nhà
 * cung cấp email chết là mất khách.
 *
 * Vì vậy người gọi KHÔNG `await` để chặn đường chính — và cũng không cần `try/catch`.
 */
import { createClient } from '@supabase/supabase-js';
import { sendEmail, emailEnabled, looksLikeEmail } from './email.provider';
import { thuThanhToanThanhCong, thuVideoDaXong, thuRutHoaHong } from '../lib/email-templates';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

/** Gốc đường dẫn cho các nút trong thư. */
function goc(): string {
  return (process.env.VITE_APP_BASE_URL || 'https://v.ninhle.com').replace(/\/+$/, '');
}

/**
 * Email của một người dùng, hoặc null.
 *
 * Đọc từ `profiles` chứ không từ `auth.users`: bảng profiles là thứ các luồng nghiệp
 * vụ đã truy sẵn, và nó có RLS riêng nên service role đọc được bình thường.
 */
async function emailCuaNguoiDung(userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle();
  const e = (data as any)?.email;
  return looksLikeEmail(e) ? String(e) : null;
}

/** Số dư credit hiện tại, cộng dồn delta. Hỏng thì trả 0 chứ không ném. */
async function soDuCredit(userId: string): Promise<number> {
  const { data, error } = await supabase.from('credit_ledger').select('delta').eq('user_id', userId);
  if (error) return 0;
  return ((data ?? []) as any[]).reduce((t, r) => t + (r.delta || 0), 0);
}

export interface ThongBaoThanhToan {
  userId: string;
  tenGoi: string;
  soTien: number;
  creditNhan: number;
  /** Credit thưởng vì có người giới thiệu. 0 nghĩa là không có. */
  creditThuong?: number;
}

/**
 * Báo khách rằng thanh toán đã xong và credit đã vào tài khoản.
 *
 * Gọi SAU khi `grantToLedger` thành công — không bao giờ gọi trước, vì thư này nói
 * "credit đã vào tài khoản" và nói sai thì tệ hơn không nói.
 */
export async function baoThanhToanXong(tb: ThongBaoThanhToan): Promise<void> {
  try {
    if (!emailEnabled()) return;

    const email = await emailCuaNguoiDung(tb.userId);
    if (!email) return;

    const thu = thuThanhToanThanhCong({
      tenGoi: tb.tenGoi,
      soTien: tb.soTien,
      creditNhan: tb.creditNhan,
      creditThuong: tb.creditThuong,
      soDuSau: await soDuCredit(tb.userId),
      linkBangDieuKhien: `${goc()}/dashboard`,
    });

    const kq = await sendEmail({ to: email, subject: thu.subject, html: thu.html });
    if (!kq.sent) console.warn(`[Email] Khong gui duoc thu thanh toan cho ${tb.userId}: ${kq.error}`);
  } catch (err: any) {
    // Nuot tai cho: day la duong tien, mot la thu khong duoc phep lam vo no.
    console.warn(`[Email] Loi khi gui thu thanh toan: ${err?.message ?? err}`);
  }
}

export interface ThongBaoVideo {
  userId: string;
  tenVideo: string;
  linkVideo: string;
  soCreditDaTru: number;
  /** Số ngày video còn được giữ trên máy chủ. */
  soNgayLuu?: number;
}

/** Báo khách video đã dựng xong. Gọi sau khi đã trừ credit và ghi `completed`. */
export async function baoVideoXong(tb: ThongBaoVideo): Promise<void> {
  try {
    if (!emailEnabled()) return;

    const email = await emailCuaNguoiDung(tb.userId);
    if (!email) return;

    const thu = thuVideoDaXong({
      tenVideo: tb.tenVideo,
      linkVideo: tb.linkVideo,
      soCreditDaTru: tb.soCreditDaTru,
      soDuSau: await soDuCredit(tb.userId),
      soNgayLuu: tb.soNgayLuu ?? 30,
    });

    const kq = await sendEmail({ to: email, subject: thu.subject, html: thu.html });
    if (!kq.sent) console.warn(`[Email] Khong gui duoc thu video cho ${tb.userId}: ${kq.error}`);
  } catch (err: any) {
    console.warn(`[Email] Loi khi gui thu video: ${err?.message ?? err}`);
  }
}

export interface ThongBaoRut {
  userId: string;
  soTien: number;
  trangThai: 'requested' | 'approved' | 'paid' | 'rejected';
  ghiChu?: string;
}

/** Báo trạng thái yêu cầu rút hoa hồng. */
export async function baoRutHoaHong(tb: ThongBaoRut): Promise<void> {
  try {
    if (!emailEnabled()) return;

    const email = await emailCuaNguoiDung(tb.userId);
    if (!email) return;

    const thu = thuRutHoaHong({
      soTien: tb.soTien,
      trangThai: tb.trangThai,
      ghiChu: tb.ghiChu,
      linkDoiTac: `${goc()}/affiliate`,
    });

    const kq = await sendEmail({ to: email, subject: thu.subject, html: thu.html });
    if (!kq.sent) console.warn(`[Email] Khong gui duoc thu rut tien cho ${tb.userId}: ${kq.error}`);
  } catch (err: any) {
    console.warn(`[Email] Loi khi gui thu rut tien: ${err?.message ?? err}`);
  }
}
