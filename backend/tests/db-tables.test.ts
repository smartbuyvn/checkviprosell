import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Mọi bảng public đang expose trên production, đọc từ OpenAPI spec của Supabase
 * ngày 26/10/2026. Thêm bảng mới thì bổ sung vào đây cùng lúc với migration.
 */
const REAL_TABLES = new Set([
  'admin_audit_logs', 'affiliate_events', 'caption_exports', 'concepts',
  'credit_ledger', 'face_replace_jobs', 'payments', 'plans',
  'product_intelligence', 'profiles', 'project_assets', 'projects',
  'prompts', 'renders', 'scenes', 'scripts', 'service_health_logs',
  'system_settings', 'usage_logs', 'user_roles', 'visual_packs',
  // Tạo bởi supabase/migrations/20260821000001_create_idempotency_keys.sql
  'idempotency_keys',
  // Tạo bởi supabase/migrations/20261027000001_affiliate_withdrawals.sql
  'affiliate_withdrawals',
]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

// tsconfig dat module=CommonJS nen tsx bien dich sang CJS: dung __dirname,
// import.meta.dirname se la undefined.
const root = join(__dirname, '..');

test('mọi .from() trong backend trỏ tới bảng có thật trên production', () => {
  const bad: string[] = [];
  for (const file of sourceFiles(join(root, 'src'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\.from\(\s*'([a-z_][a-z0-9_]*)'\s*\)/g)) {
      // .from() của mảng/Buffer cũng khớp cú pháp này, nhưng tên bảng đều là snake_case
      // nhiều ký tự nên trùng lặp thực tế không xảy ra; nếu có thì thêm vào REAL_TABLES.
      if (!REAL_TABLES.has(m[1])) {
        const line = src.slice(0, m.index).split('\n').length;
        bad.push(`${relative(root, file).split(sep).join('/')}:${line} -> '${m[1]}'`);
      }
    }
  }
  assert.deepEqual(bad, [], `Gọi bảng không tồn tại:\n  ${bad.join('\n  ')}`);
});
