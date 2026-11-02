/**
 * Thử luồng tiền đầu-cuối trên backend đang chạy thật.
 *
 * Vì sao phải có: luồng tiền là phần hệ trọng nhất của sản phẩm và trước 29/10 nó
 * KHÔNG có một test nào. Lỗi đã tìm thấy bằng mắt (webhook gọi `grantToLedger` rồi
 * không đọc kết quả) là loại lỗi mà chỉ chạy thật mới lộ ra chắc chắn.
 *
 * Năm phép thử, mỗi phép một rủi ro tiền thật:
 *   1. Trả đủ         → đơn thành 'paid', credit cộng ĐÚNG số của gói
 *   2. Gửi lại y hệt  → chặn trùng, KHÔNG cộng thêm lần nữa
 *   3. Trả thiếu      → giữ 'pending', KHÔNG cộng credit
 *   4. Trả thừa       → cộng thêm theo đúng đơn giá, không nuốt phần thừa
 *   5. Sai chữ ký     → từ chối 401
 *
 * Tự dọn sạch sau khi chạy: mọi dòng ledger, đơn hàng và khoá chống trùng do bài
 * thử sinh ra đều bị xoá, nên số dư tài khoản thử về đúng như trước.
 *
 * Chạy: npx tsx src/scripts/thu-thanh-toan.ts [email-tai-khoan-thu]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const API = process.env.TEST_API_BASE || 'http://localhost:3001/api/v1';
const EMAIL_MAC_DINH = 'test.viprosell@gmail.com';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function maDon(): string {
  let out = 'P';
  for (let i = 0; i < 7; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/** Số dư theo cách backend tính: cộng dồn delta. */
async function soDu(userId: string): Promise<number> {
  const { data } = await sb.from('credit_ledger').select('delta').eq('user_id', userId);
  return ((data ?? []) as any[]).reduce((t, r) => t + (r.delta || 0), 0);
}

/** Tạo một đơn treo giống hệt đường `/billing/checkout` tạo ra. */
async function taoDonTreo(userId: string, planCode: string, soTien: number) {
  const ref = maDon();
  const { data, error } = await sb.from('payments').insert({
    idempotency_key: `checkout_${ref}`,
    user_id: userId,
    provider: 'sepay',
    provider_txn_id: `pending_${ref}`,
    order_type: 'plan_subscription',
    plan_code: planCode,
    amount: soTien,
    currency: 'VND',
    status: 'pending',
    meta: { expected_content: `VIPRO ${ref}`, ref_code: ref },
  }).select('id').single();
  if (error) throw new Error(`Tao don that bai: ${error.message}`);
  return { ref, id: (data as any).id as string };
}

