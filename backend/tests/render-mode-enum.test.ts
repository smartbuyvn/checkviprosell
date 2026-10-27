/**
 * Chan hoi quy lech enum render_mode.
 *
 * Loi that da xay ra tren production: frontend gui 'draftlocaltts', backend insert
 * thang vao DB, Postgres tu choi ca cau lenh ("invalid input value for enum
 * render_mode"). Test nay doi chieu bang anh xa cua backend voi dinh nghia enum
 * trong migration — nguon su that — nen khong the lech ma khong hong test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { toDbRenderMode } from '../src/lib/render-mode';

/** Doc gia tri enum render_mode that tu migration thay vi viet cung trong test. */
function enumValuesFromMigrations(): string[] {
  const dir = join(__dirname, '..', '..', 'supabase', 'migrations');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql'))) {
    const m = readFileSync(join(dir, f), 'utf8')
      .match(/CREATE TYPE public\.render_mode AS ENUM \(([^)]*)\)/);
    if (m) return m[1].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
  }
  throw new Error('Khong tim thay CREATE TYPE render_mode trong supabase/migrations');
}

const DB_VALUES = enumValuesFromMigrations();

test('migration van dinh nghia du 3 gia tri render_mode', () => {
  assert.deepEqual(DB_VALUES, ['draft_local', 'draft_local_tts', 'premium_cloud']);
});

test('gia tri frontend gui len deu doi duoc sang enum hop le', () => {
  // Dung cac gia tri frontend thuc su dung trong src/pages/NewProject.tsx
  for (const sent of ['draft_local', 'draftlocaltts', 'premiumcloud']) {
    const mapped = toDbRenderMode(sent);
    assert.ok(DB_VALUES.includes(mapped), `"${sent}" -> "${mapped}" khong co trong enum DB`);
  }
});

test('chinh gia tri DB gui len thi giu nguyen', () => {
  for (const v of DB_VALUES) assert.equal(toDbRenderMode(v), v);
});

test('gia tri la bi tu choi ngay, khong de Postgres tu choi', () => {
  for (const bad of ['quickads', 'cloud', '', 'draft local'])
    assert.throws(() => toDbRenderMode(bad), /INVALID_RENDER_MODE/);
});
