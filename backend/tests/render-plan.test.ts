import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRenderPlan,
  overlayFontSize,
  inferRole,
  OVERLAY_STYLES,
  SAFE_MARGIN_BOTTOM,
  SAFE_MARGIN_TOP,
} from '../src/lib/render-plan';
import { Tier4RenderPlanSchema } from '../src/prompts/tiers/tier4-render-plan';
import type { Tier3SceneGraph } from '../src/prompts/tiers/tier3-scene-graph';
import { CAMERA_TABLE, SUPPORTED_CAMERA_NAMES } from '../src/lib/camera-moves';
import { validateRenderPlanTier } from '../src/prompts/validators';

/**
 * Tang 4 dung bang code. Truoc day day la mot lan goi LLM, va chinh no da lam video
 * ra VUONG khi khach chon 9:16 (model tu tra "1080x1080", ngay 28/10).
 *
 * Nen test dau tien va quan trong nhat: do phan giai bam theo LUA CHON CUA KHACH.
 */

function doThiCanh(soCanh = 5, aspect = '9:16'): Tier3SceneGraph {
  const scenes: any[] = [];
  let t = 0;
  for (let i = 0; i < soCanh; i++) {
    const dai = i === 0 ? 2 : 3;
    scenes.push({
      scene_id: `s${i + 1}`,
      start_sec: t,
      end_sec: t + dai,
      purpose: i === 0 ? 'hook' : i === soCanh - 1 ? 'cta' : 'benefit',
      asset_ref: `image_${(i % 3) + 1}`,
      visual_type: i === soCanh - 1 ? 'cta_card' : 'product_closeup',
      camera_motion: { type: 'zoom_in', direction: 'center', speed: 'slow' },
      overlay_text: `dong chu canh ${i + 1}`,
      voice_line: 'loi doc tieng Viet',
      subtitle: 'loi doc tieng Viet',
      music_intensity: 'medium',
      safe_region: { title_y: 0.18, subtitle_y: 0.82, cta_y: 0.9 },
    });
    t += dai;
  }
  return {
    video_meta: { aspect_ratio: aspect, duration_sec: t, style: '', target_platform: 'tiktok' },
    scenes,
  } as any;
}

test('DO PHAN GIAI theo ti le KHACH chon, khong theo do thi canh', () => {
  // Do thi canh ghi 1:1, nhung khach chon 9:16. Khach thang.
  const plan = buildRenderPlan(doThiCanh(5, '1:1'), { aspect: '9:16' });
  assert.equal(plan.export.resolution, '1080x1920');
  assert.equal(plan.render_meta.aspect_ratio, '9:16');
});

test('moi ti le cho dung khung hinh cua no', () => {
  const mong: Record<string, string> = {
    '9:16': '1080x1920',
    '16:9': '1920x1080',
    '1:1': '1080x1080',
    '4:5': '1080x1350',
  };
  for (const [aspect, res] of Object.entries(mong)) {
    assert.equal(buildRenderPlan(doThiCanh(5), { aspect }).export.resolution, res, aspect);
  }
});

test('ti le la thi ve 9:16, khong bao gio ra khung rong', () => {
  for (const a of ['', '3:2', 'vuong', undefined as any, null as any]) {
    const plan = buildRenderPlan(doThiCanh(5), { aspect: a });
    assert.equal(plan.export.resolution, '1080x1920');
  }
});

test('720p giu dung ti le, va canh deu chia het cho 2', () => {
  for (const aspect of ['9:16', '16:9', '1:1', '4:5']) {
    const plan = buildRenderPlan(doThiCanh(5), { aspect, quality: 720 });
    const [w, h] = plan.export.resolution.split('x').map(Number);
    assert.equal(w % 2, 0, `${aspect}: chieu rong ${w} le, H.264 khong nhan`);
    assert.equal(h % 2, 0, `${aspect}: chieu cao ${h} le, H.264 khong nhan`);
    assert.equal(Math.min(w, h), 720, `${aspect}: canh ngan phai la 720`);
  }
});