/** Gọi webhook SePay y như nhà cung cấp gọi. */
async function goiWebhook(ref: string, soTien: number, sepayId: number, apikey?: string) {
  const res = await fetch(`${API}/webhooks/sepay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Apikey ${apikey ?? process.env.SEPAY_WEBHOOK_SECRET}`,
    },
    body: JSON.stringify({
      id: sepayId,
      transferType: 'in',
      transferAmount: soTien,
      content: `VIPRO ${ref}`,
      referenceCode: `TEST${sepayId}`,
    }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function trangThaiDon(id: string): Promise<string> {
  const { data } = await sb.from('payments').select('status').eq('id', id).maybeSingle();
  return (data as any)?.status ?? '(mat tieu)';
}

/* ─────────────────────────── chạy ─────────────────────────── */

const rac = { don: [] as string[], khoa: [] as string[] };
let dat = 0, truot = 0;

function kiemTra(ten: string, dung: boolean, chiTiet: string) {
  if (dung) { dat++; console.log(`  PASS  ${ten}`); }
  else { truot++; console.log(`  FAIL  ${ten}\n          ${chiTiet}`); }
}

async function main() {
  const email = process.argv[2] || EMAIL_MAC_DINH;

  if (!process.env.SEPAY_WEBHOOK_SECRET) {
    console.error('Thieu SEPAY_WEBHOOK_SECRET trong .env — webhook se tra 503, khong thu duoc.');
    process.exit(1);
  }

  const { data: hs } = await sb.from('profiles').select('id, email, referred_by')
    .eq('email', email).maybeSingle();
  if (!hs) { console.error(`Khong co tai khoan ${email}`); process.exit(1); }
  const userId = (hs as any).id as string;
  const coNguoiGioiThieu = Boolean((hs as any).referred_by);

  const { data: goi } = await sb.from('plans').select('code, credits, price')
    .eq('code', 'starter').maybeSingle();
  if (!goi) { console.error('Khong doc duoc goi starter'); process.exit(1); }
  const giaGoi = Math.round(Number((goi as any).price));
  const creditGoi = Number((goi as any).credits);

  // Khách có người giới thiệu được cộng thêm 10% — phải tính vào kỳ vọng, nếu không
  // bài thử sẽ báo sai ở đúng những tài khoản dùng link giới thiệu.
  const nhan = (c: number) => (coNguoiGioiThieu ? Math.floor(c * 1.1) : c);

  console.log(`Tai khoan : ${email}`);
  console.log(`Goi thu   : starter — ${creditGoi} credit, ${giaGoi}d` +
    (coNguoiGioiThieu ? '  (co nguoi gioi thieu: +10%)' : ''));

  const duBanDau = await soDu(userId);
  console.log(`So du dau : ${duBanDau} credit\n`);

  try {
    /* 1. Trả đủ */
    console.log('1) Tra du tien');
    const a = await taoDonTreo(userId, 'starter', giaGoi);
    rac.don.push(a.id); rac.khoa.push(`sepay_900001_TEST900001`);
    const r1 = await goiWebhook(a.ref, giaGoi, 900001);
    const du1 = await soDu(userId);
    kiemTra('webhook tra 200', r1.status === 200, `nhan ${r1.status}`);
    kiemTra('don chuyen sang paid', (await trangThaiDon(a.id)) === 'paid',
      `trang thai = ${await trangThaiDon(a.id)}`);
    kiemTra(`cong dung ${nhan(creditGoi)} credit`, du1 - duBanDau === nhan(creditGoi),
      `cong ${du1 - duBanDau}, mong doi ${nhan(creditGoi)}`);

    /* 2. Gửi lại y hệt */
    console.log('\n2) SePay gui lai y het (chong trung)');
    const r2 = await goiWebhook(a.ref, giaGoi, 900001);
    const du2 = await soDu(userId);
    kiemTra('bi chan vi trung', r2.body?.idempotent_stop === true,
      `body = ${JSON.stringify(r2.body)}`);
    kiemTra('KHONG cong them lan hai', du2 === du1, `so du ${du1} -> ${du2}`);

    /* 3. Trả thiếu */
    console.log('\n3) Tra thieu tien');
    const b = await taoDonTreo(userId, 'starter', giaGoi);
    rac.don.push(b.id); rac.khoa.push(`sepay_900002_TEST900002`);
    const thieu = Math.floor(giaGoi * 0.5);
    await goiWebhook(b.ref, thieu, 900002);
    const du3 = await soDu(userId);
    kiemTra('giu nguyen pending', (await trangThaiDon(b.id)) === 'pending',
      `trang thai = ${await trangThaiDon(b.id)}`);
    kiemTra('KHONG cong credit', du3 === du2, `so du ${du2} -> ${du3}`);

    /* 4. Trả thừa */
    console.log('\n4) Tra thua tien');
    const c = await taoDonTreo(userId, 'starter', giaGoi);
    rac.don.push(c.id); rac.khoa.push(`sepay_900003_TEST900003`);
    const donGia = giaGoi / creditGoi;
    const thua = giaGoi + Math.round(donGia * 5);
    await goiWebhook(c.ref, thua, 900003);
    const du4 = await soDu(userId);
    const mongDoi = nhan(creditGoi + Math.floor((thua - giaGoi) / donGia));
    kiemTra(`cong them phan thua (mong doi ${mongDoi})`, du4 - du3 === mongDoi,
      `cong ${du4 - du3}, mong doi ${mongDoi}`);

    /* 5. Sai chữ ký */
    console.log('\n5) Sai chu ky');
    const d = await taoDonTreo(userId, 'starter', giaGoi);
    rac.don.push(d.id);
    const r5 = await goiWebhook(d.ref, giaGoi, 900004, 'sai-be-bet');
    const du5 = await soDu(userId);
    kiemTra('tu choi 401', r5.status === 401, `nhan ${r5.status}`);
    kiemTra('KHONG cong credit', du5 === du4, `so du ${du4} -> ${du5}`);

  } finally {
    /* Dọn sạch */
    console.log('\n--- Don dep ---');
    for (const id of rac.don) {
      await sb.from('credit_ledger').delete().eq('payment_id', id);
      await sb.from('affiliate_events').delete().eq('payment_id', id);
      await sb.from('payments').delete().eq('id', id);
    }
    for (const k of rac.khoa) await sb.from('idempotency_keys').delete().eq('idempotency_key', k);

    const { data: hs2 } = await sb.from('profiles').select('id').eq('email', email).maybeSingle();
    const cuoi = await soDu((hs2 as any).id);
    console.log(`So du sau khi don: ${cuoi} credit (ban dau ${duBanDau})`);
    if (cuoi !== duBanDau) console.warn('  CANH BAO: so du chua ve nhu cu — con rac trong ledger.');

    console.log(`\n=== ${dat} dat / ${truot} truot ===`);
    process.exit(truot > 0 ? 1 : 0);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
