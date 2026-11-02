import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Chan loai loi: code ghi mot cot ma khong migration nao tao ra.
 *
 * Ngay 27/10 production bao RENDER_INSERT_FAILED vi scene_graph_json khong ton
 * tai. Migration 20261026000001 ghi nguon la db/13-render-pipeline.sql nhung
 * chi mang sang 5 trong 10 thu cua file do. Loi chi lo ra khi khach bam Render.
 */

const MIG_DIR = path.join(__dirname, '..', '..', 'supabase', 'migrations');

function allMigrationSql(): string {
  return fs
    .readdirSync(MIG_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => fs.readFileSync(path.join(MIG_DIR, f), 'utf8'))
    .join('\n');
}

/** Bo phan chu thich de khong nham mot cot duoc NHAC trong comment voi cot duoc TAO. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
}

// Cot ma backend ghi vao bang renders. Them cot moi vao code thi them o day.
const REQUIRED_COLUMNS = [
  'project_id',
  'render_mode',
  'aspect_ratio',
  'status',
  'progress',
  'output_url',
  'error_code',
  'error_message',
  'duration_ms',
  'thumbnail_url',
  'raw_input',
  'scene_graph_json',
  'product_brief_json',
  'strategy_json',
  'render_plan_json',
];

test('moi cot code ghi vao renders deu co migration tao ra', () => {
  const sql = stripComments(allMigrationSql());
  // Tach thanh tung tu thay vi includes(): 'status' nam trong 'render_status',
  // nen includes() se bao co trong khi cot that su chua duoc tao.
  const tokens = new Set(sql.split(/[^A-Za-z0-9_]+/));
  const missing = REQUIRED_COLUMNS.filter((c) => !tokens.has(c));
  assert.deepEqual(missing, [], `Cot chua co migration nao tao: ${missing.join(', ')}`);
});

test("render_status co 'pending' vi worker chi lang nghe status=eq.pending", () => {
  const sql = stripComments(allMigrationSql());
  assert.match(
    sql,
    /ALTER TYPE public\.render_status ADD VALUE IF NOT EXISTS 'pending'/,
    "Thieu 'pending': composition.service.ts insert gia tri nay va render.worker.ts loc theo no"
  );
});

test("chi muc tren 'pending' nam o migration khac voi noi them gia tri enum", () => {
  // Postgres khong cho dung gia tri enum vua them trong cung transaction.
  const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql'));

  const addsValue = files.filter((f) =>
    /ALTER TYPE public\.render_status ADD VALUE[^;]*'pending'/.test(
      stripComments(fs.readFileSync(path.join(MIG_DIR, f), 'utf8'))
    )
  );
  const usesValue = files.filter((f) =>
    /CREATE INDEX[^;]*WHERE status = 'pending'/s.test(
      stripComments(fs.readFileSync(path.join(MIG_DIR, f), 'utf8'))
    )
  );

  assert.ok(addsValue.length > 0, 'khong tim thay migration them gia tri pending');
  assert.ok(usesValue.length > 0, 'khong tim thay migration tao chi muc pending');
  for (const f of usesValue) {
    assert.ok(
      !addsValue.includes(f),
      `${f} vua them gia tri enum vua dung no - Postgres se tu choi`
    );
  }
});
