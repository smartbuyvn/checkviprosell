import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateVideo,
  shouldReject,
  buildVideoSceneFilter,
  pickSegment,
  parseProbe,
  isVideoAsset,
  MAX_CLIP_SEC,
  MAX_CLIP_BYTES,
  MIN_HEIGHT,
} from '../src/lib/video-asset';

/**
 * Video nguoi ban tu quay.
 *
 * Gia tri cua luong nay la cai TU NHIEN ma anh tinh khong co: tay nguoi cam san pham,
 * anh sang that, vat chuyen dong that. Nhung no chi co gia tri khi clip dat chuan —
 * mot clip 480p toi om phong len khung doc trong te hon han anh tinh.
 *
 * Nen test o day nghiem ve hai huong doi nhau: chan duoc clip hong, va KHONG chan oan
 * clip dung. Chan oan thi nguoi ban bo cuoc va quay ve dung anh tinh.
 */

const CLIP_TOT = {
  width: 1080, height: 1920, durationSec: 12, codec: 'h264',
  fps: 30, hasAudio: true, sizeBytes: 40 * 1024 * 1024,
};

/* ─────────── validateVideo ─────────── */

test('clip dat chuan thi KHONG bi chan', () => {
  const v = validateVideo(CLIP_TOT);
  assert.equal(shouldReject(v), false, JSON.stringify(v));
  assert.equal(v.length, 0);
});

test('duoi 720p bi chan — phong len khung doc se vo hat', () => {
  const v = validateVideo({ ...CLIP_TOT, width: 480, height: 640 });
  assert.ok(shouldReject(v));
  assert.ok(v.some((p) => p.code === 'LOW_RES'));
});

test('dung 720p thi NHAN — day la nguong, khong phai muc toi thieu phai vuot', () => {
  const v = validateVideo({ ...CLIP_TOT, width: 720, height: MIN_HEIGHT });
  assert.equal(shouldReject(v), false, JSON.stringify(v));
});

test('dai qua 60 giay bi chan', () => {
  const v = validateVideo({ ...CLIP_TOT, durationSec: MAX_CLIP_SEC + 1 });
  assert.ok(v.some((p) => p.code === 'TOO_LONG' && p.severity === 'reject'));
});

test('dung 60 giay thi NHAN', () => {
  const v = validateVideo({ ...CLIP_TOT, durationSec: MAX_CLIP_SEC });
  assert.equal(shouldReject(v), false);
});

test('nang qua 200MB bi chan', () => {
  const v = validateVideo({ ...CLIP_TOT, sizeBytes: MAX_CLIP_BYTES + 1 });
  assert.ok(v.some((p) => p.code === 'TOO_LARGE'));
});

test('clip dien thoai 30 giay 1080p/30 (~64MB): NHAN', () => {
  // Day chinh la truong hop tran cu 20MB loai oan — gan nhu MOI video that.
  // 30 giay o 17 Mbps la ~64MB, nam gon trong tran 100MB.
  const v = validateVideo({ ...CLIP_TOT, durationSec: 30, sizeBytes: 64 * 1024 * 1024 });
  assert.equal(shouldReject(v), false, JSON.stringify(v));
});

test('30 giay ma nang 120MB thi CHAN — do la bitrate cua 4K, khong phai 1080p', () => {
  // 120MB / 30s = 32 Mbps, cao hon ca 1080p/60. Nhan vao chi lam nguoi ban doi them
  // 96 giay tai len de doi lay dung 0 chat luong sau khi ha ve khung 1080x1920.
  const v = validateVideo({ ...CLIP_TOT, durationSec: 30, sizeBytes: 120 * 1024 * 1024 });
  assert.ok(shouldReject(v));
  assert.ok(v.some((p) => p.code === 'TOO_LARGE'));
});

test('codec la bi chan, nhung h264/hevc/vp9/av1 thi nhan', () => {
  assert.ok(shouldReject(validateVideo({ ...CLIP_TOT, codec: 'wmv3' })));
  for (const c of ['h264', 'hevc', 'vp9', 'av1']) {
    assert.equal(shouldReject(validateVideo({ ...CLIP_TOT, codec: c })), false, c);
  }
});

