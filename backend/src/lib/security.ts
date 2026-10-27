import crypto from 'crypto';

/** Constant-time string comparison (prevents timing attacks on secrets); false when lengths differ. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/** True when a secret env value is usable: set and not the template placeholder. */
export function isSecretConfigured(value: string | undefined): value is string {
  return !!value && value !== 'CHANGE_ME_IN_PRODUCTION';
}

/**
 * Extract the 8-hex user code from bank transfer content ("NGUYEN VAN A CK VIPRO A1B2C3D4 FT26…").
 * Returns the code lowercased, or null when there is no full 8-character code.
 */
export function parseTransferCode(content: string): string | null {
  // Ngân hàng hay bỏ khoảng trắng hoặc nối thêm mã giao dịch phía sau → chỉ lấy đúng 8 ký tự hex sau VIPRO
  const match = content.match(/VIPRO\s*([0-9A-F]{8})/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Bang chu cai cho ma don hang. Bo 0/O/1/I/L vi khach doc tu man hinh roi go tay
 * vao app ngan hang — nham mot ky tu la khong doi soat duoc.
 */
const ORDER_REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Sinh ma don hang duy nhat, dang P + 7 ky tu (vi du P7K3M9Q).
 *
 * Vi sao bat dau bang 'P': ma NGUOI DUNG la 8 ky tu hex (0-9a-f), ma 'P' khong phai
 * ky tu hex, nen hai loai ma khong bao gio lan nhau du cung nam sau chu VIPRO.
 *
 * Ma nay gan voi tung DON HANG chu khong phai tung nguoi: truoc day moi don cua cung
 * mot khach deu co noi dung chuyen khoan giong het nhau, nen webhook khong biet khach
 * dinh mua goi nao va phai doan theo so tien.
 */
export function generateOrderRef(): string {
  let out = 'P';
  for (let i = 0; i < 7; i++) {
    out += ORDER_REF_ALPHABET[Math.floor(Math.random() * ORDER_REF_ALPHABET.length)];
  }
  return out;
}

/** Doc ma don hang tu noi dung chuyen khoan. Tra ve null neu khong co. */
export function parseOrderRef(content: string): string | null {
  const m = String(content ?? '').match(/VIPRO\s*(P[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7})/i);
  return m ? m[1].toUpperCase() : null;
}
