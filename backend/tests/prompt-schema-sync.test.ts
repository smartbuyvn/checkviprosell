import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TIER2_USER_TEMPLATE, Tier2BatchSchema } from '../src/prompts/tiers/tier2-strategy';
import { TIER3_USER_TEMPLATE, Tier3SceneGraphSchema } from '../src/prompts/tiers/tier3-scene-graph';

/**
 * Chan loai loi da lam vo ca 3 tang ngay 27/10.
 *
 * Schema Zod la hop dong, nhung prompt khong mang hop dong do theo. Tier 3 va tier 4
 * chi noi dung mot cau ("Return the scene graph JSON.") nen model phai tu bia ten truong;
 * tier 2 liet ke ten truong nhung khong noi kieu. Ket qua:
 *   - scenes.0.start_sec: expected number, received undefined
 *   - strategies.0.primary_hook: expected string, received object
 *   - root: expected object, received array
 *
 * Vas tay tung prompt khong ben: lan sau ai sua schema ma quen prompt la lech lai.
 * Test nay doc ban mau JSON trong chinh prompt roi nem qua chinh schema cua tang do.
 */

/** Lay khoi JSON dau tien nam o dau dong trong prompt, khop ngoac de khong an phan sau. */
function extractExampleJson(template: string): string {
  const start = template.indexOf('\n{\n');
  assert.notEqual(start, -1, 'prompt khong co khoi JSON mau nao o dau dong');

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < template.length; i++) {
    const ch = template[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return template.slice(start + 1, i + 1);
    }
  }

  throw new Error('khoi JSON mau trong prompt khong dong ngoac');
}

/**
 * Bo qua loi "mang qua ngan": ban mau co y chi dua MOT phan tu cho gon, trong khi
 * schema doi it nhat 4 canh. Cai can kiem o day la TEN TRUONG va KIEU, khong phai so luong.
 */
function realIssues(error: any): any[] {
  return (error?.issues ?? []).filter((i: any) => i.code !== 'too_small');
}

const CASES: Array<[string, string, { safeParse: (v: unknown) => any }]> = [
  ['tier 2 (strategy)', TIER2_USER_TEMPLATE, Tier2BatchSchema],
  ['tier 3 (scene graph)', TIER3_USER_TEMPLATE, Tier3SceneGraphSchema],
  // Tang 4 KHONG con o day: no khong goi LLM nua, duoc dung bang code trong
  // lib/render-plan.ts va kiem bang tests/render-plan.test.ts. Giu lai dong nay
  // thi test van xanh nhung khong con canh giu gi — dung loai bay da cat chung ta
  // mot lan voi tsconfig "files": [] (bao "tsc 0 loi" trong khi khong kiem file nao).
];

for (const [name, template, schema] of CASES) {
  test(`${name}: ban mau trong prompt la JSON hop le`, () => {
    const raw = extractExampleJson(template);
    assert.doesNotThrow(() => JSON.parse(raw), `ban mau cua ${name} khong parse duoc`);
  });

  test(`${name}: ban mau trong prompt khop schema`, () => {
    const example = JSON.parse(extractExampleJson(template));
    const result = schema.safeParse(example);

    if (!result.success) {
      const bad = realIssues(result.error);
      assert.deepEqual(
        bad.map((i: any) => `${i.path.join('.')}: ${i.message}`),
        [],
        `Prompt cua ${name} day model ra ket qua schema tu choi. Sua prompt HOAC schema cho khop.`
      );
    }
  });
}

test('tang nao cung noi ro goc phai la object, khong phai mang', () => {
  // Loi that: "root: Invalid input: expected object, received array".
  for (const [name, template] of CASES.map(([n, t]) => [n, t] as const)) {
    assert.match(
      template,
      /never a bare array/i,
      `${name}: prompt chua dan model rang goc phai la object`
    );
  }
});

test('goc la mang thi duoc boc lai chu khong bo ca lan goi', () => {
  // Day la duong lui khi model van lech du prompt da noi ro.
  const scenes = Array.from({ length: 4 }, (_, i) => ({
    scene_id: `s${i + 1}`,
    start_sec: i * 3,
    end_sec: (i + 1) * 3,
  }));

  const result = Tier3SceneGraphSchema.safeParse(scenes);
  assert.equal(result.success, true, 'mang canh o goc dang le phai duoc boc lai thanh { scenes }');
});