test('codec rong thi KHONG chan — thieu thong tin khong phai ly do tu choi', () => {
  assert.equal(shouldReject(validateVideo({ ...CLIP_TOT, codec: '' })), false);
});

test('khong co luong hinh thi chan ngay va khong kiem tiep', () => {
  const v = validateVideo({ durationSec: 10, codec: 'aac' } as any);
  assert.ok(shouldReject(v));
  assert.equal(v.length, 1, 'bao mot loi ro rang, khong do ca danh sach');
  assert.equal(v[0].code, 'NO_VIDEO_STREAM');
});

test('quay ngang chi CANH BAO, khong chan', () => {
  // Chan thang la chan oan: san pham nam giua khung thi cat doc van dung tot.
  const v = validateVideo({ ...CLIP_TOT, width: 1920, height: 1080 });
  assert.equal(shouldReject(v), false);
  assert.ok(v.some((p) => p.code === 'LANDSCAPE' && p.severity === 'warn'));
});

test('clip duoi 6 giay bi CHAN — khong du cho cho hook + san pham + CTA', () => {
  // Doi chinh sach co chu y 28/10: truoc day chi canh bao. Nhung mot clip 1 giay khong
  // the thanh video ban hang, va de no di tiep thi no chet o cong QA phia sau — luc do
  // khach da cho xong ca luot chong rung va hai lan goi LLM.
  for (const d of [1, 3, 5.9]) {
    const v = validateVideo({ ...CLIP_TOT, durationSec: d });
    assert.ok(shouldReject(v), `clip ${d}s phai bi chan`);
    assert.ok(v.some((p) => p.code === 'TOO_SHORT'));
  }
});

test('clip 6 giay tro len thi NHAN', () => {
  for (const d of [6, 8, 15, 30]) {
    const v = validateVideo({ ...CLIP_TOT, durationSec: d });
    assert.equal(shouldReject(v), false, `clip ${d}s bi chan oan: ${JSON.stringify(v)}`);
  }
});

test('null/undefined khong lam no vo', () => {
  for (const x of [null, undefined, {}]) {
    const v = validateVideo(x as any);
    assert.ok(Array.isArray(v));
    assert.ok(shouldReject(v), 'khong doc duoc thong so thi phai tu choi, khong cho qua');
  }
});

test('moi thong bao deu noi NGUOI BAN CAN LAM GI', () => {
  const v = validateVideo({ width: 480, height: 640, durationSec: 90, codec: 'wmv3', sizeBytes: MAX_CLIP_BYTES * 2 });
  for (const p of v) {
    assert.ok(p.message.length > 20, `thong bao qua ngan: ${p.message}`);
    assert.ok(!/error|invalid|failed/i.test(p.message), `thong bao con chu ky thuat: ${p.message}`);
  }
});

/* ─────────── buildVideoSceneFilter ─────────── */

test('filter video KHONG chua zoompan', () => {
  // Day la dieu quan trong nhat trong file. Video da co chuyen dong that; zoom them
  // la chong hai chuyen dong len nhau, ra cam giac chong mat va lo ngay la may lam.
  const f = buildVideoSceneFilter({
    inputIndex: 2, startSec: 1.5, durationSec: 3, width: 1080, height: 1920, fps: 30, outLabel: 'v2',
  });
  assert.ok(!f.includes('zoompan'), 'spec V3 §3: video quay that KHONG zoom them');
  assert.ok(f.includes('trim='));
  assert.ok(f.includes('crop=1080:1920'));
});

test('filter giu nguyen ti le, khong bop meo', () => {
  const f = buildVideoSceneFilter({
    inputIndex: 0, startSec: 0, durationSec: 3, width: 1080, height: 1920, fps: 30, outLabel: 'v0',
  });
  assert.ok(f.includes('force_original_aspect_ratio=increase'), 'thieu cai nay la nguoi bi keo dai');
  assert.ok(f.includes('setsar=1'));
});

