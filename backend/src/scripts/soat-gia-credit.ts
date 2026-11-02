import { creditsFor } from '../lib/credit-cost';
const ca = [
  ['Video chuan 20s, 720p, khong giong doc', { durationSec: 20, resolution: '720p', voice: false, watermark: true }],
  ['30 giay (UI dang gui mac dinh)',          { durationSec: 30, resolution: '720p', voice: false, watermark: true }],
  ['40 giay',                                 { durationSec: 40, resolution: '720p', voice: false, watermark: true }],
  ['60 giay',                                 { durationSec: 60, resolution: '720p', voice: false, watermark: true }],
  ['20s + 1080p',                             { durationSec: 20, resolution: '1080p', voice: false, watermark: true }],
  ['20s + giong doc',                         { durationSec: 20, resolution: '720p', voice: true, watermark: true }],
  ['20s + bo watermark',                      { durationSec: 20, resolution: '720p', voice: false, watermark: false }],
  ['Du bo: 60s + 1080p + giong + khong wm',   { durationSec: 60, resolution: '1080p', voice: true, watermark: false }],
] as const;
for (const [ten, spec] of ca) console.log(`  ${String(ten).padEnd(42)} ${creditsFor(spec as any)} credit`);
