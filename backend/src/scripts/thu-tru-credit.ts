/**
 * Phép thử `tru_credit_render()` — MẶC ĐỊNH CHỈ ĐỌC.
 *
 *   npx tsx src/scripts/thu-tru-credit.ts          → chỉ đọc, không ghi gì
 *   npx tsx src/scripts/thu-tru-credit.ts --ghi     → chạy thật, có ghi vào bảng tiền
 *
 * ── Vì sao mặc định là chỉ đọc ──
 *
 * Đây là script duy nhất trong dự án ghi vào `credit_ledger`. Một lần chạy nhầm trên
 * bảng tiền tốn nhiều hơn một lần gõ thêm cờ. Nên muốn ghi thì phải nói ra.
 *
 * ── Điều bản CHỈ ĐỌC không làm được ──
 *
 * Cái khoá `pg_advisory_xact_lock` chỉ thể hiện khi có hai lệnh ghi tranh nhau. Không
 * ghi thì không có gì để tranh, nên bản chỉ đọc **không chứng minh được** tính nguyên
 * tử — nó chỉ in ra kế hoạch và chạy những phép kiểm không cần ghi. Script nói rõ
 * phần nào còn để lại chưa chứng minh, thay vì để người đọc tưởng là đã xong.
 *
 * ── Khi chạy với --ghi, nó tự bảo vệ thế nào ──
 *
 *   - `user_id` là UUID ngẫu nhiên, không phải khách nào — không bút toán nào chạm số
 *     dư thật.
 *   - Xoá sạch trong khối `finally`, kể cả khi lỗi giữa chừng.
 *   - Nếu `credit_ledger.user_id` có khoá ngoại tới `auth.users` thì lệnh chèn bị từ
 *     chối; script dừng gọn và KHÔNG kết luận là hàm sai.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SO_CAP = 10;      // Credit cap cho nguoi dung thu
const SO_MOI_LAN = 4;   // Moi lan tru 4 -> dung 2 lan thanh cong
const SO_DONG_THOI = 5; // Nam lan tru cung luc, moi lan mot render khac nhau

const CHO_PHEP_GHI = process.argv.includes('--ghi');

/**
 * `--user <uuid>`: tài khoản dùng để thử.
 *
 * Bắt buộc phải có khi chạy `--ghi`. UUID ngẫu nhiên KHÔNG dùng được: đo ngày 02/11/2026,
 * `credit_ledger.user_id` có khoá ngoại `credit_ledger_user_id_fkey`, nên chèn một user
 * không tồn tại bị từ chối.
 *
 * Script TỪ CHỐI mọi tài khoản có số dư khác 0, vì hai lý do cùng lúc:
 *
 *   1. **Phép thử mất hiệu lực.** Hàm kiểm `so_du < so_can_tru`. Tài khoản có 55 credit
 *      sẵn, cấp thêm 8, thì cả 5 lần trừ 4 đều đủ tiền và đều thành công — không còn
 *      chốt nào để chứng minh.
 *   2. **Không chạm tiền thật.** Số dư 0 thì cấp 8 rồi trừ hết 8 là về đúng 0. Dù script
 *      chết giữa chừng, hướng sai luôn là tài khoản THỪA credit, không bao giờ thiếu —
 *      vì cấp trước khi trừ, và hàm không cho trừ quá số đã cấp.
 */
const USER_THU = (() => {
  const i = process.argv.indexOf('--user');
  return i >= 0 ? (process.argv[i + 1] ?? '') : '';
})();

let soDat = 0;
let soHong = 0;
function kiem(ten: string, dat: boolean, chiTiet = '') {
  if (dat) { soDat += 1; console.log(`  OK   ${ten}`); }
  else { soHong += 1; console.log(`  HONG ${ten}${chiTiet ? ' — ' + chiTiet : ''}`); }
}

/**
 * Phần client mà script này dùng, khai lỏng.
 *
 * `ReturnType<typeof createClient>` không chạy được: không có generic Database thì
 * supabase-js suy ra mọi bảng là `never`, nên mọi `insert({...})` và `rpc(...)` đều
 * không khớp type. `lease.ts` khai lỏng đúng vì lý do này.
 */
