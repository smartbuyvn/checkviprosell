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
