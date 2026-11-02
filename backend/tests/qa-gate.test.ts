import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qaCheck, scrub, scrubPlanOverlays, formatFindings } from '../src/lib/qa-gate';
import type { Tier3SceneGraph } from '../src/prompts/tiers/tier3-scene-graph';

/**
 * Cong kiem truoc khi render.
 *
 * Day la ma CHAN RUI RO PHAP LY, khong phai ma lam dep video: Viprosell ban cho nguoi
 * mua that bang tien that, va quang cao noi sai thi nguoi ban chiu. Nen test o day
 * nghiem ve hai huong:
 *   - Bat duoc khang dinh bia (khong bo sot).
 *   - KHONG bat nham cau noi that (khong pha kich ban dung).
 * Huong thu hai quan trong khong kem: mot bo loc bat nham qua nhieu se bi tat.
 */

function canh(over: Partial<any> = {}, i = 0): any {
  return {
    scene_id: `s${i + 1}`,
    start_sec: i * 3,
    end_sec: (i + 1) * 3,
    purpose: 'benefit',
    asset_ref: 'image_1',
    visual_type: 'product_closeup',
    camera_motion: { type: 'hero_push', direction: 'center', speed: 'slow' },
    overlay_text: 'dong chu binh thuong',
    voice_line: 'mot cau noi binh thuong ve san pham',
    subtitle: 'mot cau noi binh thuong ve san pham',
    music_intensity: 'medium',
    safe_region: { title_y: 0.18, subtitle_y: 0.82, cta_y: 0.9 },
    ...over,
  };
}

function doThi(scenes: any[]): Tier3SceneGraph {
  return {
    video_meta: { aspect_ratio: '9:16', duration_sec: scenes.length * 3, style: '', target_platform: 'tiktok' },
    scenes,
  } as any;
}

/* ───────────────── scrub ───────────────── */

test('bat khang dinh xep hang', () => {
  for (const cau of [
    'San pham tot nhat thi truong',
    'Thuong hieu so 1 Viet Nam',
    'Gia re nhat hien nay',
    'Hang dau trong nganh',
  ]) {
    const { removed } = scrub(cau);
    assert.equal(removed.length, 1, `khong bat duoc: "${cau}"`);
  }
});

test('bat khang dinh xep hang KHONG DAU', () => {
  // Model doi khi tra ve khong dau. "tot nhat" va "tốt nhất" phai cung bi bat.
  const { removed } = scrub('San pham tot nhat thi truong hien nay');
  assert.equal(removed.length, 1);
});

test('bat loi hua ket qua va khang dinh y te', () => {
  for (const cau of [
    'Giam 5kg sau mot thang',
    'Het mun sau 7 ngay',
    'Dieu tri tan goc',
    'Khong tac dung phu',
  ]) {
    assert.ok(scrub(cau).removed.length >= 1, `khong bat duoc: "${cau}"`);
  }
});

test('bat khan hiem gia va bang chung xa hoi bia', () => {
  assert.ok(scrub('Chi con 3 suat cuoi cung').removed.length >= 1);
  assert.ok(scrub('Sap het hang roi nhe').removed.length >= 1);
  assert.ok(scrub('Da co 15.000 nguoi mua').removed.length >= 1);
});

test('bat cam ket va chung nhan khong co trong brief', () => {
  assert.ok(scrub('Cam ket 100% chinh hang').removed.length >= 1);
  assert.ok(scrub('Bao hanh tron doi').removed.length >= 1);
  assert.ok(scrub('Dat chuan quoc te').removed.length >= 1);
});

test('KHONG bat nham cau noi that — day la huong sai nguy hiem hon', () => {
  // Bo loc bat nham qua nhieu thi se bi tat, va luc do no khong chan gi nua.
  for (const cau of [
    'Chat lieu thep khong gi, chong an mon',
    'Dung cho ca ngay khong moi tay',
    'Gia 250.000 dong, da gom van chuyen',
    'Co 3 mau de chon',
    'Nho gon, bo vua tui ao',
    'Pin dung duoc 8 tieng lien tuc',
    'Giao hang trong 2 ngay',
  ]) {
    assert.equal(scrub(cau).removed.length, 0, `bat nham cau that: "${cau}"`);
  }
});

test('got menh de vi pham, GIU phan con lai doc duoc', () => {
  const { text, removed } = scrub('San pham tot nhat thi truong, dung ca ngay khong moi tay');
  assert.equal(removed.length, 1);
  assert.ok(text.includes('dung ca ngay khong moi tay'), `con lai: "${text}"`);
  assert.ok(!text.includes('tot nhat'), 'van con khang dinh sai');
});

test('got xong khong de lai dau cau thua o dau cau', () => {
  const { text } = scrub('Tot nhat thi truong, ben va nhe');
  assert.ok(!/^[,;.!?\s]/.test(text), `dau cau bi thua: "${text}"`);
});

test('cau rong hoac null khong lam no vo', () => {
  for (const v of ['', '   ', null, undefined]) {
    const r = scrub(v as any);
    assert.equal(r.text, '');
    assert.equal(r.removed.length, 0);
  }
});

