import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { CAMERA_TABLE } from '../src/lib/camera-moves';

/**
 * Hai cai bay trong chuoi filter cua worker, ca hai deu CHAY qua moi test khac roi
 * chet o ffmpeg that:
 *
 *   1. `loudnorm` khong kem `aresample` — no xuat 192 kHz, AAC chi nhan toi 96 kHz,
 *      encoder tra -22 va ffmpeg bao "received no packets". Ma loi hien ra o giao dien
 *      la 4294967274.
 *
 *   2. `getZoompanFilter` chi biet bo ten goc may CU — ten moi roi vao `default`, tuc
 *      dung yen. Khong loi nao bao: video van ra, chi la phang li.
 *
 * Doc thang ma nguon vi hai ham nay khong xuat ra ngoai; test o day canh HOP DONG
 * giua chung chu khong goi chung.
 */

const NGUON = fs.readFileSync(path.join(__dirname, '../src/render.worker.ts'), 'utf-8');

test('worker KHONG dung loudnorm — no bom gain giua cac cau thanh tieng hu', () => {
  /**
   * `loudnorm` goi mot luot, khong truyen gia tri do truoc, chay o che do DONG: no
   * lien tuc ra lai gain theo thoi gian. Giua hai cau noi, no keo gain len het co va
   * nhac nen dang len thanh tieng hu.
   *
   * Do that tren render 5a7419c9 ngay 30/10:
   *
   *     "input_lra" : "1.10"              (noi dung binh thuong la 5-15)
   *     "normalization_type" : "dynamic"
   *
   * Sau khi doi sang gain co dinh + alimiter: LRA 4,20, dinh -1,47 dB.
   *
   * Neu sau nay ai do can `loudnorm` that, phai dung HAI LUOT (`linear=true` kem
   * `measured_I`) va van phai kem `aresample` — xem phep kiem ben duoi.
   */
  const dungThat = (NGUON.match(/loudnorm=[^,`\]]*/g) ?? []);
  assert.deepEqual(dungThat, [], `Worker dung lai loudnorm: ${dungThat.join(', ')}`);
});

test('neu co loudnorm thi phai di kem aresample', () => {
  // `loudnorm` khong kem `aresample` xuat 192 kHz; AAC chi nhan toi 96 kHz, encoder
  // tra -22 va ffmpeg bao "received no packets". Ma loi hien o giao dien la 4294967274.
  for (const m of NGUON.match(/loudnorm=[^,`\]]*/g) ?? []) {
    const sau = NGUON.slice(NGUON.indexOf(m) + m.length, NGUON.indexOf(m) + m.length + 30);
    assert.ok(
      sau.startsWith(',aresample='),
      `loudnorm khong co aresample ngay sau: "${m}${sau.slice(0, 20)}"`
    );
  }
});

test('moi nhanh tieng deu co chan dinh', () => {
  // `upbeat_01.mp3` va `chill_01.mp3` vuot 0 dBFS ngay trong file goc (do that: dinh
  // +1,2 dB va +0,4 dB). Thieu chan dinh la nghe re sau khi ma hoa AAC.
  // Chỉ đếm nhánh SINH RA `[aout]`, không đếm `-map '[aout]'` vốn chỉ trỏ tới nó.
  const nhanhTieng = (NGUON.match(/filterParts\.push\([^;]*\[aout\]/g) ?? []).length;
  const chanDinh = (NGUON.match(/chuoiChanDinh\(\)/g) ?? []).length;
  assert.ok(nhanhTieng > 0, 'Khong tim thay nhanh tieng nao — test nay da het tac dung');
  assert.equal(chanDinh, nhanhTieng, `${nhanhTieng} nhanh tieng nhung chi ${chanDinh} cho chan dinh`);
});

test('getZoompanFilter xu ly MOI ten trong CAMERA_TABLE', () => {
  const than = NGUON.slice(NGUON.indexOf('function getZoompanFilter'));
  const ket = than.slice(0, than.indexOf('\n}'));

  for (const ten of Object.keys(CAMERA_TABLE)) {
    assert.ok(
      ket.includes(`case '${ten}':`),
      `getZoompanFilter khong co nhanh cho "${ten}" — canh do se dung yen`
    );
  }
});

test('getZoompanFilter van giu cac ten CU', () => {
  // Ban ghi tu lan chay truoc con mang chung; bo di la video cu dung lai doi hanh vi.
  const than = NGUON.slice(NGUON.indexOf('function getZoompanFilter'));
  const ket = than.slice(0, than.indexOf('\n}'));

  for (const ten of ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'push_in']) {
    assert.ok(ket.includes(`case '${ten}':`), `mat tuong thich nguoc voi "${ten}"`);
  }
});

