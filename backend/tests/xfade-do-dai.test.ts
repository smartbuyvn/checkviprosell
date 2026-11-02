/**
 * Chuỗi `xfade` phải giữ đúng thời lượng kế hoạch.
 *
 * ── Lỗi lần này ──
 *
 * `xfade` đòi đầu vào thứ nhất DÀI HƠN `offset + duration`. Bằng nhau là không đủ.
 *
 * Bản cũ kéo dài mỗi cảnh đúng bằng phần bị hoà nuốt — đúng về toán, sai về thực tế:
 * `-t` ghi bằng `toFixed(2)` rồi ffmpeg làm tròn số khung XUỐNG, nên cảnh thật luôn
 * ngắn hơn kế hoạch vài phần trăm giây và điều kiện vỡ.
 *
 * Khi vỡ, `xfade` KHÔNG báo lỗi: nó trả về một luồng cụt ngủn và ffmpeg thoát 0.
 * Đo thật ngày 30/10 trên render `f1f588fa`: kế hoạch 21,12 giây, file ra **4,83
 * giây**, không một dòng cảnh báo. Khách chỉ thấy "video vài giây".
 *
 * Cảnh 0 còn tệ hơn: phần kéo dài cho một cắt cứng là 0,034s — NHỎ HƠN một khung
 * (0,0333s ở 30fps) — nên `toFixed(2)` xoá sạch nó trước khi ffmpeg kịp nhìn thấy.
 *
 * ── Vì sao không nạp worker ──
 *
 * `import` worker là mở kết nối realtime, và bộ kiểm treo mãi chờ nó đóng. Phép tính
 * thời lượng vì thế nằm ở `transitions.ts`; phần cuối file kiểm rằng worker THẬT SỰ
 * gọi nó, không âm thầm quay lại tự tính.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  lapKeHoachChuyen,
  dungChuoiXfade,
  soKhungCanh,
  tDauVaoCanh,
  BIEN_KHUNG_AN_TOAN,
} from '../src/lib/transitions';

const FPS = 30;

/** Đúng sáu cảnh của render `f1f588fa` sau khi đã khớp lời đọc. */
const DAI_CANH = [2.65, 3.36, 3.50, 3.50, 4.44, 3.67];
const VAO = ['fade', 'cut', 'lat_ngang', 'cut', 'xuyen_qua', 'fade'];

function timeline() {
  let moc = 0;
  return DAI_CANH.map((d, i) => {
    const m = { start_sec: moc, end_sec: moc + d, transition_in: VAO[i], transition_out: 'cut' };
    moc += d;
    return m;
  });
}

/** Độ dài THẬT ffmpeg sinh ra: `-loop 1 -framerate fps -t X` cho floor(X*fps) khung. */
function daiThat(i: number, keoDai: number[]): number {
  const khung = soKhungCanh(DAI_CANH[i], keoDai[i], FPS);
  return Math.floor(tDauVaoCanh(khung, FPS) * FPS) / FPS;
}

test('moi canh nuoi chuyen canh deu DAI HON phan bi hoa nuot', () => {
  const kh = lapKeHoachChuyen(timeline());

  for (let i = 0; i < DAI_CANH.length - 1; i++) {
    const can = DAI_CANH[i] + kh.keoDai[i];
    assert.ok(
      daiThat(i, kh.keoDai) > can,
      `Canh ${i}: dai that ${daiThat(i, kh.keoDai).toFixed(4)}s KHONG lon hon ${can.toFixed(4)}s`
      + ` (ke hoach ${DAI_CANH[i]} + hoa ${kh.keoDai[i]}). xfade se tra ve luong cut.`
    );
  }
});

test('canh nuoi mot CAT CUNG van du dai — phan keo dai nho hon mot khung', () => {
  // Day la canh 0 cua render f1f588fa: keo dai 0,034s < mot khung 0,0333s.
  // `toFixed(2)` cua ban cu bien 2,684 thanh "2.68" = 80 khung = 2,6667s < 2,684.
  const kh = lapKeHoachChuyen(timeline());
  const cat = kh.keoDai.findIndex((d, i) => d > 0 && d < 2 / FPS && i < DAI_CANH.length - 1);
  assert.ok(cat >= 0, 'Khong tim thay canh nuoi cat cung — phep kiem mat y nghia');

  assert.ok(
    daiThat(cat, kh.keoDai) > DAI_CANH[cat] + kh.keoDai[cat],
    `Canh ${cat} (cat cung) chi dai ${daiThat(cat, kh.keoDai).toFixed(4)}s,`
    + ` can hon ${(DAI_CANH[cat] + kh.keoDai[cat]).toFixed(4)}s`
  );
});

