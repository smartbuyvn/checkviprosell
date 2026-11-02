/**
 * Viprosell — Dịch vụ tìm dấu bản quyền trên ảnh của một dự án
 *
 * Tải ảnh của dự án về, đọc chữ ở viền từng tấm, rồi lọc theo lặp vị trí. Trả về
 * danh sách ỨNG VIÊN kèm ảnh cắt nhỏ để khách nhìn mà quyết định.
 *
 * Xem `lib/dau-anh.ts` cho lý do vì sao phải có bước khách xác nhận.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { docChuVienAnh, gomDauLap, duongDocChu, type DauUngVien } from '../lib/dau-anh';
import { tinhKhungTranh } from '../lib/cat-tranh';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

/** Tối đa bao nhiêu ảnh đem đi dò. Mỗi ảnh tốn ~3 giây. */
const ANH_TOI_DA = parseInt(process.env.TIM_DAU_ANH_TOI_DA || '6', 10);

export interface DauChoKhach extends DauUngVien {
  /** Ảnh cắt nhỏ quanh dấu, dạng data URL, để khách nhìn mà quyết định. */
  anhNho: string | null;
}

export interface KetQuaTimDau {
  /** Bộ dò có bật không. Tắt thì giao diện ẩn hẳn mục này. */
  batDuoc: boolean;
  dau: DauChoKhach[];
  soAnhDaQuet: number;
  /** Phần diện tích còn lại NẾU khách chọn hết — để nói trước cho họ. */
  giuLaiNeuChonHet: number;
  /** Lời nhắn khi không dò được gì, viết cho người bán đọc. */
  nhan: string;
}

/**
 * Đường dẫn trong bucket, lấy được từ CẢ url công khai lẫn url đã ký.
 *
 * `project_assets.file_url` lưu URL ĐÃ KÝ và những URL đó hết hạn. Đọc thẳng là nhận
 * HTTP 400 — đo thật ngày 30/10 trên toàn bộ ảnh cũ. Phải tách lấy đường dẫn rồi ký lại.
 */
function duongTrongBucket(url: string): string | null {
  const cong = '/storage/v1/object/public/project-assets/';
  const ky = '/object/sign/project-assets/';
  for (const moc of [cong, ky]) {
    const i = url.indexOf(moc);
    if (i === -1) continue;
    try {
      const p = decodeURIComponent(url.slice(i + moc.length).split('?')[0]);
      return p.includes('..') ? null : p;
    } catch { return null; }
  }
  return null;
}

/** Ảnh cắt nhỏ quanh một dấu, dạng data URL. Hỏng thì trả null. */
function anhNhoQuanhDau(duongAnh: string, d: DauUngVien, thuMuc: string): string | null {
  try {
    // Nới rộng để khách thấy cả bối cảnh quanh dấu, không chỉ mấy chữ trơ trọi.
    const noi = 0.02;
    const x = Math.max(0, d.x - noi), y = Math.max(0, d.y - noi);
    const w = Math.min(1 - x, d.w + noi * 2), h = Math.min(1 - y, d.h + noi * 2);
    const ra = path.join(thuMuc, `nho_${Math.round(d.x * 1000)}_${Math.round(d.y * 1000)}.jpg`);

    const ok = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', duongAnh, '-vf',
      `crop=iw*${w.toFixed(4)}:ih*${h.toFixed(4)}:iw*${x.toFixed(4)}:ih*${y.toFixed(4)},` +
      `scale=320:-1:flags=lanczos`,
      '-frames:v', '1', '-q:v', '4', ra], { encoding: 'utf8', timeout: 30_000 });
    if (ok.status !== 0 || !fs.existsSync(ra)) return null;

    return `data:image/jpeg;base64,${fs.readFileSync(ra).toString('base64')}`;
  } catch {
    return null;
  }
}

/** Tìm dấu trên ảnh của một dự án. Không bao giờ ném lỗi vì một ảnh hỏng. */
export async function timDauChoDuAn(projectId: string): Promise<KetQuaTimDau> {
  if (!duongDocChu()) {
    return {
      batDuoc: false, dau: [], soAnhDaQuet: 0, giuLaiNeuChonHet: 1,
      nhan: 'Máy dựng chưa bật bộ nhận chữ.',
    };
  }

  const { data: assets, error } = await supabase
    .from('project_assets')
    .select('file_url')
    .eq('project_id', projectId)
    .eq('asset_type', 'image')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Khong doc duoc anh cua du an: ${error.message}`);

  const urls = (assets ?? []).map((a: any) => a.file_url).filter(Boolean).slice(0, ANH_TOI_DA);
  if (urls.length < 2) {
    return {
      batDuoc: true, dau: [], soAnhDaQuet: urls.length, giuLaiNeuChonHet: 1,
      nhan: 'Cần ít nhất 2 ảnh để nhận ra dấu — dấu là thứ lặp lại ở cùng một chỗ.',
    };
  }

  let thuMuc: string | null = null;
  try {
    thuMuc = fs.mkdtempSync(path.join(os.tmpdir(), 'vipro-dau-'));
    const files: string[] = [];

    for (const [i, u] of urls.entries()) {
      const duong = duongTrongBucket(String(u));
      if (!duong) continue;
      const { data: ky } = await supabase.storage
        .from('project-assets').createSignedUrl(duong, 600);
      if (!ky?.signedUrl) continue;

      const f = path.join(thuMuc, `a${i}.jpg`);
      const tai = spawnSync('curl', ['-sL', '--max-time', '30', '-o', f, ky.signedUrl]);
      if (tai.status === 0 && fs.existsSync(f) && fs.statSync(f).size > 0) files.push(f);
    }

    if (files.length < 2) {
      return {
        batDuoc: true, dau: [], soAnhDaQuet: files.length, giuLaiNeuChonHet: 1,
        nhan: 'Không tải được đủ ảnh để so sánh.',
      };
    }

    const ungVien = gomDauLap(files.map((f) => docChuVienAnh(f)));
    const dau: DauChoKhach[] = ungVien.map((d) => ({
      ...d,
      // Lấy ảnh nhỏ từ chính tấm ĐẦU TIÊN có dấu này, không lấy tấm bất kỳ.
      anhNho: anhNhoQuanhDau(files[d.anh[0]] ?? files[0], d, thuMuc!),
    }));

    const giuLai = dau.length > 0 ? tinhKhungTranh(dau).giuLai : 1;

    return {
      batDuoc: true,
      dau,
      soAnhDaQuet: files.length,
      giuLaiNeuChonHet: giuLai,
      nhan: dau.length > 0
        ? ''
        : 'Không thấy dấu nào lặp lại giữa các ảnh. Nếu ảnh của bạn có dấu, thử tải thêm ảnh cùng bộ.',
    };
  } finally {
    if (thuMuc) { try { fs.rmSync(thuMuc, { recursive: true, force: true }); } catch { /* don hong khong sao */ } }
  }
}