test('ket qua khop schema tang 4 — khong lech hop dong', () => {
  const plan = buildRenderPlan(doThiCanh(6), {
    aspect: '9:16',
    hasVoice: true,
    musicAssetId: 'nhac_1',
  });
  const r = Tier4RenderPlanSchema.safeParse(plan);
  assert.ok(r.success, 'khong khop schema: ' + JSON.stringify((r as any).error?.issues ?? []));
});

test('timeline khop 1-1 voi canh, giu nguyen scene_id va moc thoi gian', () => {
  const sg = doThiCanh(6);
  const plan = buildRenderPlan(sg, { aspect: '9:16' });
  assert.equal(plan.timeline.length, sg.scenes.length);
  for (let i = 0; i < sg.scenes.length; i++) {
    assert.equal(plan.timeline[i].scene_id, sg.scenes[i].scene_id);
    assert.equal(plan.timeline[i].start_sec, sg.scenes[i].start_sec);
    assert.equal(plan.timeline[i].end_sec, sg.scenes[i].end_sec);
  }
});

test('moi asset_id trong timeline deu co trong danh sach assets', () => {
  const plan = buildRenderPlan(doThiCanh(7), { aspect: '9:16' });
  const co = new Set(plan.assets.map((a) => a.asset_id));
  for (const item of plan.timeline) {
    assert.ok(co.has(item.asset_id), `asset ${item.asset_id} khong co trong assets`);
  }
});

test('assets khong trung lap', () => {
  const plan = buildRenderPlan(doThiCanh(9), { aspect: '9:16' });
  const ids = plan.assets.map((a) => a.asset_id);
  assert.equal(ids.length, new Set(ids).size, 'co asset trung: ' + ids.join(','));
});

test('KHONG hai canh lien tiep cung goc may', () => {
  // Do thi canh dua VAO toan 'zoom_in'. Day la loi ngay 28/10: ca video mot goc.
  const plan = buildRenderPlan(doThiCanh(6), { aspect: '9:16' });
  for (let i = 1; i < plan.timeline.length - 1; i++) {
    assert.notEqual(
      plan.timeline[i].motion.type,
      plan.timeline[i - 1].motion.type,
      `canh ${i + 1} lap goc may cua canh ${i}`
    );
  }
});

test('BUOC ZOOM moi khung nam trong gioi han — day la thu chong giat', () => {
  const fps = 30;
  // Canh 1,5 giay la ngan nhat tang 3 duoc phep sinh ra.
  const sg = doThiCanh(5);
  sg.scenes.forEach((s: any, i: number) => {
    s.start_sec = i * 1.5;
    s.end_sec = (i + 1) * 1.5;
  });
  const plan = buildRenderPlan(sg, { aspect: '9:16', fps });

  for (const item of plan.timeline) {
    const khung = Math.max(1, Math.round((item.end_sec - item.start_sec) * fps));
    const buoc = Math.abs(item.motion.zoom_end - item.motion.zoom_start) / khung;
    // Doc tran tu CAMERA_TABLE, KHONG chep lai con so vao day.
    //
    // Ban cu khoa cung 0.0008; khi nang tran de chuyen dong de thay hon thi test do
    // do ma khong phai vi code sai. Cheo con so la tao danh sach song song thu hai —
    // dung cai bay da lam validator troi khoi bang goc may.
    const tran = CAMERA_TABLE[item.motion.type as keyof typeof CAMERA_TABLE]?.maxStepPerFrame ?? 0;
    assert.ok(buoc <= tran + 1e-9, `${item.scene_id} (${item.motion.type}): buoc ${buoc.toFixed(6)} vuot tran ${tran}`);
  }
});

test('chu nam TRONG LE AN TOAN — khong roi vao vung TikTok che', () => {
  const plan = buildRenderPlan(doThiCanh(6), { aspect: '9:16' });
  for (const item of plan.timeline) {
    assert.ok(item.overlay.position_y >= SAFE_MARGIN_TOP, `${item.scene_id} chu qua cao`);
    assert.ok(
      item.overlay.position_y <= 1 - SAFE_MARGIN_BOTTOM,
      `${item.scene_id} chu o ${item.overlay.position_y} — vung caption TikTok che mat`
    );
  }
  assert.ok(plan.subtitle_plan.position_y <= 1 - SAFE_MARGIN_BOTTOM);
});