type Db = {
  rpc: (ten: string, tham: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
  from: (bang: string) => any;
};

/** Phép kiểm không cần ghi: gọi hàm bằng những tham số thoát trước mọi lệnh ghi. */
async function kiemKhongGhi(db: Db) {
  console.log('── Phep kiem KHONG CAN GHI ──');

  // p_so_credit = 0 thoat ngay dau, truoc ca khi lay khoa.
  const { data: d1, error: e1 } = await db.rpc('tru_credit_render', {
    p_user: randomUUID(), p_project: null, p_render: randomUUID(),
    p_so_credit: 0, p_ly_do: 'thu_chi_doc',
  });
  const x1: any = Array.isArray(d1) ? d1[0] : d1;
  kiem('ham ton tai va goi duoc', !e1, e1?.message);
  kiem('tru 0 credit bi tu choi', x1?.ma === 'SO_CREDIT_KHONG_HOP_LE', `ma: ${x1?.ma}`);

  // User ngau nhien khong co but toan nao -> so du 0 -> tu choi, khong ghi.
  const { data: d2 } = await db.rpc('tru_credit_render', {
    p_user: randomUUID(), p_project: null, p_render: randomUUID(),
    p_so_credit: 1, p_ly_do: 'thu_chi_doc',
  });
  const x2: any = Array.isArray(d2) ? d2[0] : d2;
  kiem('so du 0 thi bi tu choi', x2?.ma === 'KHONG_DU_CREDIT', `ma: ${x2?.ma}`);
  kiem('tra ve dung so du 0', x2?.so_du_sau === 0, `thuc te: ${x2?.so_du_sau}`);

  // Nam lan goi DONG THOI, tat ca deu bi tu choi. Chung minh chung deu lay duoc khoa
  // va chay den cuoi — nhung KHONG chung minh duoc chot so du, vi khong lan nao thanh cong.
  const chum = await Promise.all(
    Array.from({ length: SO_DONG_THOI }, () =>
      db.rpc('tru_credit_render', {
        p_user: randomUUID(), p_project: null, p_render: randomUUID(),
        p_so_credit: 1, p_ly_do: 'thu_chi_doc',
      }).then(({ data, error }) => (error ? { loi: error.message } : (Array.isArray(data) ? data[0] : data))),
    ),
  );
  kiem(
    `${SO_DONG_THOI} lenh goi dong thoi deu chay den cuoi`,
    chum.every((x: any) => !x?.loi && x?.ma === 'KHONG_DU_CREDIT'),
    JSON.stringify(chum.map((x: any) => x?.loi ?? x?.ma)),
  );

  // Chung thuc: khong dong nao bi them vao.
  const { data: so } = await db.from('credit_ledger').select('id').like('reason', 'thu_chi_doc%');
  kiem('KHONG dong nao bi ghi vao credit_ledger', (so ?? []).length === 0, `thay ${(so ?? []).length}`);
}

/** In ra đúng những gì bản `--ghi` sẽ làm, và những gì nó sẽ KHÔNG làm. */
function inKeHoach(userThu: string) {
  const soThanhCong = Math.floor(SO_CAP / SO_MOI_LAN);
  console.log('\n── Neu chay voi --ghi, no SE lam dung nhung viec sau ──\n');
  console.log(`  Nguoi dung thu: ${userThu}`);
  console.log('    UUID ngau nhien, KHONG phai khach nao. Khong but toan nao cham so du that.\n');
  console.log('  Ghi vao credit_ledger:');
  console.log(`    1 dong cap  ${String(SO_CAP).padStart(3)} credit   reason = thu_nghiem_cap`);
  console.log(`    ${soThanhCong} dong tru  ${String(-SO_MOI_LAN).padStart(3)} credit   reason = thu_nghiem_<n>`);
  console.log('    1 dong hoan tien (kiem chi muc cho phep hoan)  reason = thu_hoan_tien');
  console.log(`    => toi da ${2 + soThanhCong} dong, tat ca cua rieng user tren\n`);
  console.log('  Ghi vao usage_logs:');
  console.log(`    ${soThanhCong} dong  step_name = render_credit_deduction  (do chinh ham ghi)\n`);
  console.log('  Don dep:');
  console.log(`    DELETE FROM credit_ledger WHERE user_id = '${userThu}'`);
  console.log(`    DELETE FROM usage_logs    WHERE user_id = '${userThu}'`);
  console.log('    Nam trong khoi finally, nen chay ca khi script loi giua chung.\n');
  console.log('  Khong bao gio cham vao:');
  console.log('    - Bat ky user_id nao khac');
  console.log('    - Bang renders, projects, payments, profiles');
}

function inChuaChungMinh() {
  console.log('── Nhung dieu ban CHI DOC KHONG chung minh duoc ──\n');
  console.log('  1. Chot so du co duoc bao ve khong.');
  console.log('     Phep thu that: so du 10, nam lan tru 4 cung luc => phai dung HAI lan');
  console.log('     thanh cong. Duong cu cho ca nam di qua vi ca nam deu doc thay 10.');
  console.log('     Khong ghi thi khong co lan nao thanh cong, nen khong co gi de dem.\n');
  console.log('  2. Chi muc duy nhat co that su chan tru hai lan khong.');
  console.log('     Chi kiem duoc bang cach ghi mot dong trung roi xem no co bi tu choi.\n');
  console.log('  3. Chi muc co cho phep HOAN tien cho cung render khong.');
  console.log('     Cung vay: phai ghi mot dong delta duong moi biet.\n');
  console.log('  4. credit_ledger.user_id co khoa ngoai toi auth.users khong.');
  console.log('     Chi lo ra khi thu chen mot user_id khong ton tai.\n');
  console.log('  => Bon dieu nay la LY DO phep thu ton tai. Chi doc chi xac nhan ham co');
  console.log('     that va duong tu choi chay dung.');
}

async function chayThat(db: Db, userThu: string) {
  const renders = Array.from({ length: SO_DONG_THOI }, () => randomUUID());
  // Moc nay la ranh gioi don dep: chi xoa nhung dong tao ra tu day tro di.
  // Lui mot giay de khong hut dong nao vi lech dong ho giua may nay va Postgres.
  const mocBatDau = new Date(Date.now() - 1000).toISOString();
  console.log(`Tai khoan thu: ${userThu}`);
  console.log(`Moc don dep:   ${mocBatDau}\n`);

  // ── Chot an toan: tu choi moi tai khoan co so du khac 0 ──
  const { data: truocKhiThu } = await db.from('credit_ledger').select('delta').eq('user_id', userThu);
  const soDuDau = (truocKhiThu ?? []).reduce((t: number, r: any) => t + (r.delta ?? 0), 0);
  if (soDuDau !== 0) {
    console.log(`TU CHOI: tai khoan nay dang co ${soDuDau} credit, khong phai 0.`);
    console.log('Hai ly do cung luc:');
    console.log(`  1. Phep thu mat hieu luc — ${soDuDau} + ${SO_CAP} credit thi ca ${SO_DONG_THOI} lan tru`);
    console.log(`     ${SO_MOI_LAN} deu du tien, khong con chot nao de chung minh.`);
    console.log('  2. Khong duoc cham vao tien that cua khach.');
    console.log('\nCan mot tai khoan co so du dung 0.');
    return;
  }
  console.log(`So du dau: ${soDuDau} — dat chot an toan.\n`);

  try {
    const { error: eCap } = await db.from('credit_ledger').insert({
      user_id: userThu, delta: SO_CAP, reason: 'thu_nghiem_cap', balance_after: SO_CAP,
    });
    if (eCap) {
      console.log(`Khong cap duoc credit cho nguoi dung thu: ${eCap.message}`);
      console.log('Neu la loi khoa ngoai thi user_id nay khong ton tai trong auth.users.');
      console.log('=> KHONG ket luan duoc gi ve ham.');
      return;
    }
    console.log(`[0] Da cap ${SO_CAP} credit\n`);

    // ── 1. Phep thu chinh: nam lan tru DONG THOI ──
    console.log(`[1] ${SO_DONG_THOI} lan tru ${SO_MOI_LAN} credit cung luc (so du ${SO_CAP})`);
    const ketQua = await Promise.all(
      renders.map((rid, i) =>
        db.rpc('tru_credit_render', {
          p_user: userThu, p_project: null, p_render: rid,
          p_so_credit: SO_MOI_LAN, p_ly_do: `thu_nghiem_${i}`,
        }).then(({ data, error }) => {
          if (error) return { loi: error.message };
          const d: any = Array.isArray(data) ? data[0] : data;
          return { dat: d?.dat as boolean, ma: d?.ma as string, so_du_sau: d?.so_du_sau as number };
        }),
      ),
    );

    const loi = ketQua.filter((x: any) => x.loi);
    if (loi.length) {
      console.log(`  Co ${loi.length} lenh goi LOI: ${(loi[0] as any).loi}`);
      return;
    }

    const thanhCong = ketQua.filter((x: any) => x.dat);
    const tuChoi = ketQua.filter((x: any) => !x.dat);
    const mongDoi = Math.floor(SO_CAP / SO_MOI_LAN);

    kiem(
      `dung ${mongDoi} lan thanh cong (thuc te: ${thanhCong.length})`,
      thanhCong.length === mongDoi,
      thanhCong.length > mongDoi ? 'VUOT CHOT SO DU — khoa khong hoat dong' : 'it hon mong doi',
    );
    kiem(
      `${SO_DONG_THOI - mongDoi} lan bi tu choi vi khong du`,
      tuChoi.length === SO_DONG_THOI - mongDoi && tuChoi.every((x: any) => x.ma === 'KHONG_DU_CREDIT'),
      `cac ma: ${tuChoi.map((x: any) => x.ma).join(', ')}`,
    );

    // ── 2. So du cuoi ──
    const { data: soCai } = await db.from('credit_ledger').select('delta').eq('user_id', userThu);
    const soDu = (soCai ?? []).reduce((t: number, r: any) => t + (r.delta ?? 0), 0);
    const soDuMong = SO_CAP - mongDoi * SO_MOI_LAN;
    kiem(`so du cuoi = ${soDuMong}`, soDu === soDuMong, `thuc te: ${soDu}`);
    kiem('so du khong bao gio am', soDu >= 0, `thuc te: ${soDu}`);

    // ── 3. Goi lai cho render da tru ──
    console.log('\n[3] Goi lai cho render da tru (giao hang it-nhat-mot-lan)');
    const daTru = renders[ketQua.findIndex((x: any) => x.dat)];
    const { data: lai, error: eLai } = await db.rpc('tru_credit_render', {
      p_user: userThu, p_project: null, p_render: daTru,
      p_so_credit: SO_MOI_LAN, p_ly_do: 'thu_nghiem_lap_lai',
    });
    const dLai: any = Array.isArray(lai) ? lai[0] : lai;
    kiem('tra ve dat=true (tien da tru that roi)', !eLai && dLai?.dat === true, eLai?.message);
    kiem('ma la DA_TRU_TRUOC_DO', dLai?.ma === 'DA_TRU_TRUOC_DO', `thuc te: ${dLai?.ma}`);

    const { data: soCai2 } = await db.from('credit_ledger').select('delta').eq('user_id', userThu);
    const soDu2 = (soCai2 ?? []).reduce((t: number, r: any) => t + (r.delta ?? 0), 0);
    kiem('so du KHONG doi — khong tru lan hai', soDu2 === soDu, `truoc ${soDu}, sau ${soDu2}`);

    // ── 4. Chi muc duy nhat ──
    console.log('\n[4] Chi muc duy nhat chan ghi thang vao so cai');
    const { error: eTrung } = await db.from('credit_ledger').insert({
      user_id: userThu, render_id: daTru, delta: -1, reason: 'thu_ghi_trung', balance_after: 0,
    });
    kiem('but toan TRU thu hai cho cung render bi tu choi', !!eTrung, eTrung ? '' : 'LOT QUA — chi muc khong hoat dong');

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
      const r: any = Array.isArray(d) ? d[0] : d;
      kiem(`${ten} bi tu choi`, r?.dat === false && r?.ma === 'SO_CREDIT_KHONG_HOP_LE', `ma: ${r?.ma}`);
    }
  } finally {
    /**
     * Chỉ xoá những dòng SINH RA TRONG LÚC CHẠY, lọc theo `created_at`.
     *
     * Bản đầu của script xoá theo `user_id` — đó là một lỗi nặng. Số dư 0 KHÔNG có nghĩa
     * là không có bút toán: tài khoản có thể có +5 rồi −5. Xoá theo `user_id` là phá
     * lịch sử sổ cái thật của một người, và trên bảng tiền thì không có cách nào dựng lại.
     *
     * Lọc theo mốc thời gian thì chỉ chạm đúng những gì mình vừa tạo, và nếu lọc hụt thì
     * hướng sai là để lại rác chứ không phải xoá mất dữ liệu của người khác.
     */
    const { error: e1, data: x1 } = await db.from('credit_ledger')
      .delete().eq('user_id', userThu).gte('created_at', mocBatDau).select('id');
    const { error: e2, data: x2 } = await db.from('usage_logs')
      .delete().eq('user_id', userThu).gte('created_at', mocBatDau).select('id');
    console.log(
      `\nDon du lieu thu (chi dong tao sau ${mocBatDau}):\n` +
      `  credit_ledger: ${e1 ? 'LOI — ' + e1.message : `xoa ${(x1 ?? []).length} dong`}\n` +
      `  usage_logs:    ${e2 ? 'LOI — ' + e2.message : `xoa ${(x2 ?? []).length} dong`}`,
    );
    if (e1 || e2) {
      console.log(`!! Xoa tay — user_id = ${userThu}, created_at >= ${mocBatDau}`);
      console.log('!! KHONG xoa theo user_id khong kem moc thoi gian: se mat but toan that.');
    }
  }
}

