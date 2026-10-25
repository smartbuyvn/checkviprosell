/**
 * trigger-local-render.ts
 * Manually insert a render job into Supabase for the Local Worker to process via Realtime.
 * Usage: npx tsx src/scripts/trigger-local-render.ts [renderId]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  const args = process.argv.slice(2);
  const renderId = args[0] || randomUUID();
  const aspectRatio = '9:16';

  console.log(`[Script] Triggering render job ${renderId}...`);

  // Mock raw input
  const mockRawInput = {
    product_title: 'Demo Product',
    product_summary: 'This is a demo product inserted via CLI script.',
    image_urls: [
      'https://picsum.photos/800/800?random=1',
      'https://picsum.photos/800/800?random=2',
      'https://picsum.photos/800/800?random=3'
    ],
    aspect_ratio: aspectRatio,
    duration_seconds: 15
  };

  // Create render row in DB
  const { error: insertErr } = await supabase.from('renders').insert({
    id: renderId,
    render_mode: 'quickads',
    aspect_ratio: aspectRatio,
    status: 'pending',
    raw_input: mockRawInput
  });

  if (insertErr) {
    console.error('Failed to insert render row:', insertErr.message);
    process.exit(1);
  }

  console.log(`✅ Render job inserted to Supabase!`);
  console.log(`   Render ID: ${renderId}`);
  console.log(`\n   Watch local worker terminal for Realtime event.`);
  console.log(`   Polling DB for status updates...`);

  // Poll status every 5s for up to 3 minutes
  let done = false;
  let attempts = 0;
  while (!done && attempts < 36) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    const { data } = await supabase.from('renders')
      .select('status, error_message, output_url, progress')
      .eq('id', renderId)
      .single();
    if (!data) continue;
    const pct = data.progress ? `${Math.round(data.progress)}%` : '';
    process.stdout.write(`\r[${attempts * 5}s] Status: ${data.status} ${pct}    `);
    if (['completed', 'failed', 'retryable_failed'].includes(data.status)) {
      done = true;
      console.log(`\n\n✅ FINAL STATUS: ${data.status}`);
      if (data.output_url) console.log(`   Video URL: ${data.output_url}`);
      if (data.error_message) console.log(`   Error: ${data.error_message}`);
    }
  }

  process.exit(0);
}

main().catch(console.error);