test('chu qua dai bi cat con 6 tu', () => {
  const sg = doThiCanh(5);
  (sg.scenes[1] as any).overlay_text = 'mot hai ba bon nam sau bay tam chin muoi';
  (sg.scenes[1] as any).overlay_role = 'benefit';
  const plan = buildRenderPlan(sg, { aspect: '9:16' });
  assert.equal(plan.timeline[1].overlay.text.split(/\s+/).length, 6);
});

test('overlay_role = none thi KHONG co chu', () => {
  const sg = doThiCanh(5);
  (sg.scenes[2] as any).overlay_role = 'none';
  (sg.scenes[2] as any).overlay_text = 'chu nay dang le phai bi bo';
  const plan = buildRenderPlan(sg, { aspect: '9:16' });
  assert.equal(plan.timeline[2].overlay.text, '');
});

test('co loi doc thi NHAC LUI XUONG va bat ducking', () => {
  const coLoi = buildRenderPlan(doThiCanh(5), {
    aspect: '9:16',
    hasVoice: true,
    musicAssetId: 'nhac_1',
  });
  const khongLoi = buildRenderPlan(doThiCanh(5), {
    aspect: '9:16',
    hasVoice: false,
    musicAssetId: 'nhac_1',
  });

  assert.ok(
    coLoi.audio_plan.music_volume < khongLoi.audio_plan.music_volume,
    'co loi doc ma nhac khong lui thi hai thu tranh nhau, khong nghe ro loi'
  );
  assert.equal(coLoi.audio_plan.ducking, true);
  assert.equal(coLoi.audio_plan.voiceover_asset_id, 'voiceover');
  assert.equal(khongLoi.audio_plan.voiceover_asset_id, null);
});

test('luon la libx264, khong phai NVENC', () => {
  // Do that 28/10: cung muc bitrate thi libx264 nhanh hon NVENC 10 lan o do dai
  // va do phan giai Viprosell dung.
  assert.equal(buildRenderPlan(doThiCanh(5), { aspect: '9:16' }).export.codec, 'libx264');
});

test('canh dau fade vao, canh cuoi fade ra', () => {
  const plan = buildRenderPlan(doThiCanh(6), { aspect: '9:16' });
  assert.equal(plan.timeline[0].transition_in, 'fade');
  assert.equal(plan.timeline[plan.timeline.length - 1].transition_out, 'fade');
});

test('THUAN: cung dau vao cho cung dau ra', () => {
  // Day la thu ban goi LLM khong bao gio lam duoc, va la ly do loi render truoc day
  // khong tai hien duoc.
  const sg = doThiCanh(6);
  const a = buildRenderPlan(sg, { aspect: '9:16', hasVoice: true });
  const b = buildRenderPlan(sg, { aspect: '9:16', hasVoice: true });
  assert.deepEqual(a, b);
});

test('do thi canh rong khong lam no vo, nhung timeline phai rong de worker chan lai', () => {
  const plan = buildRenderPlan({ video_meta: {}, scenes: [] } as any, { aspect: '9:16' });
  assert.equal(plan.timeline.length, 0);
  assert.ok(plan.assets.length >= 1, 'van phai co it nhat mot asset de khong vo cho khac');
});

test('thieu truong trong canh thi dien mac dinh, khong sinh NaN', () => {
  const plan = buildRenderPlan({ scenes: [{}, {}, {}, {}] } as any, { aspect: '9:16' });
  for (const item of plan.timeline) {
    assert.ok(Number.isFinite(item.start_sec) && Number.isFinite(item.end_sec));
    assert.ok(Number.isFinite(item.motion.zoom_start) && Number.isFinite(item.motion.zoom_end));
    assert.ok(item.scene_id.length > 0);
  }
});

/* ── typography ── */

