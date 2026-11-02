/**
 * Chứng minh `tru_credit_render()` thật sự nguyên tử và một-lần.
 *
 * ── ⚠️ Script này GHI VÀO BẢNG TIỀN. Đọc hết phần này trước khi chạy. ──
 *
 * Nó dùng một `user_id` là UUID ngẫu nhiên — **không phải người dùng thật nào** — nên
 * không bút toán nào chạm vào số dư của khách. Mọi dòng tạo ra đều bị xoá ở cuối, kể cả
 * khi script lỗi giữa chừng (khối `finally`).
 *
 * Nếu `credit_ledger.user_id` hoặc `usage_logs.user_id` có khoá ngoại tới `auth.users`
 * thì lệnh chèn sẽ bị từ chối. Script phát hiện và dừng gọn, KHÔNG báo là hàm sai.
 *
 * ── Vì sao phải thử trên Postgres thật ──
 *
 * `tests/tru-credit-nguyen-tu.test.ts` canh phần quyết định lùi-hay-không bằng dữ liệu
 * giả. Nhưng điều quan trọng nhất — `pg_advisory_xact_lock` có thật sự tuần tự hoá hai
 * lần trừ đồng thời không, và chỉ mục duy nhất có thật sự chặn trừ hai lần không — là
 * hành vi của Postgres. Dữ liệu giả không chứng minh được.
 *
 * Dùng:  npx tsx src/scripts/thu-tru-credit.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SO_CAP = 10;      // Credit cap cho nguoi dung thu
const SO_MOI_LAN = 4;   // Moi lan tru 4 -> dung 2 lan thanh cong, lan thu 3 phai bi tu choi
const SO_DONG_THOI = 5; // Nam lan tru cung luc, moi lan mot render khac nhau

let soDat = 0;
let soHong = 0;
function kiem(ten: string, dat: boolean, chiTiet = '') {
  if (dat) { soDat += 1; console.log(`  OK   ${ten}`); }
  else { soHong += 1; console.log(`  HONG ${ten}${chiTiet ? ' — ' + chiTiet : ''}`); }
}

async function main() {
  const db = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const userThu = randomUUID();
  const renders = Array.from({ length: SO_DONG_THOI }, () => randomUUID());
  console.log(`Nguoi dung thu: ${userThu} (UUID ngau nhien, khong phai khach that)\n`);

  try {
    // ── 0. Cap credit ban dau ──
    const { error: eCap } = await db.from('credit_ledger').insert({
      user_id: userThu, delta: SO_CAP, reason: 'thu_nghiem_cap', balance_after: SO_CAP,
    });
    if (eCap) {
      console.log(`Khong cap duoc credit cho nguoi dung thu: ${eCap.message}`);
      console.log('Rat co the credit_ledger.user_id co khoa ngoai toi auth.users.');
      console.log('=> KHONG ket luan duoc gi ve ham. Can mot nguoi dung that de thu.');
      return;
    }
    console.log(`[0] Da cap ${SO_CAP} credit\n`);

    // ── 1. Nam lan tru DONG THOI, moi lan mot render khac ──
    //
    // Day la phep thu chinh. So du 10, moi lan tru 4 => chi 2 lan duoc phep thanh cong.
    // Duong cu (doc-roi-ghi khong khoa) se cho ca 5 lan di qua, vi ca 5 deu doc thay 10.
    console.log(`[1] ${SO_DONG_THOI} lan tru ${SO_MOI_LAN} credit cung luc (so du ${SO_CAP})`);
    const ketQua = await Promise.all(
      renders.map((rid, i) =>
        db.rpc('tru_credit_render', {
          p_user: userThu, p_project: null, p_render: rid,
          p_so_credit: SO_MOI_LAN, p_ly_do: `thu_nghiem_${i}`,
        }).then(({ data, error }) => {
          if (error) return { loi: error.message };
          const d = Array.isArray(data) ? data[0] : data;
          return { dat: d?.dat as boolean, ma: d?.ma as string, so_du_sau: d?.so_du_sau as number };
        }),
      ),
    );

    const loi = ketQua.filter((x: any) => x.loi);
    if (loi.length) {
      console.log(`  Co ${loi.length} lenh goi LOI: ${(loi[0] as any).loi}`);
      console.log('  Neu la "could not find the function" thi migration chua chay.');
      return;
    }

    const thanhCong = ketQua.filter((x: any) => x.dat);
    const tuChoi = ketQua.filter((x: any) => !x.dat);
    const mongDoi = Math.floor(SO_CAP / SO_MOI_LAN);

    kiem(
      `dung ${mongDoi} lan thanh cong (thuc te: ${thanhCong.length})`,
      thanhCong.length === mongDoi,
      thanhCong.length > mongDoi
        ? 'VUOT CHOT SO DU — khoa khong hoat dong, day dung la loi dang di sua'
        : 'it hon mong doi',
    );
    kiem(
      `${SO_DONG_THOI - mongDoi} lan bi tu choi vi khong du`,
      tuChoi.length === SO_DONG_THOI - mongDoi && tuChoi.every((x: any) => x.ma === 'KHONG_DU_CREDIT'),
      `cac ma: ${tuChoi.map((x: any) => x.ma).join(', ')}`,
    );

    // ── 2. So du cuoi phai dung chinh xac ──
    const { data: soCai } = await db.from('credit_ledger').select('delta').eq('user_id', userThu);
    const soDu = (soCai ?? []).reduce((t: number, r: any) => t + (r.delta ?? 0), 0);
    const soDuMong = SO_CAP - mongDoi * SO_MOI_LAN;
    kiem(`so du cuoi = ${soDuMong}`, soDu === soDuMong, `thuc te: ${soDu}`);
    kiem('so du khong bao gio am', soDu >= 0, `thuc te: ${soDu}`);

    // ── 3. Tru LAI cho mot render da tru: phai bao da tru, khong tru lan hai ──
    console.log('\n[3] Goi lai cho render da tru (giao hang it-nhat-mot-lan)');
    const daTru = renders[ketQua.findIndex((x: any) => x.dat)];
    const { data: lai, error: eLai } = await db.rpc('tru_credit_render', {
      p_user: userThu, p_project: null, p_render: daTru,
      p_so_credit: SO_MOI_LAN, p_ly_do: 'thu_nghiem_lap_lai',
    });
    const dLai = Array.isArray(lai) ? lai[0] : lai;
    kiem('tra ve dat=true (tien da tru that roi)', !eLai && dLai?.dat === true, eLai?.message);
    kiem('ma la DA_TRU_TRUOC_DO', dLai?.ma === 'DA_TRU_TRUOC_DO', `thuc te: ${dLai?.ma}`);

    const { data: soCai2 } = await db.from('credit_ledger').select('delta').eq('user_id', userThu);
    const soDu2 = (soCai2 ?? []).reduce((t: number, r: any) => t + (r.delta ?? 0), 0);
    kiem('so du KHONG doi — khong tru lan hai', soDu2 === soDu, `truoc ${soDu}, sau ${soDu2}`);

    // ── 4. Chi muc duy nhat la chot cuoi ──
    console.log('\n[4] Chi muc duy nhat chan ghi thang vao so cai');
    const { error: eTrung } = await db.from('credit_ledger').insert({
      user_id: userThu, render_id: daTru, delta: -1, reason: 'thu_ghi_trung', balance_after: 0,
    });
    kiem('ghi them mot but toan TRU cho cung render bi tu choi', !!eTrung, eTrung ? '' : 'LOT QUA — chi muc khong hoat dong');

    // Hoan tien cho cung render thi PHAI duoc: chi muc chi chan delta < 0.
    const { error: eHoan } = await db.from('credit_ledger').insert({
      user_id: userThu, render_id: daTru, delta: SO_MOI_LAN, reason: 'thu_hoan_tien', balance_after: soDu + SO_MOI_LAN,
    });
    kiem('nhung HOAN TIEN cho cung render thi duoc', !eHoan, eHoan?.message);

    // ── 5. Tham so khong hop le ──
    console.log('\n[5] Tham so khong hop le');
    for (const [so, ten] of [[0, 'tru 0'], [-5, 'tru so am']] as const) {
      const { data: d } = await db.rpc('tru_credit_render', {
        p_user: userThu, p_project: null, p_render: randomUUID(),
        p_so_credit: so, p_ly_do: 'thu_sai',
      });
      const r = Array.isArray(d) ? d[0] : d;
      kiem(`${ten} bi tu choi`, r?.dat === false && r?.ma === 'SO_CREDIT_KHONG_HOP_LE', `ma: ${r?.ma}`);
    }
  } finally {
    const { error: e1 } = await db.from('credit_ledger').delete().eq('user_id', userThu);
    const { error: e2 } = await db.from('usage_logs').delete().eq('user_id', userThu);
    console.log(
      `\nDon du lieu thu: credit_ledger ${e1 ? 'LOI — ' + e1.message : 'xong'}, ` +
      `usage_logs ${e2 ? 'LOI — ' + e2.message : 'xong'}`,
    );
    if (e1 || e2) console.log(`!! Xoa tay: user_id = ${userThu}`);
  }

  console.log(`\n${soDat} dat, ${soHong} hong`);
  if (soHong > 0) process.exitCode = 1;
}

main().catch((e) => { console.error('VO:', e.message); process.exit(1); });
