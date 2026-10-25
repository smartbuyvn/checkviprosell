import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRate,
  pruneRateWindows,
  resetRateWindows,
} from '../src/lib/rate-limit';

beforeEach(() => resetRateWindows());

test('checkRate allows up to the limit then refuses', () => {
  const now = 1_000_000;
  for (let i = 0; i < 3; i++) {
    const d = checkRate('u1', 3, 60_000, now);
    assert.equal(d.allowed, true, `lần ${i + 1} lẽ ra phải được cho qua`);
    assert.equal(d.remaining, 2 - i);
  }
  const blocked = checkRate('u1', 3, 60_000, now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterMs, 60_000);
});

test('the window slides: calls are allowed again once old hits age out', () => {
  const now = 2_000_000;
  for (let i = 0; i < 3; i++) checkRate('u2', 3, 60_000, now);
  assert.equal(checkRate('u2', 3, 60_000, now + 59_000).allowed, false);
  assert.equal(checkRate('u2', 3, 60_000, now + 60_001).allowed, true);
});

test('counters are per key, so one user cannot exhaust another', () => {
  const now = 3_000_000;
  for (let i = 0; i < 3; i++) checkRate('ai:alice', 3, 60_000, now);
  assert.equal(checkRate('ai:alice', 3, 60_000, now).allowed, false);
  assert.equal(checkRate('ai:bob', 3, 60_000, now).allowed, true, 'bob không được ăn theo hạn mức của alice');
});

test('retryAfterMs counts down as the window drains', () => {
  const now = 4_000_000;
  checkRate('u3', 1, 10_000, now);
  assert.equal(checkRate('u3', 1, 10_000, now + 4_000).retryAfterMs, 6_000);
});

test('pruneRateWindows drops idle keys so the map stays bounded', () => {
  const now = 5_000_000;
  checkRate('old', 5, 1_000, now);
  checkRate('fresh', 5, 1_000, now + 3_600_000);
  const dropped = pruneRateWindows(3_600_000, now + 3_600_001);
  assert.equal(dropped, 1);
  // 'fresh' vẫn còn nên lần gọi tiếp theo tính tiếp, không reset
  assert.equal(checkRate('fresh', 1, 1_000, now + 3_600_000).allowed, false);
});