test('filter dat lai moc thoi gian sau khi trim', () => {
  const f = buildVideoSceneFilter({
    inputIndex: 1, startSec: 5, durationSec: 2, width: 1080, height: 1920, fps: 30, outLabel: 'v1',
  });
  // Thieu setpts thi doan cat ra van mang moc thoi gian goc, va concat se chen khoang
  // trong dung bang doan da bo di.
  assert.ok(f.includes('setpts=PTS-STARTPTS'));
});

test('do dai 0 hoac am khong sinh filter hong', () => {
  for (const d of [0, -3]) {
    const f = buildVideoSceneFilter({
      inputIndex: 0, startSec: 0, durationSec: d, width: 1080, height: 1920, fps: 30, outLabel: 'x',
    });
    assert.ok(/duration=0\.1\d*/.test(f), `duration khong duoc <= 0: ${f}`);
  }
});

test('moc bat dau am bi keo ve 0', () => {
  const f = buildVideoSceneFilter({
    inputIndex: 0, startSec: -5, durationSec: 3, width: 1080, height: 1920, fps: 30, outLabel: 'x',
  });
  assert.ok(f.includes('start=0.000'));
});

/* ─────────── pickSegment ─────────── */

test('bo nua giay dau — do la luc tay con cham may, khung con rung', () => {
  const s = pickSegment(20, 3);
  assert.ok(s.startSec >= 0.5, `bat dau o ${s.startSec}, chua bo doan rung`);
  assert.equal(s.durationSec, 3);
});

test('lay tu GIUA clip, khong phai ngay sau doan bo dau', () => {
  const s = pickSegment(20, 3);
  // Clip 20s, can 3s: kha dung 19.5s, giua la 0.5 + (19.5-3)/2 = 8.75
  assert.ok(s.startSec > 5, `lay o ${s.startSec}, le ra phai gan giua clip`);
});

test('clip ngan hon canh can thi lay tat ca, khong bo dau', () => {
  const s = pickSegment(2, 5);
  assert.equal(s.startSec, 0);
  assert.equal(s.durationSec, 2, 'khong duoc doi dai hon clip that co');
});

test('doan lay KHONG BAO GIO vuot qua cuoi clip', () => {
  for (const [clip, can] of [[20, 3], [5, 4], [2, 5], [60, 10], [1, 1]] as const) {
    const s = pickSegment(clip, can);
    assert.ok(
      s.startSec + s.durationSec <= clip + 1e-6,
      `clip ${clip}s, can ${can}s -> lay ${s.startSec}..${s.startSec + s.durationSec}`
    );
  }
});

/* ─────────── parseProbe ─────────── */

const PROBE_MAU = JSON.stringify({
  streams: [
    { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '30000/1001' },
    { codec_type: 'audio', codec_name: 'aac' },
  ],
  format: { duration: '12.345', size: '41943040' },
});

test('doc dung thong so tu ffprobe', () => {
  const m = parseProbe(PROBE_MAU)!;
  assert.equal(m.width, 1080);
  assert.equal(m.height, 1920);
  assert.equal(m.codec, 'h264');
  assert.equal(m.hasAudio, true);
  assert.ok(Math.abs(m.durationSec - 12.345) < 0.001);
});

test('fps la PHAN SO, phai chia ra chu khong doc thang', () => {
  // "30000/1001" la 29.97, khong phai 30000. Doc nham thi moi phep tinh so khung sai
  // ca nghin lan, va bo loc zoom/trim nhan tham so vo nghia.
  assert.equal(parseProbe(PROBE_MAU)!.fps, 29.97);
});

test('mau so 0 trong fps khong gay chia cho 0', () => {
  const j = JSON.stringify({ streams: [{ codec_type: 'video', width: 1080, height: 1920, r_frame_rate: '30/0' }], format: {} });
  const m = parseProbe(j)!;
  assert.ok(Number.isFinite(m.fps) && m.fps > 0, `fps = ${m.fps}`);
});

test('khong co luong hinh thi tra null', () => {
  const j = JSON.stringify({ streams: [{ codec_type: 'audio', codec_name: 'mp3' }], format: {} });
  assert.equal(parseProbe(j), null);
});

test('khong co audio thi hasAudio = false', () => {
  const j = JSON.stringify({ streams: [{ codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920 }], format: {} });
  assert.equal(parseProbe(j)!.hasAudio, false);
});

