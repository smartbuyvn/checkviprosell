import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEditCommand, buildStabilizePassCommands, segmentOutSec,
  MUSIC_VOLUME, MUSIC_VOLUME_DUCKED,
} from '../src/lib/video-compose';
import type { Segment } from '../src/lib/video-edit';

/**
 * Rap lenh ffmpeg cho luong dung clip.
 *
 * Khac nhanh anh o mot diem lam don gian di nhieu thu: MOI DOAN den tu CUNG MOT clip,
 * nen chi co mot input va cac doan la cac lat cat khac nhau cua no.
 */

function doan(over: Partial<Segment> = {}): Segment {
  return {
    id: 'a1', role: 'product', in_ms: 2000, out_ms: 7000,
    crop: 'hold', speed: 1, transition_out: 'cut', overlay: '',
    ...over,
  };
}

const CO_BAN = {
  clipPath: '/tmp/clip.mp4',
  segments: [
    doan({ id: 'a1', role: 'hook' as const, in_ms: 8000, out_ms: 10000 }),
    doan({ id: 'a2', in_ms: 0, out_ms: 7000 }),
    doan({ id: 'a3', role: 'proof' as const, in_ms: 11000, out_ms: 19000 }),
  ],
  width: 1080, height: 1920, fps: 30,
  grade: 'none' as const, stabilize: 'off' as const,
  outputPath: '/tmp/out.mp4',
  hasOriginalAudio: true,
  keepOriginalAudio: true,
};

/** Lay chuoi filter_complex ra cho gon. */
function loc(opts: Parameters<typeof buildEditCommand>[0]): string {
  const { args } = buildEditCommand(opts);
  return args[args.indexOf('-filter_complex') + 1];
}

/* ─────────── Cau truc lenh ─────────── */

test('chi MOT input khi khong co nhac', () => {
  const { args } = buildEditCommand(CO_BAN);
  assert.equal(args.filter((a) => a === '-i').length, 1);
});

test('co nhac thi hai input', () => {
  const { args } = buildEditCommand({ ...CO_BAN, musicPath: '/tmp/nhac.mp3' });
  assert.equal(args.filter((a) => a === '-i').length, 2);
});

test('moi doan deu cat tu input 0 — khong nham input', () => {
  const f = loc(CO_BAN);
  for (let i = 0; i < CO_BAN.segments.length; i++) {
    assert.ok(f.includes(`[v${i}]`), `thieu nhan [v${i}]`);
  }
  assert.ok(!f.includes('[1:v]'), 'khong duoc lay hinh tu input nhac');
});

test('dat lai moc thoi gian o MOI doan, ca hinh lan tieng', () => {
  // Thieu no thi doan cat ra van mang moc thoi gian goc, va concat chen khoang trong
  // dung bang doan da bo di.
  //
  // Dem rieng hai luong: `asetpts` CHUA chuoi `setpts`, nen mot phep dem gop se ra
  // gap doi va van xanh ca khi mot trong hai luong thieu han.
  const f = loc(CO_BAN);
  const n = CO_BAN.segments.length;
  assert.equal((f.match(/,setpts=PTS-STARTPTS/g) ?? []).length, n, 'thieu o luong hinh');
  assert.equal((f.match(/,asetpts=PTS-STARTPTS/g) ?? []).length, n, 'thieu o luong tieng');
});

test('lay duoc doan o GIUA clip lam hook — day la diem cot loi cua luong nay', () => {
  assert.ok(loc(CO_BAN).includes('trim=start=8.000'), 'hook nam o giay thu 8 cua clip goc');
});

/* ─────────── Toc do ─────────── */

test('doi toc do thi dong thoi doi CA hinh LAN tieng', () => {
  const f = loc({ ...CO_BAN, segments: [doan({ role: 'hook' as const, speed: 1.1 })] });
  assert.ok(f.includes('setpts=PTS/1.100'), 'thieu doi toc hinh');
  assert.ok(f.includes('atempo=1.100'), 'thieu atempo — giong khach se bi meo nhu hoat hinh');
});

