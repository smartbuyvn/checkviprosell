/**
 * Khách chọn cách kể, hệ thống không chọn thay.
 *
 * Trước 29/10/2026 tầng 2 luôn sinh đủ BA phương án — painfirst, reviewtrust,
 * offerconversion — rồi `scene-graph.service.ts` lấy `strategies[0]` và vứt hai cái
 * còn lại. Ba lần gọi LLM đã trả tiền, hai phần ba kết quả vào thùng rác, và khách
 * không hề biết mình có lựa chọn nào.
 *
 * Điều quan trọng nhất ở đây: khi khách đã tích một phương án, video phải dùng ĐÚNG
 * phương án đó. Sinh lại tầng 2 lúc dựng thì hook sẽ khác cái vừa tích — cùng một
 * kiểu mất lòng tin với việc báo một giá rồi trừ một giá khác.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Tier2StrategySchema } from '../src/prompts/tiers/tier2-strategy';

const SG = readFileSync(join(__dirname, '..', 'src', 'services', 'scene-graph.service.ts'), 'utf8');
const ROUTE = readFileSync(join(__dirname, '..', 'src', 'routes', 'render.ts'), 'utf8');

test('pipeline doc phuong an khach da chon tu raw_input', () => {
  assert.match(SG, /input\.chien_luoc/, 'Pipeline phai doc `chien_luoc` tu raw_input');
});

test('phuong an khach gui PHAI qua schema truoc khi dung', () => {
  // Du lieu nay di qua trinh duyet nen co the bi sua. Tin thang la de nguoi dung
  // tu dat moi truong trong ke hoach dung.
  assert.match(SG, /Tier2StrategySchema\.safeParse/, 'Phai validate bang schema, khong tin thang');
});

test('phuong an hong thi sinh lai, khong giet ca lan dung', () => {
  const than = SG.slice(SG.indexOf('function docChienLuocDaChon'), SG.indexOf('export const SceneGraphService'));
  assert.match(than, /return null/, 'Hong thi tra null de pipeline sinh lai');
  assert.doesNotMatch(than, /throw /, 'Khong duoc nem loi — mot phuong an hong khong duoc lam hong ca video');
});

test('bo qua goi LLM tang 2 khi da co phuong an', () => {
  // Day la cho tiet kiem that: khong goi lai thi vua nhanh hon vua dam bao hook
  // dung bang cai khach da tich.
  const i = SG.indexOf('const daChon = docChienLuocDaChon');
  const j = SG.indexOf('Step 3');
  const khoi = SG.slice(i, j);
  assert.ok(i >= 0 && j > i, 'Khong tim thay khoi chon phuong an');
  assert.match(khoi, /if \(daChon\)/, 'Phai co nhanh dung lai phuong an da chon');
  assert.match(khoi, /else[\s\S]*generateStrategies/, 'Nhanh con lai moi goi LLM');
});

test('route xem truoc KHONG tru credit', () => {
  const i = ROUTE.indexOf("'/phuong-an'");
  const j = ROUTE.indexOf("'/callback'");
  assert.ok(i >= 0, 'Thieu route /phuong-an');
  const khoi = ROUTE.slice(i, j > i ? j : undefined);
  assert.doesNotMatch(khoi, /deductToLedger/, 'Xem truoc ma tru credit la tinh tien cho thu chua giao');
});

test('route xem truoc kiem quyen so huu du an', () => {
  const i = ROUTE.indexOf("'/phuong-an'");
  const khoi = ROUTE.slice(i, i + 1200);
  assert.match(khoi, /requireProjectOwner/, 'Phai kiem chu so huu — route nay doc anh cua du an');
});

test('route tra ca nguyen van phuong an de luc dung khong sinh lai', () => {
  const i = ROUTE.indexOf("'/phuong-an'");
  const j = ROUTE.indexOf("'/callback'");
  const khoi = ROUTE.slice(i, j > i ? j : undefined);
  assert.match(khoi, /nguyenVan/, 'Thieu nguyen van thi giao dien khong gui lai duoc');
});

test('schema chap nhan mot phuong an day du va tu choi rac', () => {
  const day_du = {
    angle_type: 'reviewtrust',
    creative_angle: 'Bạn bè thử đồ rồi kể lại',
    primary_hook: 'Mặc thử áo trễ vai HAVATA đi chơi',
    cta: 'Xem size trong phần mô tả',
    pacing: 'fast_medium',
    scene_count_target: 6,
  };
  assert.ok(Tier2StrategySchema.safeParse(day_du).success, 'Phuong an day du phai qua duoc');

  for (const rac of [null, 'chuoi', 42, {}, { angle_type: 'reviewtrust' }]) {
    assert.equal(
      Tier2StrategySchema.safeParse(rac).success,
      false,
      `Rac phai bi tu choi: ${JSON.stringify(rac)}`
    );
  }
});