async function main() {
  const db = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  console.log(CHO_PHEP_GHI ? '=== CHE DO GHI ===\n' : '=== CHE DO CHI DOC (them --ghi de chay that) ===\n');

  // Doi chieu truoc va sau: con so nay phai khong doi o che do chi doc.
  const { data: truoc } = await db.from('credit_ledger').select('delta');
  const tongTruoc = (truoc ?? []).reduce((t: number, x: any) => t + (x.delta ?? 0), 0);
  console.log(`So cai hien tai: ${(truoc ?? []).length} dong, tong delta = ${tongTruoc}\n`);

  if (CHO_PHEP_GHI) {
    if (!USER_THU) {
      console.log('THIEU --user <uuid>.');
      console.log('UUID ngau nhien khong dung duoc: credit_ledger.user_id co khoa ngoai');
      console.log('credit_ledger_user_id_fkey, nen user phai ton tai that.');
      console.log('\nTai khoan dung duoc phai co so du DUNG 0 — script tu choi cac truong hop khac.');
      process.exitCode = 1;
      return;
    }
    await chayThat(db, USER_THU);
  } else {
    await kiemKhongGhi(db);
    inKeHoach(randomUUID());
    inChuaChungMinh();
  }

  const { data: sau } = await db.from('credit_ledger').select('delta');
  const tongSau = (sau ?? []).reduce((t: number, x: any) => t + (x.delta ?? 0), 0);
  console.log(`\nSo cai sau khi chay: ${(sau ?? []).length} dong, tong delta = ${tongSau}`);
  if (!CHO_PHEP_GHI) {
    kiem(
      'che do chi doc KHONG lam doi so cai',
      (sau ?? []).length === (truoc ?? []).length && tongSau === tongTruoc,
      `truoc ${(truoc ?? []).length}/${tongTruoc}, sau ${(sau ?? []).length}/${tongSau}`,
    );
  }

  console.log(`\n${soDat} dat, ${soHong} hong`);
  if (soHong > 0) process.exitCode = 1;
}

main().catch((e) => { console.error('VO:', e.message); process.exit(1); });