/* ───────────────── qaCheck ───────────────── */

test('got CA overlay_text, voice_line VA subtitle', () => {
  // Thieu subtitle thi khang dinh sai van hien duoi dang phu de.
  const r = qaCheck(doThi([
    canh({
      overlay_text: 'Tot nhat thi truong',
      voice_line: 'San pham tot nhat thi truong, rat ben',
      subtitle: 'San pham tot nhat thi truong, rat ben',
    }, 0),
    canh({}, 1), canh({}, 2), canh({}, 3),
  ]));

  const s0: any = r.sceneGraph.scenes[0];
  assert.ok(!s0.overlay_text.includes('tot nhat'), 'overlay chua got');
  assert.ok(!s0.voice_line.includes('tot nhat'), 'loi doc chua got');
  assert.ok(!s0.subtitle.includes('tot nhat'), 'phu de chua got');
});

test('kich ban sach thi khong co phat hien nao', () => {
  const r = qaCheck(doThi([canh({}, 0), canh({}, 1), canh({}, 2), canh({}, 3)]));
  const nang = r.findings.filter((f) => f.severity !== 'warn');
  assert.equal(nang.length, 0, JSON.stringify(r.findings));
  assert.equal(r.shouldBlock, false);
});

test('CHAN khi loi doc got xong khong con gi de noi', () => {
  const r = qaCheck(doThi([
    canh({ voice_line: 'Tot nhat thi truong' }, 0),
    canh({}, 1), canh({}, 2), canh({}, 3),
  ]));
  assert.ok(r.shouldBlock, 'canh im lang giua video doc ra nhu video loi');
  assert.ok(r.findings.some((f) => f.severity === 'block'));
});

test('CHAN khi QUA NUA so canh phai got', () => {
  // Mot cau sai thi bo cau do la xong. Qua nua kich ban dung tren khang dinh bia thi
  // phan con lai chi la vo rong, tha chay lai.
  const r = qaCheck(doThi([
    canh({ voice_line: 'San pham tot nhat, rat ben' }, 0),
    canh({ voice_line: 'Re nhat thi truong, dung tot' }, 1),
    canh({ voice_line: 'Da co 20.000 nguoi mua, chat luong on' }, 2),
    canh({}, 3),
  ]));
  assert.ok(r.shouldBlock, 'qua nua kich ban bia ma van cho render');
});

test('KHONG chan khi chi mot canh phai got', () => {
  const r = qaCheck(doThi([
    canh({ voice_line: 'San pham tot nhat, nhung rat ben va nhe' }, 0),
    canh({}, 1), canh({}, 2), canh({}, 3),
  ]));
  assert.equal(r.shouldBlock, false, 'mot cau sai thi bo cau do, khong bo ca video');
  assert.ok(r.findings.some((f) => f.severity === 'fix'));
});

test('bat chu tren man hinh lap dung loi doc', () => {
  const r = qaCheck(doThi([
    canh({ overlay_text: 'ben va nhe moi ngay', voice_line: 'ben va nhe moi ngay' }, 0),
    canh({}, 1), canh({}, 2), canh({}, 3),
  ]));
  assert.ok(
    r.findings.some((f) => f.field === 'overlay_text' && f.reason.includes('lặp')),
    'khong bat duoc chu lap loi doc'
  );
});

test('chu lap loi doc chi la luu y, KHONG chan render', () => {
  const r = qaCheck(doThi([
    canh({ overlay_text: 'ben va nhe moi ngay', voice_line: 'ben va nhe moi ngay' }, 0),
    canh({}, 1), canh({}, 2), canh({}, 3),
  ]));
  assert.equal(r.shouldBlock, false, 'lang phi thi dang tiec, nhung khong phai ly do huy video');
});

test('bat khe ho giua hai canh — se ra khung den', () => {
  const r = qaCheck(doThi([
    canh({ start_sec: 0, end_sec: 3 }, 0),
    canh({ start_sec: 5, end_sec: 8 }, 1),
    canh({ start_sec: 8, end_sec: 11 }, 2),
    canh({ start_sec: 11, end_sec: 14 }, 3),
  ]));
  const f = r.findings.find((x) => x.field === 'timing');
  assert.ok(f, 'khong bat duoc khe ho');
  assert.ok(f!.reason.includes('khe hở'), f!.reason);
});

test('bat chong lan giua hai canh', () => {
  const r = qaCheck(doThi([
    canh({ start_sec: 0, end_sec: 5 }, 0),
    canh({ start_sec: 3, end_sec: 8 }, 1),
    canh({ start_sec: 8, end_sec: 11 }, 2),
    canh({ start_sec: 11, end_sec: 14 }, 3),
  ]));
  assert.ok(r.findings.some((x) => x.field === 'timing' && x.reason.includes('chồng lấn')));
});

test('lech duoi 0,05s thi bo qua — do la sai so lam tron, khong phai loi', () => {
  const r = qaCheck(doThi([
    canh({ start_sec: 0, end_sec: 3 }, 0),
    canh({ start_sec: 3.02, end_sec: 6 }, 1),
    canh({ start_sec: 6, end_sec: 9 }, 2),
    canh({ start_sec: 9, end_sec: 12 }, 3),
  ]));
  assert.equal(r.findings.filter((x) => x.field === 'timing').length, 0);
});