test('offset cua xfade khong bao gio vuot qua chuoi dang co', () => {
  const kh = lapKeHoachChuyen(timeline());
  const buoc = dungChuoiXfade(kh, (i) => `scene${i}`, 'ra');
  assert.ok(buoc, 'Khong dung duoc chuoi xfade');
  assert.equal(buoc!.length, DAI_CANH.length - 1, 'Thieu buoc xfade');

  // `xfade` tra ve `offset + dai(dau vao 2)`. Lan theo chuoi y het ffmpeg lam.
  let daiChuoi = daiThat(0, kh.keoDai);
  for (const [i, b] of buoc!.entries()) {
    const offset = Number(b.match(/offset=([\d.]+)/)?.[1]);
    const duration = Number(b.match(/duration=([\d.]+)/)?.[1]);
    assert.ok(Number.isFinite(offset) && Number.isFinite(duration), `Buoc ${i} thieu offset/duration`);

    assert.ok(
      offset + duration < daiChuoi,
      `Buoc ${i}: can ${(offset + duration).toFixed(4)}s nhung chuoi chi dai`
      + ` ${daiChuoi.toFixed(4)}s — video se bi cat con ~${(offset + duration).toFixed(2)}s`
    );
    daiChuoi = offset + daiThat(i + 1, kh.keoDai);
  }
});

test('tong thoi luong khop ke hoach, khong ngan di', () => {
  const kh = lapKeHoachChuyen(timeline());
  const buoc = dungChuoiXfade(kh, (i) => `scene${i}`, 'ra')!;
  const keHoach = DAI_CANH.reduce((a, b) => a + b, 0);

  const cuoi = Number(buoc[buoc.length - 1].match(/offset=([\d.]+)/)![1]);
  const raThat = cuoi + daiThat(DAI_CANH.length - 1, kh.keoDai);

  // Dai hon vai khung thi duoc; NGAN hon la loi da tung xay ra (21,12s -> 4,83s).
  assert.ok(raThat >= keHoach, `Video ra ${raThat.toFixed(2)}s, ngan hon ke hoach ${keHoach.toFixed(2)}s`);
  assert.ok(raThat < keHoach + 0.5, `Video ra ${raThat.toFixed(2)}s, phinh qua ke hoach ${keHoach.toFixed(2)}s`);
});

test('canh CUOI khong duoc noi them — no quyet dinh do dai video', () => {
  const cuoi = DAI_CANH.length - 1;
  // keoDai = 0 cho canh cuoi, nen khong duoc cong bien an toan.
  const khung = soKhungCanh(DAI_CANH[cuoi], 0, FPS);
  assert.ok(
    khung / FPS < DAI_CANH[cuoi] + 1 / FPS,
    `Canh cuoi dai ${(khung / FPS).toFixed(3)}s, phinh qua ke hoach ${DAI_CANH[cuoi]}s`
  );
});

test('bien an toan it nhat mot khung', () => {
  // Bang 0 thi dieu kien quay ve "bang nhau", va do chinh la loi cu.
  assert.ok(BIEN_KHUNG_AN_TOAN >= 1, 'BIEN_KHUNG_AN_TOAN phai >= 1 khung');
  // Canh co keo dai thi phai duoc cong bien; canh khong thi khong.
  assert.equal(soKhungCanh(2, 0, FPS), 60);
  assert.equal(soKhungCanh(2, 0.034, FPS), Math.ceil(2.034 * FPS) + BIEN_KHUNG_AN_TOAN);
});

test('t dau vao luon sinh du so khung yeu cau', () => {
  for (const fps of [24, 25, 30, 60]) {
    for (const khung of [1, 7, 60, 111, 299]) {
      const sinhRa = Math.floor(tDauVaoCanh(khung, fps) * fps);
      assert.ok(sinhRa >= khung, `fps=${fps} khung=${khung}: chi sinh ${sinhRa}`);
    }
  }
});

test('worker CO dung soKhungCanh, khong tu tinh lai', () => {
  const worker = readFileSync(join(__dirname, '..', 'src', 'render.worker.ts'), 'utf8');
  assert.match(worker, /soKhungCanh\(/, 'Worker khong goi soKhungCanh');
  assert.match(worker, /tDauVaoCanh\(/, 'Worker khong goi tDauVaoCanh');
  // Lam tron XUONG la dung hinh hai cua loi cu.
  assert.doesNotMatch(
    worker,
    /durationFrames\s*=\s*Math\.round/,
    'Worker lam tron so khung XUONG — do chinh la loi 21,12s -> 4,83s'
  );
  assert.doesNotMatch(
    worker,
    /'-t',\s*durationSec\.toFixed\(2\)/,
    'Worker ghi `-t` bang toFixed(2) — mat phan keo dai nho hon mot khung'
  );
});