test('toc do 1.0 KHONG sinh filter thua', () => {
  const f = loc(CO_BAN);
  assert.ok(!f.includes('atempo'), 'khong doi toc ma van them atempo');
  assert.ok(!/setpts=PTS\/1\.000/.test(f));
});

test('segmentOutSec chia dung theo toc do', () => {
  assert.equal(segmentOutSec(doan({ in_ms: 0, out_ms: 2000, speed: 1 })), 2);
  assert.ok(Math.abs(segmentOutSec(doan({ in_ms: 0, out_ms: 2000, speed: 1.15 })) - 1.739) < 0.01);
  assert.ok(Math.abs(segmentOutSec(doan({ in_ms: 0, out_ms: 2000, speed: 0.85 })) - 2.353) < 0.01);
});

test('do dai thanh pham cong dung, co tinh toc do', () => {
  const r = buildEditCommand({
    ...CO_BAN,
    segments: [doan({ role: 'hook' as const, in_ms: 0, out_ms: 2000, speed: 1 })],
  });
  assert.ok(Math.abs(r.durationSec - 2) < 0.001);
});

test('segmentStarts tang dan va khop do dai tung doan', () => {
  const r = buildEditCommand(CO_BAN);
  assert.equal(r.segmentStarts[0], 0);
  for (let i = 1; i < r.segmentStarts.length; i++) {
    const mong = r.segmentStarts[i - 1] + segmentOutSec(CO_BAN.segments[i - 1]);
    assert.ok(Math.abs(r.segmentStarts[i] - mong) < 0.001, `moc doan ${i} lech`);
  }
});

/* ─────────── Am thanh: GIU CA HAI ─────────── */

test('giu tieng goc VA nhac nen o 20%', () => {
  const f = loc({ ...CO_BAN, musicPath: '/tmp/nhac.mp3' });
  assert.ok(f.includes(`volume=${MUSIC_VOLUME}`), `thieu muc nhac 20%: ${f}`);
  assert.ok(f.includes('amix=inputs=2'), 'thieu buoc tron hai nguon tieng');
  assert.equal(MUSIC_VOLUME, 0.2);
});

test('nhac khong keo dai video qua phan hinh', () => {
  assert.ok(loc({ ...CO_BAN, musicPath: '/tmp/nhac.mp3' }).includes('duration=first'));
});

test('clip khong co tieng: khong sinh nhanh audio cua input 0', () => {
  const opts = { ...CO_BAN, hasOriginalAudio: false };
  assert.ok(!loc(opts).includes('[0:a]'), 'lay tieng tu clip khong co tieng se lam ffmpeg loi');
  assert.ok(buildEditCommand(opts).args.includes('-an'), 'khong co tieng nao thi phai tat han luong audio');
});

test('clip khong tieng nhung co nhac: van ra video co tieng', () => {
  const { args } = buildEditCommand({ ...CO_BAN, hasOriginalAudio: false, musicPath: '/tmp/nhac.mp3' });
  assert.ok(!args.includes('-an'));
  assert.ok(args.includes('-c:a'));
});

test('bo tieng goc theo y nguoi goi', () => {
  assert.ok(!loc({ ...CO_BAN, keepOriginalAudio: false }).includes('[0:a]'));
});

test('luon chuan hoa am luong', () => {
  assert.ok(loc(CO_BAN).includes('loudnorm'), 'thieu loudnorm thi video luc to luc nho');
});

/* ─────────── Co nhac cua worker la NGUON DUNG ─────────── */

test('clip DA co nhac thi BO nhac thu vien, du nguoi goi van truyen vao', () => {
  // Ham ghep khong dua vao viec QA co chay hay khong. Chong mot bai hat thu vien len
  // mot clip da co nhac la hai bai phat cung luc.
  const f = loc({ ...CO_BAN, musicPath: '/tmp/nhac.mp3', musicBedLikely: true });
  assert.ok(!f.includes('[1:a]'), 'van lay nhac thu vien du clip da co nhac');
  assert.ok(!f.includes('amix'), 'van tron hai nguon nhac');
});

test('co nhac thi chi con MOT input', () => {
  const { args } = buildEditCommand({ ...CO_BAN, musicPath: '/tmp/nhac.mp3', musicBedLikely: true });
  assert.equal(args.filter((a) => a === '-i').length, 1);
});