test('bat video dai lech qua 20% so voi thu khach dat', () => {
  const scenes = [canh({}, 0), canh({}, 1), canh({}, 2), canh({}, 3)]; // 12 giay
  assert.ok(qaCheck(doThi(scenes), 20).findings.some((f) => f.field === 'timing'));
  assert.equal(qaCheck(doThi(scenes), 12).findings.filter((f) => f.field === 'timing').length, 0);
});

test('bat goc may don dieu', () => {
  const scenes = [0, 1, 2, 3, 4].map((i) =>
    canh({ camera_motion: { type: 'hero_push', direction: 'center', speed: 'slow' } }, i)
  );
  assert.ok(qaCheck(doThi(scenes)).findings.some((f) => f.field === 'camera'));
});

test('do thi canh rong khong lam no vo', () => {
  const r = qaCheck(doThi([]));
  assert.equal(r.shouldBlock, false);
  assert.equal(r.findings.length, 0);
});

test('KHONG sua kich ban goc — tra ve ban moi', () => {
  const goc = doThi([canh({ voice_line: 'San pham tot nhat, rat ben' }, 0), canh({}, 1), canh({}, 2), canh({}, 3)]);
  const truoc = JSON.stringify(goc);
  qaCheck(goc);
  assert.equal(JSON.stringify(goc), truoc, 'da sua vao kich ban goc — se kho lan lai khi dieu tra');
});

/* ───────────────── scrubPlanOverlays ───────────────── */

test('got chu overlay trong ke hoach co san', () => {
  const plan = {
    timeline: [
      { overlay: { text: 'Tot nhat thi truong' } },
      { overlay: { text: 'ben va nhe' } },
      { overlay: { text: '' } },
      {},
    ],
  };
  assert.equal(scrubPlanOverlays(plan as any), 1);
  assert.equal(plan.timeline[0].overlay!.text, '');
  assert.equal(plan.timeline[1].overlay!.text, 'ben va nhe', 'khong duoc dung vao dong sach');
});

test('ke hoach rong hoac thieu timeline khong lam no vo', () => {
  assert.equal(scrubPlanOverlays({} as any), 0);
  assert.equal(scrubPlanOverlays({ timeline: [] } as any), 0);
  assert.equal(scrubPlanOverlays(null as any), 0);
});

/* ───────────────── formatFindings ───────────────── */

test('xep CHAN len truoc luu y', () => {
  const dong = formatFindings([
    { sceneId: 's2', field: 'camera', severity: 'warn', reason: 'don dieu' },
    { sceneId: 's1', field: 'voice_line', severity: 'block', reason: 'got xong het chu' },
    { sceneId: 's3', field: 'overlay_text', severity: 'fix', reason: 'khang dinh bia' },
  ]);
  assert.ok(dong[0].includes('CHẶN'), dong[0]);
  assert.ok(dong[2].includes('lưu ý'), dong[2]);
});

/* ──────────── Bay dau dau tieng Viet ──────────── */

test('MOI mau cam phai bat duoc CA ban co dau va ban khong dau', () => {
  // Day la test cau truc, khong phai test mot ca cu the.
  //
  // Hai loi that da lot qua: `tr[ọo]n\s*đ[ờo]i` viet cung chu `đ` nen "bao hanh tron
  // doi" khong bi bat, va `...%\b` khong bao gio khop vi `%` lan khoang trang deu
  // khong phai ky tu chu. Model thuong tra ve khong dau, nen mot mau chi bat ban co
  // dau la bat duoc dung mot nua truong hop that.
  const CAP: Array<[string, string]> = [
    ['Sản phẩm số 1 thị trường', 'San pham so 1 thi truong'],
    ['Loại tốt nhất hiện nay', 'Loai tot nhat hien nay'],
    ['Độc quyền duy nhất tại Việt Nam', 'Doc quyen duy nhat tai Viet Nam'],
    ['Giảm 5kg sau một tháng', 'Giam 5kg sau mot thang'],
    ['Điều trị tận gốc', 'Dieu tri tan goc'],
    ['Chỉ còn 3 suất cuối', 'Chi con 3 suat cuoi'],
    ['Đã có 15.000 người mua', 'Da co 15.000 nguoi mua'],
    ['Cam kết 100% chính hãng', 'Cam ket 100% chinh hang'],
    ['Bảo hành trọn đời', 'Bao hanh tron doi'],
    ['Được chứng nhận quốc tế', 'Duoc chung nhan quoc te'],
    ['Đạt chuẩn quốc tế', 'Dat chuan quoc te'],
  ];

  for (const [coDau, khongDau] of CAP) {
    assert.ok(scrub(coDau).removed.length >= 1, `bo sot ban CO DAU: "${coDau}"`);
    assert.ok(scrub(khongDau).removed.length >= 1, `bo sot ban KHONG DAU: "${khongDau}"`);
  }
});