test('co chu TI LE theo chieu cao khung, khong phai pixel viet cung', () => {
  const o720 = overlayFontSize('hook_bold', 1280);
  const o1080 = overlayFontSize('hook_bold', 1920);
  assert.ok(o1080 > o720, 'khung cao hon phai cho chu lon hon theo pixel');
  // Cung ti le phan tram chieu cao — day la thu ban cu (52px co dinh) lam sai.
  assert.ok(
    Math.abs(o720 / 1280 - o1080 / 1920) < 0.002,
    'ti le phai nhu nhau o hai do phan giai'
  );
});

test('co chu khong bao gio duoi 24px', () => {
  for (const h of [100, 320, 480]) {
    for (const st of Object.values(OVERLAY_STYLES)) {
      assert.ok(overlayFontSize(st.fontStyle, h) >= 24);
    }
  }
});

test('gia la dong chu to nhat, dong chung thuc nho nhat', () => {
  const h = 1920;
  const gia = overlayFontSize('price_heavy', h);
  const hook = overlayFontSize('hook_bold', h);
  const proof = overlayFontSize('proof_light', h);
  assert.ok(gia > hook, 'gia phai to hon hook — do la thu nguoi xem dung lai de doc');
  assert.ok(proof < hook, 'dong chung thuc phai nho hon, no hau thuan chu khong tranh cho');
});

test('font_style la thi van ra co chu dung duoc', () => {
  for (const v of ['', 'khong_co_kieu_nay', null, undefined]) {
    const n = overlayFontSize(v as any, 1920);
    assert.ok(Number.isFinite(n) && n >= 24, `tra ve ${n}`);
  }
});

test('inferRole: canh dau la hook, canh cuoi la cta', () => {
  assert.equal(inferRole('hook', 'product_closeup', 0, 5), 'hook');
  assert.equal(inferRole('', 'cta_card', 4, 5), 'cta');
  assert.equal(inferRole('', 'product_closeup', 4, 5), 'cta', 'canh cuoi luon la cta');
  assert.equal(inferRole('benefit', 'product_closeup', 2, 5), 'benefit');
});

/* ──────── Ke hoach render phai qua duoc cong kiem CUA CHINH NO ──────── */

test('MOI goc may buildRenderPlan phat ra deu duoc validator chap nhan', () => {
  // Day la test le ra phai bat duoc loi ngay 28/10: toi them bo ten goc may moi vao
  // CAMERA_TABLE, buildRenderPlan phat ra chung, nhung `validators.ts` giu mot danh
  // sach RIENG van la bo ten cu. Moi ban render deu truot cong kiem cua chinh he
  // thong voi sau dong "is not supported".
  //
  // Hai danh sach song song la nguyen nhan goc. Gio validator doc thang tu
  // CAMERA_TABLE, va test nay canh cho viec do khong bi lam nguoc lai.
  for (const ten of Object.keys(CAMERA_TABLE)) {
    assert.ok(
      SUPPORTED_CAMERA_NAMES.has(ten),
      `CAMERA_TABLE co "${ten}" nhung validator khong nhan`
    );
  }
});

test('ten goc may CU van duoc chap nhan — ban ghi tu lan chay truoc khong vo', () => {
  for (const ten of ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'push_in', 'static']) {
    assert.ok(SUPPORTED_CAMERA_NAMES.has(ten), `mat tuong thich nguoc voi "${ten}"`);
  }
});

test('ke hoach dung tu do thi canh that PHAI qua validateRenderPlanTier', () => {
  // Kiem ca ham: khong chi ten goc may ma moi truong khac cung phai hop le.
  const plan = buildRenderPlan(doThiCanh(6), { aspect: '9:16', hasVoice: true, musicAssetId: 'nhac_1' });
  const r = validateRenderPlanTier(plan as any);
  assert.ok(r.valid, 'ke hoach truot cong kiem: ' + r.errors.join('; '));
});

test('moi ti le va moi do phan giai deu qua cong kiem', () => {
  for (const aspect of ['9:16', '16:9', '1:1', '4:5']) {
    for (const quality of [720, 1080] as const) {
      const plan = buildRenderPlan(doThiCanh(5), { aspect, quality });
      const r = validateRenderPlanTier(plan as any);
      assert.ok(r.valid, `${aspect} ${quality}p truot: ${r.errors.join('; ')}`);
    }
  }
});
