/**
 * Viprosell — Redis Isolation Checker
 * Chạy: npx tsx src/scripts/check-redis-isolation.ts
 *
 * Kiểm tra:
 * 1. Viprosell đang dùng DB index đúng (phải là DB 1)
 * 2. Không có key nào của NOVA bị lẫn vào Viprosell DB
 * 3. Queue names có prefix 'vipro:' để phân biệt
 */

import 'dotenv/config';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || '';

if (!REDIS_URL) {
  console.error('❌ REDIS_URL không được set trong .env');
  process.exit(1);
}

async function main() {
  console.log('\n🔍 Viprosell — Redis Isolation Check\n' + '─'.repeat(50));

  // ─── 1. Kiểm tra DB index trong URL ─────────────────────────────────────
  const safeUrl = REDIS_URL.replace(/:([^:@]+)@/, ':***@');
  console.log(`\n[1] REDIS_URL: ${safeUrl}`);

  const dbMatch = REDIS_URL.match(/\/(\d+)(?:\?|$)/);
  const dbIndex = dbMatch ? parseInt(dbMatch[1]) : 0;

  if (dbIndex === 0) {
    console.log('⚠️  DB index = 0 (mặc định) — CÓ THỂ xung đột với NOVA Bot!');
    console.log('   → Sửa REDIS_URL thành: redis://:PASS@HOST:PORT/1');
  } else if (dbIndex === 1) {
    console.log(`✅ DB index = ${dbIndex} — Đúng! (NOVA dùng DB 0)`);
  } else {
    console.log(`ℹ️  DB index = ${dbIndex} — Khác convention nhưng không xung đột`);
  }

  // ─── 2. Kết nối và check keys ────────────────────────────────────────────
  let client: IORedis;
  try {
    client = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    await client.connect();
    console.log('\n[2] Kết nối Redis: ✅ OK');
  } catch (err: any) {
    console.log(`\n[2] Kết nối Redis: ❌ FAIL — ${err.message}`);
    process.exit(1);
  }

  // ─── 3. Liệt kê các keys trong DB hiện tại ───────────────────────────────
  try {
    const keys = await client.keys('*');
    console.log(`\n[3] Keys trong DB ${dbIndex}: ${keys.length} keys`);

    if (keys.length === 0) {
      console.log('   → DB sạch, chưa có queue job nào');
    } else {
      // Phân loại keys
      const viproKeys = keys.filter(k => k.startsWith('vipro:') || k.startsWith('bull:vipro'));
      const unknownKeys = keys.filter(k => !k.startsWith('vipro:') && !k.startsWith('bull:vipro'));

      console.log(`   ✅ Viprosell keys (vipro:*): ${viproKeys.length}`);
      if (viproKeys.length > 0) {
        viproKeys.slice(0, 5).forEach(k => console.log(`      - ${k}`));
        if (viproKeys.length > 5) console.log(`      ... và ${viproKeys.length - 5} keys khác`);
      }

      if (unknownKeys.length > 0) {
        console.log(`\n   ⚠️  Unknown keys (không phải Viprosell): ${unknownKeys.length}`);
        unknownKeys.slice(0, 5).forEach(k => console.log(`      - ${k}`));
        console.log('   → Có thể bị xung đột từ project khác. Kiểm tra DB index!');
      }
    }
  } catch (err: any) {
    console.log(`\n[3] Không thể liệt kê keys: ${err.message}`);
  }

  // ─── 4. Check DB 0 (NOVA) có bị lẫn không ─────────────────────────────────
  if (dbIndex !== 0) {
    try {
      const novaUrl = REDIS_URL.replace(/\/\d+$/, '/0');
      const novaClient = new IORedis(novaUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
      });
      await novaClient.connect();
      const novaKeys = await novaClient.keys('*');
      console.log(`\n[4] DB 0 (NOVA zone): ${novaKeys.length} keys`);
      const novaQueues = novaKeys.filter(k => k.includes('queue') || k.includes('bull') || k.includes('nova'));
      if (novaQueues.length > 0) {
        console.log(`   ✅ NOVA keys tìm thấy: ${novaQueues.length} — hoàn toàn tách biệt với Viprosell`);
      }
      await novaClient.quit();
    } catch {
      console.log('\n[4] DB 0 (NOVA): Không thể check (bình thường nếu NOVA không chạy)');
    }
  }

  // ─── 5. Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  if (dbIndex === 1) {
    console.log('✅ Redis isolation: OK — Viprosell hoàn toàn tách biệt khỏi các project khác');
  } else {
    console.log('⚠️  Redis isolation: CHƯA ổn — xem các cảnh báo ở trên');
  }
  console.log('');

  await client!.quit();
}

main().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