test('clip khong co nhac thi van lot nhac thu vien binh thuong', () => {
  const f = loc({ ...CO_BAN, musicPath: '/tmp/nhac.mp3', musicBedLikely: false });
  assert.ok(f.includes('amix=inputs=2'));
});

/* ─────────── Fade 12ms chong click ─────────── */

test('moi doan tieng co fade hai dau', () => {
  // Cat giua chu ky song tao ra buoc nhay bien do, tai nghe thanh tieng tach.
  const f = loc(CO_BAN);
  const n = CO_BAN.segments.length;
  assert.equal((f.match(/afade=t=in/g) ?? []).length, n, 'thieu fade dau doan');
  assert.equal((f.match(/afade=t=out/g) ?? []).length, n, 'thieu fade cuoi doan');
});

test('fade dung 12ms, KHONG dai hon', () => {
  // Dai hon la nghe thanh tieng phai, va tren clip co nhac thi moi lan phai la bai
  // hat mo di roi ro lai — lo cho cat ro hon la de nguyen.
  const f = loc(CO_BAN);
  const ds = [...f.matchAll(/afade=t=\w+:st=[\d.]+:d=([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(ds.length > 0);
  for (const d of ds) assert.ok(Math.abs(d - 0.012) < 1e-6, `fade ${d}s, phai la 0.012s`);
});

/* ─────────── Nhac bam dong ho THANH PHAM ─────────── */

test('nhac thu vien KHONG bi cat theo tung doan', () => {
  // No khong thuoc clip goc nen khong co ly do gi phai dut theo cho cat.
  const f = loc({ ...CO_BAN, musicPath: '/tmp/nhac.mp3' });
  assert.equal((f.match(/\[1:a\]/g) ?? []).length, 1, 'nhac bi cat thanh nhieu manh');
});

test('nhac hai muc: 20% nen, ha them khi co loi', () => {
  const f = loc({ ...CO_BAN, musicPath: '/tmp/nhac.mp3' });
  assert.ok(f.includes(`volume=${MUSIC_VOLUME}`));
  assert.ok(f.includes('sidechaincompress'), 'thieu buoc ha nhac khi co tieng noi');
  assert.ok(MUSIC_VOLUME_DUCKED < MUSIC_VOLUME);
});

/* ─────────── Chong rung hai luot ─────────── */

const NAN = { clipPath: '/tmp/c.mp4', level: 'light' as const, width: 1080, height: 1920 };

test('stabilize off thi KHONG sinh lenh nao', () => {
  // vidstab giai ma clip them hai lan; bat no khi khong can la tra gia vo ich.
  assert.equal(buildStabilizePassCommands({ ...NAN, level: 'off' }), null);
});

test('light va medium khac nhau o do manh', () => {
  const l = buildStabilizePassCommands(NAN)!;
  const m = buildStabilizePassCommands({ ...NAN, level: 'medium' })!;
  assert.ok(l.detect.join(' ').includes('shakiness=3'));
  assert.ok(m.detect.join(' ').includes('shakiness=5'));
});

test('luot 1 KHONG xuat file video', () => {
  const l = buildStabilizePassCommands(NAN)!;
  assert.ok(l.detect.includes('-f') && l.detect.includes('null'));
});

test('HA KHUNG TRUOC roi moi chong rung — do that: 4,5s thay vi 26,1s', () => {
  // Va no con DUNG hon: vector trong .trf tinh theo pixel cua do phan giai luc phan
  // tich, nen phan tich o 4K roi ap len ban 1080 la sai ti le dich chuyen.
  const l = buildStabilizePassCommands(NAN)!;
  for (const cmd of [l.detect, l.transform]) {
    const vf = cmd[cmd.indexOf('-vf') + 1];
    const iScale = vf.indexOf('scale=');
    const iStab = vf.indexOf('vidstab');
    assert.ok(iScale >= 0 && iStab > iScale, `vidstab phai nam SAU scale: ${vf}`);
  }
});

test('ten file .trf la TEN TRAN, khong phai duong dan', () => {
  // Duong dan day du lam ffmpeg tra -22: ':' trong 'D:' la dau phan cach tham so cua
  // filter. Da do that tren may Windows 28/10 — ca bon cach thoat dau deu that bai,
  // chi `cwd` + ten tran chay duoc.
  const l = buildStabilizePassCommands(NAN)!;
  assert.ok(!/[\\/:]/.test(l.trfName),
    `trfName phai tran: ${l.trfName}`);
  assert.ok(l.detect.join(' ').includes(`result=${l.trfName}`));
  assert.ok(l.transform.join(' ').includes(`input=${l.trfName}`));
});

test('ban trung gian GIU tieng goc', () => {
  // No phai mang giong khach sang buoc cat; mat tieng o day la mat han.
  const l = buildStabilizePassCommands(NAN)!;
  assert.ok(l.transform.includes('copy'), 'thieu -c:a copy');
});

test('chuoi filter chinh KHONG con vidstab — da nan o buoc truoc', () => {
  // Chay vidstab trong chuoi chinh la sai: no doc .trf tuan tu theo so khung, ma o do
  // clip da bi cat thanh tung doan nen so khung khong con khop voi file do.
  assert.ok(!loc({ ...CO_BAN, stabilize: 'light' }).includes('vidstabtransform'));
});

/* ─────────── Chu tren man hinh ─────────── */

test('duong dan .ass tren Windows duoc thoat dau hai cham', () => {
  // ':' la dau phan cach tham so cua filter; de nguyen la ffmpeg hieu 'D' la mot
  // tham so. Cung cai bay da mat nhieu lan thu o nhanh phu de.
  const f = loc({ ...CO_BAN, assPath: 'D:\\tmp\\phude.ass' });
  assert.ok(f.includes('D\\:/tmp/phude.ass'), `duong dan chua thoat: ${f}`);
});

test('khong co .ass thi khong them buoc subtitles', () => {
  assert.ok(!loc(CO_BAN).includes('subtitles='));
});

/* ─────────── Dau ra ─────────── */

test('xuat dung kho khach chon, khong phai kho clip goc', () => {
  for (const [w, h] of [[1080, 1920], [1920, 1080]] as const) {
    assert.ok(loc({ ...CO_BAN, width: w, height: h }).includes(`crop=${w}:${h}`), `thieu kho ${w}x${h}`);
  }
});

test('luon libx264 va faststart', () => {
  const { args } = buildEditCommand(CO_BAN);
  assert.ok(args.includes('libx264'));
  assert.ok(args.includes('+faststart'), 'thieu faststart thi video phai tai het moi phat duoc');
});

test('mot doan duy nhat van rap duoc', () => {
  const r = buildEditCommand({ ...CO_BAN, segments: [doan({ role: 'hook' as const })] });
  assert.ok(r.args.length > 0);
  assert.equal(r.segmentStarts.length, 1);
});

/* ─────────── concat: THU TU nhan ─────────── */

test('concat nhan XEN KE [v0][a0][v1][a1] — khong gom theo loai', () => {
  // Loi that bat duoc khi chay ffmpeg 28/10: gom thanh [v0][v1][v2][a0][a1][a2] thi
  // ffmpeg noi pad hinh cua doan 2 vao pad tieng cua concat va tra
  // "Media type mismatch ... Error linking filters", ma -22.
  //
  // Test cu chi kiem nhan CO MAT nen van xanh ca khi thu tu sai.
  const f = loc(CO_BAN);
  const m = /((?:\[[va]\d+\])+)concat=/.exec(f);
  assert.ok(m, `khong tim thay chuoi nhan truoc concat: ${f}`);
  const mong = CO_BAN.segments.map((_, i) => `[v${i}][a${i}]`).join('');
  assert.equal(m![1], mong, 'thu tu nhan sai');
});

test('khong co tieng goc thi concat chi nhan nhan hinh', () => {
  const f = loc({ ...CO_BAN, hasOriginalAudio: false });
  const m = /((?:\[[va]\d+\])+)concat=/.exec(f);
  assert.equal(m![1], CO_BAN.segments.map((_, i) => `[v${i}]`).join(''));
  assert.ok(f.includes('a=0'));
});
