/**
 * Soát render không có chủ: `project_id` rỗng nghĩa là không truy được ai sở hữu.
 *
 * Quyền sở hữu trong Viprosell đi qua `renders.project_id → projects.user_id` — bảng
 * `renders` không có cột `user_id` nào. Nên một dòng render thiếu `project_id` thì:
 *
 *   - Không endpoint nào kiểm được quyền sở hữu của nó.
 *   - Route callback trừ credit trong nhánh `if (project)`, nên nó KHÔNG BỊ TRỪ CREDIT.
 *
 * Script này đếm xem chuyện đó có thật và ở mức nào.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const db = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await db
    .from('renders')
    .select('id, project_id, status, job_type, output_url, created_at, raw_input');
  if (error) throw new Error(error.message);

  const tat = data ?? [];
  const khongChu = tat.filter((r: any) => !r.project_id);
  const xongKhongChu = khongChu.filter((r: any) => r.status === 'completed');

  console.log(`Tong render:            ${tat.length}`);
  console.log(`KHONG co project_id:    ${khongChu.length}`);
  console.log(`  trong do 'completed': ${xongKhongChu.length}  <- da giao video, khong truy duoc chu`);

  if (khongChu.length) {
    console.log('\nChi tiet:');
    for (const r of khongChu.slice(0, 15)) {
      const co = (r as any).output_url ? 'CO video' : 'khong video';
      console.log(`  ${r.id}  ${String(r.status).padEnd(10)} ${co}  ${String(r.created_at).slice(0, 10)}`);
    }
    if (khongChu.length > 15) console.log(`  ... va ${khongChu.length - 15} dong nua`);
  }

  // ── Doi soat credit ──
  //
  // `credit_ledger` KHONG co cot nao giu renderId: cac cot la user_id, project_id,
  // delta, reason, balance_after. renderId chi nam trong `usage_logs.meta.render_id`.
  // Tra theo reference_id se luon ra 0 va trong y nhu he thong khong tru credit.
  const coChu = tat.filter((r: any) => r.project_id && r.status === 'completed');

  const { data: butToan } = await db
    .from('credit_ledger')
    .select('id, delta, reason, created_at')
    .like('reason', 'render_completed%');

  const { data: nhatKy } = await db
    .from('usage_logs')
    .select('id, credits_used, meta')
    .eq('step_name', 'render_credit_deduction');

  console.log(`\n── Doi soat credit ──`);
  console.log(`Render 'completed':                   ${tat.filter((r: any) => r.status === 'completed').length}`);
  console.log(`  trong do co project_id:             ${coChu.length}`);
  console.log(`But toan 'render_completed%':         ${(butToan ?? []).length}`);
  console.log(`Nhat ky 'render_credit_deduction':    ${(nhatKy ?? []).length}`);

  const khopDuoc = new Set(
    (nhatKy ?? []).map((x: any) => x?.meta?.render_id).filter(Boolean),
  );
  const xongMaKhongTru = coChu.filter((r: any) => !khopDuoc.has(r.id));
  console.log(`Render 'completed' KHONG co nhat ky tru: ${xongMaKhongTru.length}`);

  if (xongMaKhongTru.length) {
    console.log('\nNhung render da giao video ma khong tru credit:');
    for (const r of xongMaKhongTru.slice(0, 20)) {
      console.log(`  ${r.id}  ${String(r.created_at).slice(0, 10)}  ${(r as any).output_url ? 'CO video' : 'khong video'}`);
    }
    if (xongMaKhongTru.length > 20) console.log(`  ... va ${xongMaKhongTru.length - 20} dong nua`);
  }

  const tongTru = (butToan ?? []).reduce((t: number, x: any) => t + Math.abs(x.delta ?? 0), 0);
  console.log(`\nTong credit da tru cho render: ${tongTru}`);

  // ── Theo ngay: de biet lo credit la LICH SU hay DANG CHAY ──
  //
  // Day la cau hoi quyet dinh. Ban sua ngay 29/10 doi thu tu: goi callback TRUOC khi
  // ghi 'completed'. Neu moi dong thieu but toan deu o truoc ngay do thi lo da bit;
  // con co dong sau ngay do thi no van dang chay va phai sua tiep.
  console.log('\n── Render completed theo ngay ──');
  const theoNgay = new Map<string, { tru: number; khong: number }>();
  for (const r of tat.filter((x: any) => x.status === 'completed')) {
    const ngay = String((r as any).created_at).slice(0, 10);
    const o = theoNgay.get(ngay) ?? { tru: 0, khong: 0 };
    if (khopDuoc.has((r as any).id)) o.tru += 1; else o.khong += 1;
    theoNgay.set(ngay, o);
  }
  for (const ngay of [...theoNgay.keys()].sort()) {
    const o = theoNgay.get(ngay)!;
    const co = o.khong > 0 ? '  <- co dong KHONG tru' : '';
    console.log(`  ${ngay}   da tru: ${o.tru}   khong tru: ${o.khong}${co}`);
  }

  const ngayHong = [...theoNgay.entries()].filter(([, o]) => o.khong > 0).map(([d]) => d).sort();
  const ngayCuoiHong = ngayHong[ngayHong.length - 1];
  const ngayCuoiCo = [...theoNgay.keys()].sort().pop();
  console.log(
    ngayCuoiHong && ngayCuoiCo && ngayCuoiHong < ngayCuoiCo
      ? `\n=> Dong thieu but toan CUOI CUNG la ${ngayCuoiHong}, con render moi nhat (${ngayCuoiCo}) CO tru. Lo da bit.`
      : `\n=> Dong thieu but toan van xuat hien o ngay moi nhat (${ngayCuoiHong}). LO VAN DANG CHAY.`,
  );
}

main().catch((e) => { console.error('VO:', e.message); process.exit(1); });