/* ─────────── isVideoAsset ─────────── */

test('nhan ra video qua mimetype va qua duoi file', () => {
  for (const s of ['video/mp4', 'video/quicktime', 'a.mp4', 'b.MOV', 'c.webm', 'd.mp4?token=x']) {
    assert.equal(isVideoAsset(s), true, s);
  }
});

test('khong nham anh thanh video', () => {
  for (const s of ['image/jpeg', 'a.jpg', 'b.png', 'c.webp', '', null, undefined]) {
    assert.equal(isVideoAsset(s as any), false, String(s));
  }
});

/* ──────── Tran dung luong va tran thoi luong phai KHOP NHAU ──────── */

test('cap tran 30s/100MB phu duoc MOI che do quay 1080p', () => {
  // Day la test cau truc, chan mot loi da lap BA LAN:
  //   - 20MB chung moi file  -> loai gan nhu moi clip that
  //   - 60 giay + 200MB      -> 60s quay 1080p/30 da la 128MB, qua tran
  //   - 80MB + "15-40 giay"  -> 4K cham 80MB o giay thu 13
  //
  // Hai tran phai suy ra tu nhau. Khong thi mot clip hop le ve thoi luong van bi
  // chan vi dung luong, va nguoi ban khong hieu minh sai o dau.
  const CHE_DO: Array<[string, number]> = [
    ['iPhone 1080p/30', 17],
    ['Android 1080p/30', 20],
    ['iPhone 1080p/60', 26],
  ];

  for (const [ten, mbps] of CHE_DO) {
    const nangNhat = (MAX_CLIP_SEC * mbps) / 8 * 1024 * 1024;
    assert.ok(
      nangNhat <= MAX_CLIP_BYTES,
      `${ten}: clip dai dung ${MAX_CLIP_SEC}s nang ${(nangNhat / 1024 / 1024).toFixed(0)}MB, ` +
      `vuot tran ${MAX_CLIP_BYTES / 1024 / 1024}MB — hai tran khong khop nhau`
    );
  }
});

test('clip 1080p/60 dai dung tran KHONG bi tu choi', () => {
  // Che do ngon nhat con hop ly. Lot duoc che do nay thi lot tat ca 1080p.
  const v = validateVideo({
    width: 1080, height: 1920, durationSec: MAX_CLIP_SEC, codec: 'h264',
    fps: 60, hasAudio: true,
    sizeBytes: Math.round((MAX_CLIP_SEC * 26) / 8 * 1024 * 1024),
  });
  assert.equal(shouldReject(v), false, JSON.stringify(v));
});

test('clip 4K bi tu choi KEM cach sua, khong chi bao vuot muc', () => {
  // 4K vo ich o day: dau ra la 1080x1920 nen 4K chi gap ba so byte doi lay dung 0
  // chat luong. Nguoi ban doi mot cai dat la xong — nhung ho phai biet dieu do.
  const v = validateVideo({
    width: 2160, height: 3840, durationSec: 20, codec: 'hevc',
    fps: 30, hasAudio: true, sizeBytes: 200 * 1024 * 1024,
  });
  const loi = v.find((p) => p.code === 'TOO_LARGE');
  assert.ok(loi, 'phai bat duoc file qua nang');
  assert.ok(/1080p/.test(loi!.message), `thong bao phai chi cach sua: ${loi!.message}`);
  assert.ok(/Cài đặt|Camera/i.test(loi!.message), `thong bao phai noi ro vao dau de sua: ${loi!.message}`);
});

test('3 clip day tran van du footage cho mot video 26 giay', () => {
  // Neu khong thi tran qua chat va nguoi ban khong lam noi video dai nhat duoc phep.
  const TOI_DA_CLIP = 3;
  const THANH_PHAM_DAI_NHAT = 26;
  assert.ok(
    MAX_CLIP_SEC * TOI_DA_CLIP >= THANH_PHAM_DAI_NHAT,
    `${TOI_DA_CLIP} clip x ${MAX_CLIP_SEC}s khong du cho video ${THANH_PHAM_DAI_NHAT}s`
  );
});
