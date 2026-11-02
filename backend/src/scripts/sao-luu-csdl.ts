/**
 * Sao lưu DỮ LIỆU của Supabase ra JSON — không cần mật khẩu CSDL, không cần pg_dump.
 *
 * ── Vì sao script này tồn tại ──
 *
 * Supabase gói Free không có PITR và không có ảnh chụp. Tính tới 02/11/2026 đây là
 * BẢN SAO DUY NHẤT của dữ liệu Viprosell. Spec KVM 4 đặt cửa 2 là "phải khôi phục thử
 * thành công trước khi chuyển dữ liệu thật" — không có dump thì không qua được cửa đó.
 *
 * ── Vì sao JSON mà không phải pg_dump ──
 *
 * `supabase db dump` cần mật khẩu CSDL và hỏi theo kiểu tương tác. Script này chỉ cần
 * service role key đã có trong `.env`, nên chạy được trong cron mà không giữ thêm bí mật.
 *
 * Nó đủ vì SCHEMA đã nằm trong git: 12 migration trong `supabase/migrations/`. Khôi phục
 * = dựng schema từ migration, rồi nạp lại JSON. Hai nửa ghép thành một bản đầy đủ.
 *
 * ⚠️ **Thứ script này KHÔNG bắt được:** mọi thay đổi làm thẳng trên Dashboard mà không
 * qua migration — chính sách RLS, hàm, trigger, chỉ mục sửa tay. Migration cũng không
 * bắt được chúng. Nếu có sửa tay thì phải tự ghi lại thành migration, không có cách nào
 * khác. Đây là lý do nguyên tắc "mọi thay đổi schema đi qua migration" không phải hình thức.
 *
 * Dùng:  npx tsx src/scripts/sao-luu-csdl.ts
 * Ra:    ../Sao luu csdl supabase/<ngày-giờ>/<bảng>.json   (đã gitignore)
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

/** Số dòng lấy mỗi lượt. PostgREST mặc định chặn 1000, nên phải phân trang. */
const MOI_LUOT = 1000;

async function layBang(url: string, key: string): Promise<string[]> {
  const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Khong doc duoc danh sach bang: HTTP ${r.status}`);
  const doc: any = await r.json();
  const defs = doc.definitions ?? doc.components?.schemas ?? {};
  return Object.keys(defs).sort();
}

/** Lấy hết dòng của một bảng, phân trang để không bị chặn ở 1000. */
async function layHet(url: string, key: string, bang: string): Promise<unknown[]> {
  const ra: unknown[] = [];
  for (let tu = 0; ; tu += MOI_LUOT) {
    const r = await fetch(`${url}/rest/v1/${bang}?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${tu}-${tu + MOI_LUOT - 1}`,
        Prefer: 'count=exact',
      },
    });
    // 416 = het dong, khong phai loi.
    if (r.status === 416) break;
    if (!r.ok) throw new Error(`${bang}: HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
    const lo = (await r.json()) as unknown[];
    ra.push(...lo);
    if (lo.length < MOI_LUOT) break;
  }
  return ra;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Thieu SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY trong .env');

  const dau = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const thuMuc = path.resolve(__dirname, '../../..', 'Sao luu csdl supabase', dau);
  fs.mkdirSync(thuMuc, { recursive: true });

  const bang = await layBang(url, key);
  console.log(`${bang.length} bang -> ${thuMuc}\n`);

  let tongDong = 0;
  let tongByte = 0;
  const loi: string[] = [];

  for (const b of bang) {
    try {
      const dong = await layHet(url, key, b);
      const noi = JSON.stringify(dong, null, 1);
      fs.writeFileSync(path.join(thuMuc, `${b}.json`), noi, 'utf8');
      tongDong += dong.length;
      tongByte += Buffer.byteLength(noi);
      console.log(`  ${b.padEnd(28)} ${String(dong.length).padStart(6)} dong`);
    } catch (e: any) {
      loi.push(`${b}: ${e.message}`);
      console.log(`  ${b.padEnd(28)}  LOI — ${e.message.slice(0, 80)}`);
    }
  }

  // Ghi kem mot tep chi dan khoi phuc, de nguoi mo thu muc nay sau nay biet lam gi.
  fs.writeFileSync(
    path.join(thuMuc, 'DOC-TRUOC.md'),
    [
      `# Sao lưu dữ liệu Viprosell — ${dau}`,
      '',
      `Nguồn: ${url}`,
      `Số bảng: ${bang.length} · Số dòng: ${tongDong} · Dung lượng: ${(tongByte / 1024).toFixed(1)} KB`,
      '',
      '## Khôi phục',
      '',
      'Đây là bản sao **dữ liệu**, không phải `pg_dump`. Khôi phục cần hai nửa:',
      '',
      '1. **Schema** — chạy lần lượt các tệp trong `supabase/migrations/` theo thứ tự tên.',
      '2. **Dữ liệu** — nạp từng tệp JSON ở đây vào bảng cùng tên, theo thứ tự phụ thuộc',
      '   khoá ngoại (users trước projects, projects trước renders).',
      '',
      '## Không có trong bản sao này',
      '',
      'Mọi thay đổi làm thẳng trên Dashboard mà không qua migration: chính sách RLS,',
      'hàm, trigger, chỉ mục sửa tay. Migration cũng không có chúng. Đây là lý do mọi',
      'thay đổi schema phải đi qua migration.',
      '',
      loi.length ? `## Bảng lỗi khi sao lưu\n\n${loi.map((x) => `- ${x}`).join('\n')}` : '',
    ].join('\n'),
    'utf8',
  );

  console.log(`\nTong: ${tongDong} dong, ${(tongByte / 1024).toFixed(1)} KB`);
  if (loi.length) {
    console.log(`\n${loi.length} bang LOI:`);
    for (const x of loi) console.log(`  ${x}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('VO:', e.message); process.exit(1); });
