/** Soat mot clip bang code that: nhan hay tu choi, va khoang do dai kha thi. */
import { probeVideo, validateVideo, shouldReject } from '../lib/video-asset';
import { minTotalFor, maxTotalFor } from '../lib/video-edit';
import { qaEditPlan } from '../lib/video-qa';

(async () => {
  const meta = await probeVideo(process.argv[2]);
  if (!meta) { console.error('khong doc duoc'); process.exit(1); }
  const ms = Math.round(meta.durationSec * 1000);

  console.log(`${meta.width}x${meta.height}, ${meta.durationSec.toFixed(1)}s`);
  const v = validateVideo(meta);
  for (const p of v) console.log(`  [${p.severity}] ${p.code}`);
  console.log(`  => ${shouldReject(v) ? 'TU CHOI' : 'NHAN'}`);
  console.log(`  thanh pham kha thi: ${minTotalFor(ms)}–${maxTotalFor(ms)}ms`);

  // Ke hoach 3 doan nam gon trong clip
  const segs = [
    { id:'a1', role:'hook' as const,    in_ms:Math.round(ms*0.50), out_ms:Math.round(ms*0.72), crop:'hold' as const,     speed:1, transition_out:'cut' as const, overlay:'' },
    { id:'a2', role:'product' as const, in_ms:0,                   out_ms:Math.round(ms*0.45), crop:'punch_in' as const, speed:1, transition_out:'cut' as const, overlay:'' },
    { id:'a3', role:'cta' as const,     in_ms:Math.round(ms*0.75), out_ms:ms,                  crop:'hold' as const,     speed:1, transition_out:'cut' as const, overlay:'Xem chi tiet' },
  ];
  const qa = qaEditPlan({ segments: segs, clipDurationMs: ms, spokenClaims: [] });
  console.log(`  QA: pass=${qa.pass}, ${qa.blocks.length} ghi nhan`);
  for (const b of qa.blocks) console.log(`    ${b.reason}: ${b.detail}`);
})();
