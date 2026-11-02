/**
 * Canh: mã chỉ được dùng trạng thái CÓ THẬT trong enum `render_status`.
 *
 * ── Vì sao cần canh cả cây mã ──
 *
 * Đã có một test canh việc này, nhưng nó chỉ đọc `lib/storage-purge.ts`. Vì thế
 * hai lỗi sống vẫn nằm yên tới ngày 01/11/2026, khi quét rộng mới thấy:
 *
 *   - `routes/admin.ts` hỏi `.in('status', ['failed', 'retryable_failed'])` trên
 *     bảng `renders`. Postgres từ chối CẢ CÂU, nên `/failed-jobs` và
 *     `/usage-summary` chưa bao giờ trả được dữ liệu.
 *   - `routes/render.ts` GHI `status: 'deleted_pending_cleanup'` khi dự án bị xoá.
 *     Lệnh thất bại mỗi lần chạy, và vì không ai đọc `error` nên render của dự án
 *     đã xoá giữ nguyên trạng thái cũ mãi mãi.
 *
 * Hỏi thẳng Postgres ngày 01/11 để khỏi suy đoán:
 *   deleted_pending_cleanup → invalid input value for enum render_status
 *   retryable_failed        → invalid input value for enum render_status
 *   exported                → invalid input value for enum render_status
 *
 * Cả ba đến từ `src/queues/job-types.ts`, một bộ trạng thái tưởng tượng thời BullMQ.
 * Tệp đó đã xoá, nhưng các chuỗi chép ra từ nó thì nằm rải khắp nơi.
 *
 * Quét sau khi BỎ CHÚ THÍCH: chính các tệp này có chú thích giải thích lỗi cũ, trong
 * đó chứa các chuỗi sai. Quét thẳng thì test đỏ vì chính lời giải thích.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Enum thật, gồm cả 'pending' thêm ở migration 20261027000002. */
const HOP_LE = ['pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'];

/**
 * Các trạng thái TƯỞNG TƯỢNG đã từng lọt vào mã. Không giá trị nào trong đây là
 * trạng thái hợp lệ của bảng khác, nên thấy ở đâu cũng là sai.
 */
const CAM = [
  'exported',
  'retryable_failed',
  'deleted_pending_cleanup',
  'preview_ready',
  'composing',
];

const GOC = join(__dirname, '..', 'src');

function moiTepTs(thuMuc: string): string[] {
  const ra: string[] = [];
  for (const ten of readdirSync(thuMuc)) {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) ra.push(...moiTepTs(duong));
    else if (ten.endsWith('.ts')) ra.push(duong);
  }
  return ra;
}

/** Bỏ chú thích khối và chú thích dòng, giữ nguyên xuống dòng. */
function boChuThich(nguon: string): string {
  return nguon
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, p1) => p1);
}

function quetMa(): Array<{ ten: string; ma: string }> {
  return moiTepTs(GOC).map((duong) => ({
    ten: duong.slice(GOC.length + 1).replace(/\\/g, '/'),
    ma: boChuThich(readFileSync(duong, 'utf8')),
  }));
}

test('khong con trang thai tuong tuong nao trong ma', () => {
  const pham: string[] = [];
  for (const { ten, ma } of quetMa()) {
    for (const xau of CAM) {
      if (ma.includes(`'${xau}'`) || ma.includes(`"${xau}"`)) {
        pham.push(`${ten}: '${xau}'`);
      }
    }
  }
  assert.deepEqual(pham, [], `Trang thai khong co trong enum render_status:\n  ${pham.join('\n  ')}`);
});

test('moi truy van tren bang renders chi dung trang thai co that', () => {
  const pham: string[] = [];

  for (const { ten, ma } of quetMa()) {
    // Chi xet doan ma NGAY SAU `from('renders')` — de khong bat nham `status` cua
    // payments ('paid'), projects ('analyzing'), hay cua health check ('up'/'down').
    for (const m of ma.matchAll(/from\(\s*['"]renders['"]\s*\)/g)) {
      const doan = ma.slice(m.index!, m.index! + 500);

      for (const q of doan.matchAll(/\.(?:eq|in|neq)\(\s*['"]status['"]\s*,\s*([^)]+)\)/g)) {
        for (const g of String(q[1]).matchAll(/['"]([a-z_]+)['"]/g)) {
          if (!HOP_LE.includes(g[1])) pham.push(`${ten}: .eq/.in('status', '${g[1]}')`);
        }
      }
      // Chi xet `status:` nam trong .update({...}) hoac .insert({...}).
      // `return { status: 'not_found' }` la gia tri tra ve cua API, khong phai lenh
      // ghi — bat ca no thi test do vi mot thu hoan toan dung.
      for (const w of doan.matchAll(/\.(?:update|insert|upsert)\(\s*\{/g)) {
        const than = doan.slice(w.index!, w.index! + 400);
        for (const q of than.matchAll(/\bstatus:\s*['"]([a-z_]+)['"]/g)) {
          if (!HOP_LE.includes(q[1])) pham.push(`${ten}: ghi status: '${q[1]}'`);
        }
      }
    }
  }

  assert.deepEqual(pham, [], `Truy van renders dung trang thai sai:\n  ${pham.join('\n  ')}`);
});

test('src/queues da bi xoa — do la nguon cua bo trang thai tuong tuong', () => {
  let conSong = true;
  try {
    statSync(join(GOC, 'queues'));
  } catch {
    conSong = false;
  }
  assert.equal(conSong, false, 'src/queues/ da quay lai — do la ma chet tu thoi BullMQ');
});

test('bo chu thich hoat dong dung, khong an nham ma that', () => {
  // Phep kiem cua chinh phep kiem: boChuThich an nham thi ba test tren xanh gia.
  const thu = [
    "const a = 1; // status: 'exported'",
    "/* status: 'exported' */",
    "const b = { status: 'completed' };",
  ].join('\n');
  const sach = boChuThich(thu);
  assert.doesNotMatch(sach, /exported/, 'Chu thich chua bi bo');
  assert.match(sach, /status: 'completed'/, 'Da an nham ma that');
});
