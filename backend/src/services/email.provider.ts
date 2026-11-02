/**
 * Viprosell — Gửi email giao dịch
 *
 * Nguyên tắc số một: **email hỏng KHÔNG được làm hỏng đường tiền.**
 *
 * Webhook thanh toán cấp credit trước, gửi email sau, và mọi lỗi gửi đều bị nuốt tại
 * chỗ. Khách mất một lá thư thì phiền; khách trả tiền mà không được cấp credit vì nhà
 * cung cấp email chết là mất khách.
 *
 * Dùng `fetch` thẳng thay vì SDK: Resend chỉ là một lần POST JSON, thêm một thư viện
 * vào đây chỉ để gói một lời gọi HTTP là trả giá bảo trì cho không.
 *
 * Tắt mặc định. Chưa đặt `RESEND_API_KEY` thì `sendEmail` trả về `{sent:false}` ngay,
 * không ném lỗi — hệ thống chạy y như trước khi có email.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Bản chữ thuần cho trình đọc không hiện HTML. Thiếu thì suy từ HTML. */
  text?: string;
}

export interface EmailResult {
  sent: boolean;
  id?: string;
  error?: string;
}

/** Hệ thống có đang bật gửi email không. */
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && senderAddress());
}

/**
 * Địa chỉ người gửi.
 *
 * Phải là tên miền đã xác minh ở nhà cung cấp, nếu không thư vào thẳng hộp rác — hoặc
 * bị từ chối. Để trống thì coi như chưa bật email.
 */
export function senderAddress(): string {
  return (process.env.EMAIL_FROM || '').trim();
}

/** Bỏ thẻ HTML để lấy bản chữ thuần. Thô nhưng đủ cho thư giao dịch. */
export function htmlToText(html: string): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Địa chỉ trông hợp lệ không. Chặn sớm để không tốn một lần gọi mạng vô ích. */
export function looksLikeEmail(v: string | null | undefined): boolean {
  const s = String(v ?? '').trim();
  // Không cố bắt đúng RFC 5322 — việc đó bất khả thi và không cần: thứ cần chặn là
  // chuỗi rỗng, thiếu @, thiếu tên miền, và khoảng trắng.
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(s);
}

/**
 * Gửi một lá thư. KHÔNG BAO GIỜ ném lỗi.
 *
 * Người gọi nằm trong luồng thanh toán hoặc luồng render; một `throw` ở đây sẽ làm
 * hỏng việc quan trọng hơn nhiều so với lá thư.
 */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  if (!emailEnabled()) return { sent: false, error: 'EMAIL_DISABLED' };
  if (!looksLikeEmail(msg.to)) return { sent: false, error: 'BAD_RECIPIENT' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: senderAddress(),
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text || htmlToText(msg.html),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // Chỉ lấy phần đầu phản hồi: thân lỗi của nhà cung cấp có thể dài, và không có
      // lý do gì đổ hết vào log.
      const than = (await res.text().catch(() => '')).slice(0, 200);
      console.warn(`[Email] Gui that bai HTTP ${res.status}: ${than}`);
      return { sent: false, error: `HTTP_${res.status}` };
    }

    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    return { sent: true, id: data?.id };
  } catch (err: any) {
    console.warn(`[Email] Gui that bai: ${err?.message ?? 'loi khong ro'}`);
    return { sent: false, error: 'NETWORK' };
  }
}
