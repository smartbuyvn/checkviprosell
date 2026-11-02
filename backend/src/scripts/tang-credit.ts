/**
 * Cấp credit thử nghiệm cho một tài khoản, không qua thanh toán.
 *
 * Dùng khi chủ hệ thống cần credit để tự kiểm thử sản phẩm. Ghi thẳng vào
 * `credit_ledger` bằng service role, giống hệt đường mà webhook thanh toán đi, chỉ
 * khác `reason` và không có `payment_id`.
 *
 * Vì sao không đụng tới bảng `payments`: doanh thu được tính từ `payments`, nên tạo
 * một dòng thanh toán giả sẽ làm sai báo cáo tiền. Ledger không vào doanh thu, nên
 * cấp ở đây là sạch về sổ sách.
 *
 * Cách chạy:
 *   npx tsx src/scripts/tang-credit.ts <email> <so-credit>
 *   npx tsx src/scripts/tang-credit.ts smartbuysaigon@gmail.com 50
 *
 * Bắt buộc truyền đủ hai tham số — không có giá trị mặc định, để không ai lỡ tay
 * chạy rồi tự hỏi credit ở đâu ra.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Lý do ghi vào sổ. Giữ nguyên chuỗi này để sau còn lọc ra được các lần cấp thử. */
const LY_DO = 'admin_grant_test';

/** Số dư theo cách backend tính: cộng dồn mọi delta. */
async function soDuTheoDelta(userId: string): Promise<number> {
  const { data, error } = await sb.from('credit_ledger').select('delta').eq('user_id', userId);
  if (error) throw new Error(`Doc so du that bai: ${error.message}`);
  return (data ?? []).reduce((t, r: any) => t + (r.delta || 0), 0);
}

/** Số dư theo cách giao diện đọc: balance_after của dòng mới nhất. */
async function soDuTheoDongCuoi(userId: string): Promise<number | null> {
  const { data } = await sb
    .from('credit_ledger')
    .select('balance_after')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  const dong = (data ?? [])[0] as any;
  return dong ? dong.balance_after : null;
}

async function main() {
  const [email, soText] = process.argv.slice(2);
  if (!email || !soText) {
    console.error('Dung: npx tsx src/scripts/tang-credit.ts <email> <so-credit>');
    process.exit(1);
  }

  const soCredit = Number(soText);
  if (!Number.isInteger(soCredit) || soCredit <= 0) {
    console.error(`So credit phai la so nguyen duong, nhan duoc: ${soText}`);
    process.exit(1);
  }

  const { data: hoSo, error: loiHoSo } = await sb
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();
  if (loiHoSo) { console.error(`Tim tai khoan that bai: ${loiHoSo.message}`); process.exit(1); }
  if (!hoSo) { console.error(`Khong co tai khoan nao voi email ${email}`); process.exit(1); }

  const userId = (hoSo as any).id as string;
  const truoc = await soDuTheoDelta(userId);

  const { error } = await sb.from('credit_ledger').insert({
    user_id: userId,
    delta: soCredit,
    reason: LY_DO,
    balance_after: truoc + soCredit,
  });
  if (error) { console.error(`Ghi so that bai: ${error.message}`); process.exit(1); }

  const sau = await soDuTheoDelta(userId);
  const theoDongCuoi = await soDuTheoDongCuoi(userId);

  console.log(`Tai khoan : ${email}`);
  console.log(`Cap them  : +${soCredit} credit (ly do: ${LY_DO})`);
  console.log(`So du     : ${truoc} -> ${sau}`);

  // Backend cong don delta, giao dien doc balance_after cua dong moi nhat. Hai cach
  // chi trung nhau khi moi lan ghi deu tinh dung so du truoc do. Doi chieu ngay tai
  // day de phat hien som neu so sach lech.
  if (theoDongCuoi !== sau) {
    console.warn(
      `\nCANH BAO: hai cach tinh so du khong khop.\n` +
      `  cong don delta        = ${sau}\n` +
      `  balance_after dong cuoi = ${theoDongCuoi}\n` +
      `  Giao dien se hien ${theoDongCuoi}, backend tru theo ${sau}.`
    );
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