test('zoom_out KHONG bi gop chung voi nhom phong to', () => {
  // Gop vao la dao nguoc chuyen dong cua mot video da dung xong.
  const than = NGUON.slice(NGUON.indexOf('function getZoompanFilter'));
  const ket = than.slice(0, than.indexOf('\n}'));
  const i = ket.indexOf("case 'zoom_out':");
  const sau = ket.slice(i, i + 200);
  assert.ok(!sau.startsWith("case 'zoom_out':\n    case "), 'zoom_out bi gop voi nhanh khac');
  assert.ok(/zoompan=z='\$\{ze\}/.test(sau), 'zoom_out phai bat dau tu ze, khong phai zs');
});

test('moi canh anh phai co setsar=1 TRUOC concat', () => {
  // `concat` doi moi dau vao cung kich thuoc VA cung SAR. Anh nguon khac ti le di qua
  // scale+pad cho ra SAR le khac nhau — do that 29/10: canh nay 1:1, canh kia
  // 8065:8064. ffmpeg tu choi ghep va tra -22, hien len giao dien la 4294967274.
  //
  // Loi CHI no khi cac anh khac ti le nhau, nen lo anh dong deu van chay duoc va loi
  // nam im cho toi khi khach tai len anh that voi du kich co.
  const i = NGUON.indexOf('zoompanFilter}');
  assert.ok(i > 0, 'khong tim thay cho rap chuoi canh');
  const doan = NGUON.slice(i, i + 120);
  assert.ok(doan.includes('setsar=1'), `thieu setsar truoc concat: ${doan.slice(0, 80)}`);
});

test('anh tinh duoc nap kem -framerate', () => {
  // Thieu no, ffmpeg nap anh lap o 25fps mac dinh; voi `zoompan d=1` thi so khung ra
  // bang so khung vao, nen canh 2 giay chi ra 1,67 giay. Moi canh ngan lai 17%.
  assert.ok(NGUON.includes("'-framerate'"), 'input anh thieu -framerate');
});

test('zoompan cua anh tinh dung d=1', () => {
  // `d` la so khung xuat ra TREN MOI khung vao. Anh nap bang `-loop 1 -t X` da co
  // X*fps khung; dat d=durationFrames nhan them lan nua — do that: canh 2 giay ra
  // video 100 giay, 3000 khung thay vi 60.
  const than = NGUON.slice(NGUON.indexOf('function getZoompanFilter'));
  const ket = than.slice(0, than.indexOf('\n}'));
  assert.ok(!/:d=\$\{d\}/.test(ket), 'van con d=${d} — se nhan so khung len');
  assert.ok(/:d=1:/.test(ket), 'thieu d=1');
});

/* ──────── Tru credit: THU TU goi la quyet dinh ──────── */

test('worker goi callback TRUOC khi ghi completed', () => {
  // Route callback chi tru credit khi trang thai CU chua phai trang thai cuoi — chot
  // do dung de tranh tru hai lan. Nhung neu worker ghi 'completed' truoc roi moi goi,
  // route doc lai thay da 'completed' va bo qua phan tru.
  //
  // Do that 29/10: 3 video hoan thanh, 0 but toan `render_completed` trong
  // credit_ledger. Moi video duoc render MIEN PHI.
  const iGoi = NGUON.indexOf("sendCallback(renderId, 'completed'");
  const iGhi = NGUON.indexOf("setStatus(renderId, 'completed'");
  assert.ok(iGoi > 0, 'khong tim thay lan goi callback completed');
  assert.ok(iGhi > 0, 'khong tim thay lan ghi trang thai completed');
  assert.ok(iGoi < iGhi, 'callback phai duoc goi TRUOC khi ghi completed, neu khong credit khong bao gio bi tru');
});

test('backend tu choi thi worker KHONG danh dau hoan thanh', () => {
  // Route tu dat trang thai 'failed' khi khong du xu; ghi de thanh 'completed' la
  // trao video cho khach khong tra tien va che mat ly do that.
  assert.ok(
    /ketQua[\s\S]{0,120}success === false[\s\S]{0,200}return;/.test(NGUON),
    'thieu nhanh dung lai khi backend tu choi'
  );
});

test('KHONG fade tu den o dau video — do la cho quyet dinh nguoi xem co dung lai khong', () => {
  // Do that 31/10 tren ba ban render: khung dau Y=29, giay 0,4 tro di Y=128.
  // Tuc 0,4 giay dau gan nhu den — dung cho nguoi xem quyet dinh luot tiep.
  assert.doesNotMatch(
    NGUON,
    /fade=t=in:st=0:d=0\.4/,
    'Van fade tu den 0,4 giay o dau — dot mat khoang quy nhat cua video ngan'
  );
  // Van cho bat lai qua bien moi truong, phong khi doi y.
  assert.match(NGUON, /FADE_VAO_GIAY/, 'Khong con duong bat lai fade mo dau');
});

test('fade ket du ngan de vong lap khong giat', () => {
  // Video ngan tren TikTok/Reels/Shorts LAP LAI. Mo het ve den roi nhay ve khung
  // dau sang truong thanh mot cu nhay nhin thay ro moi vong.
  const m = NGUON.match(/FADE_RA_GIAY \|\| '([\d.]+)'/);
  assert.ok(m, 'Khong tim thay mac dinh cua fade ket');
  assert.ok(Number(m![1]) <= 0.3, `Fade ket ${m![1]}s qua dai cho video lap`);
});

test('gioi han so luong ffmpeg — 48 luong tren 32 nhan la thua nhan', () => {
  /**
   * x264 mac dinh lay 1,5 lan so nhan. Moi luong giu rieng mot bo dem khung hinh,
   * va voi do thi filter hien nay (10 canh, xfade, phu de, anh 2400px) thi bo nho
   * don lai rat nhanh — ffmpeg sap giua chung o render 57c684ca ngay 31/10, lam lan
   * dung do mat 188 giay thay vi ~60.
   *
   * Do that ba lan moi muc: 24 luong KHONG ton them giay nao so voi mac dinh.
   */
  assert.match(NGUON, /'-threads'/, 'Khong gioi han so luong — x264 se lay 1,5 lan so nhan');
  assert.match(NGUON, /'-filter_complex_threads'/, 'Khong gioi han luong cho do thi filter');

  const m = NGUON.match(/FFMPEG_THREADS \|\| '(\d+)'/);
  assert.ok(m, 'Khong tim thay mac dinh so luong');
  const n = Number(m![1]);
  assert.ok(n >= 8 && n <= 32, `${n} luong nam ngoai khoang da do (8-32)`);
});

test('-threads dat TRUOC duong dan dau ra', () => {
  // `-threads` la tuy chon cua luong xuat. Dat sau duong dan thi ffmpeg bo qua im lang.
  const iThreads = NGUON.indexOf("'-threads'");
  const iFaststart = NGUON.indexOf("'+faststart'");
  assert.ok(iThreads > 0, "Khong tim thay '-threads'");
  assert.ok(iFaststart > 0, "Khong tim thay '+faststart'");
  assert.ok(
    iThreads < iFaststart,
    '-threads duoc day vao SAU khoi tham so dau ra — ffmpeg se bo qua im lang'
  );
});

test('nhac nen LAP roi cat dung do dai hinh', () => {
  /**
   * `duration=first` bam theo `[bg]` — tuc NHAC, khong phai loi doc. Moi file nhac
   * trong thu vien dai dung 30 giay.
   *
   * Ngay 31/10: khach dat 30 giay, tang 3 viet loi dai hon suc chua nen cac canh bi
   * keo ra, video thanh 35,10 giay — ca dai tieng dung o giay 30 roi `apad` lap im
   * lang 5,1 giay cuoi. Do that: muc am tu -19 dB tut thang xuong -91 dB tai giay 30.
   */
  assert.match(NGUON, /aloop=loop=-1/, 'Nhac khong lap — video dai hon nhac se im o cuoi');
  assert.match(NGUON, /atrim=duration=\$\{daiHinh/, 'Nhac lap nhung khong cat theo do dai hinh');

  // CA HAI nhanh co nhac deu phai lap: nhanh co giong, va nhanh chi co nhac.
  const soLap = (NGUON.match(/aloop=loop=-1/g) ?? []).length;
  assert.ok(soLap >= 2, `Chi ${soLap} nhanh lap nhac, can ca hai`);
});

test('asetpts sau atrim — thieu no thi nhac bat dau sai moc', () => {
  // `atrim` giu nguyen moc thoi gian goc, nen doan cat ra van mang PTS cu.
  for (const m of NGUON.match(/atrim=duration=[^,\]]+,\s*(\w+)/g) ?? []) {
    assert.match(m, /asetpts/, `Sau atrim khong co asetpts: ${m}`);
  }
});
