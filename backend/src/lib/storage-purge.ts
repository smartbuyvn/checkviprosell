/**
 * Viprosell — Dọn file đã quá hạn trong thùng rác
 *
 * Trước đây xoá dự án chỉ xoá DÒNG trong CSDL. File video 12,5 MB vẫn nằm
 * nguyên trong bucket vĩnh viễn — không một lệnh .remove() nào trong cả backend
 * lẫn frontend. Hai hậu quả:
 *
 *   - Tiền: 1.000 video/tháng, khách xoá một nửa, sau một năm trả tiền cho 75 GB rác
 *   - Lời hứa: file vẫn tải được qua đường dẫn công khai dù khách tưởng đã xoá
 *
 * Chỉ dọn thứ ĐÃ QUÁ HẠN thùng rác (purge_after < bây giờ). Khách bấm nhầm vẫn
 * còn 30 ngày để lấy lại.
 */

/**
 * Lấy đường dẫn trong bucket từ một URL công khai của Supabase Storage.
 *
 * URL có dạng:
 *   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<duong-dan>
 *
 * Trả null khi URL không thuộc bucket cần tìm — thà bỏ sót một file còn hơn xoá
 * nhầm thứ không phải của mình.
 */
export function storagePathFromUrl(url: string, bucket: string): string | null {
  if (!url || typeof url !== 'string') return null;

  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;

  const path = url.slice(i + marker.length).split('?')[0];
  if (!path) return null;

  try {
    const decoded = decodeURIComponent(path);
    // Chặn đường dẫn leo ra ngoài. Supabase không cho, nhưng URL đến từ CSDL mà
    // CSDL thì có thể chứa dữ liệu cũ hoặc hỏng.
    if (decoded.includes('..')) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Gom các đường dẫn cần xoá của một bản render. */
export function renderStoragePaths(
  render: { output_url?: string | null; thumbnail_url?: string | null },
  bucket = 'renders'
): string[] {
  const out: string[] = [];
  for (const u of [render.output_url, render.thumbnail_url]) {
    const p = u ? storagePathFromUrl(u, bucket) : null;
    if (p) out.push(p);
  }
  return out;
}

export interface PurgeResult {
  duAnDaDon: number;
  fileDaXoa: number;
  loi: string[];
}

/**
 * Dọn các dự án đã quá hạn thùng rác.
 *
 * Thứ tự quan trọng: xoá FILE trước, ghi mốc sau. Ghi mốc trước rồi xoá file
 * thất bại thì file thành mồ côi vĩnh viễn — không còn dấu vết nào để tìm lại.
 */
export async function purgeExpiredProjects(
  supabase: any,
  opts: { limit?: number; dryRun?: boolean } = {}
): Promise<PurgeResult> {
  const limit = opts.limit ?? 20;
  const ketQua: PurgeResult = { duAnDaDon: 0, fileDaXoa: 0, loi: [] };

  const { data: duAn, error } = await supabase
    .from('projects')
    .select('id, title, purge_after')
    .not('purge_after', 'is', null)
    .lt('purge_after', new Date().toISOString())
    .is('storage_deleted_at', null)
    .limit(limit);

  if (error) {
    ketQua.loi.push(`Khong doc duoc danh sach du an qua han: ${error.message}`);
    return ketQua;
  }
  if (!duAn || duAn.length === 0) return ketQua;

  for (const p of duAn) {
    try {
      const { data: renders } = await supabase
        .from('renders')
        .select('output_url, thumbnail_url')
        .eq('project_id', p.id);

      const duongDan: string[] = [];
      for (const r of renders || []) duongDan.push(...renderStoragePaths(r));

      const { data: assets } = await supabase
        .from('project_assets')
        .select('file_url')
        .eq('project_id', p.id);

      const duongDanAsset: string[] = [];
      for (const a of assets || []) {
        const path = a.file_url ? storagePathFromUrl(a.file_url, 'project-assets') : null;
        if (path) duongDanAsset.push(path);
      }

      if (opts.dryRun) {
        console.log(`[Dọn] (thử) ${p.title}: ${duongDan.length} video, ${duongDanAsset.length} ảnh`);
        ketQua.fileDaXoa += duongDan.length + duongDanAsset.length;
        ketQua.duAnDaDon++;
        continue;
      }

      if (duongDan.length > 0) {
        const { error: e } = await supabase.storage.from('renders').remove(duongDan);
        if (e) throw new Error(`xoa video that bai: ${e.message}`);
        ketQua.fileDaXoa += duongDan.length;
      }

      if (duongDanAsset.length > 0) {
        const { error: e } = await supabase.storage.from('project-assets').remove(duongDanAsset);
        // Ảnh gốc xoá hỏng thì ghi lại nhưng vẫn tiếp: video đã xoá là phần nặng nhất.
        if (e) ketQua.loi.push(`${p.title}: xoa anh goc that bai (${e.message})`);
        else ketQua.fileDaXoa += duongDanAsset.length;
      }

      // Ghi mốc SAU khi file đã xoá xong.
      await supabase
        .from('projects')
        .update({ storage_deleted_at: new Date().toISOString() })
        .eq('id', p.id);

      ketQua.duAnDaDon++;
    } catch (err: any) {
      // Một dự án hỏng không được chặn các dự án còn lại.
      ketQua.loi.push(`${p.title ?? p.id}: ${err.message}`);
    }
  }

  return ketQua;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Clip gốc khách tự quay — xoá sau khi render xong
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Giữ clip gốc bao lâu sau khi render xong, tính bằng giờ.
 *
 * Spec V3 §10 chốt 24 giờ, và lý do rất cụ thể: clip gốc chỉ có ích TRONG LÚC dựng,
 * xong rồi thì nó không còn việc gì — trừ khi khách muốn dựng lại, và 24 giờ là đủ
 * rộng cho nhu cầu đó.
 *
 * Phép tính ở HIEN_TRANG 28/10: 1.000 dự án/tháng, giữ clip gốc 30 ngày là 176 GB
 * (~68.600đ/tháng); giữ 24 giờ là 5,9 GB (~2.300đ). Ở 10.000 dự án/tháng thì khoản
 * chênh thành 660.000đ — bằng một phần tư tiền Supabase Pro.
 */
export const GIU_CLIP_GOC_GIO = parseInt(process.env.GIU_CLIP_GOC_GIO || '24', 10);

export interface KetQuaDonClip {
  clipDaXoa: number;
  duAnDaCham: number;
  loi: string[];
}

/**
 * Xoá clip gốc của những dự án đã render xong quá hạn giữ.
 *
 * ── Điều kiện, và vì sao từng điều kiện có mặt ──
 *
 *   - Dự án phải CÓ bản render hoàn tất. Khách tải clip lên rồi bỏ dở thì clip vẫn
 *     còn nguyên — xoá thứ chưa dùng tới là xoá mất việc khách đang làm.
 *   - Bản render hoàn tất gần nhất phải cũ hơn `GIU_CLIP_GOC_GIO`. Mốc tính theo
 *     render chứ không theo lúc tải lên: khách tải clip hôm qua rồi hôm nay mới dựng
 *     thì 24 giờ phải đếm từ lúc dựng.
 *   - Chỉ `asset_type = 'video'`. Ảnh sản phẩm nhẹ và khách hay dựng lại nhiều lần
 *     với cùng bộ ảnh, nên ảnh theo lịch 30 ngày của `purgeExpiredProjects`.
 *
 * ── Thứ tự ──
 *
 * Xoá FILE trước, ghi mốc sau — giống `purgeExpiredProjects`. Ghi mốc trước rồi xoá
 * hỏng thì file thành mồ côi vĩnh viễn, không còn dấu vết nào để tìm lại.
 */
export async function purgeSourceClips(
  supabase: any,
  opts: { limit?: number; dryRun?: boolean; giuGio?: number } = {}
): Promise<KetQuaDonClip> {
  const limit = opts.limit ?? 20;
  const giuGio = opts.giuGio ?? GIU_CLIP_GOC_GIO;
  const ketQua: KetQuaDonClip = { clipDaXoa: 0, duAnDaCham: 0, loi: [] };

  const moc = new Date(Date.now() - giuGio * 3600_000).toISOString();

  // Bản render hoàn tất đã quá hạn giữ. `deleted_at` null: dự án đã vào thùng rác thì
  // để `purgeExpiredProjects` lo trọn gói, không giành việc của nhau.
  const { data: renders, error: loiRender } = await supabase
    .from('renders')
    .select('project_id, updated_at')
    // CHI completed. Enum `render_status` khong co gia tri nao ten la exported,
    // nen truy van keu `invalid input value for enum render_status` va ca vong don
    // chet moi gio. Gia tri hop le: pending, queued, processing, completed, failed, cancelled.
    .eq('status', 'completed')
    .lt('updated_at', moc)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit * 10);

  if (loiRender) {
    ketQua.loi.push(`Khong doc duoc danh sach render: ${loiRender.message}`);
    return ketQua;
  }

  const duAnIds = [...new Set(((renders ?? []) as any[]).map((r) => r.project_id).filter(Boolean))]
    .slice(0, limit);
  if (duAnIds.length === 0) return ketQua;

  /**
   * Thử một lần trước khi vào vòng lặp, để biết cột đã có chưa.
   *
   * Vòng dọn chạy mỗi giờ và duyệt tới 20 dự án mỗi lượt. Thiếu cột
   * `storage_deleted_at` thì CẢ HAI MƯƠI lần đều hỏng cùng một lý do, và nhật ký đầy
   * hai mươi dòng giống hệt nhau mỗi giờ — đúng kiểu lỗi mà người vận hành học cách
   * bỏ qua, rồi bỏ qua luôn những lỗi thật.
   *
   * Một dòng nói rõ phải chạy migration nào thì sửa được trong một phút.
   */
  const { error: loiCot } = await supabase
    .from('project_assets')
    .select('id')
    .is('storage_deleted_at', null)
    .limit(1);
  if (loiCot && /storage_deleted_at/.test(String(loiCot.message))) {
    ketQua.loi.push(
      'Thieu cot project_assets.storage_deleted_at — chay migration ' +
      '20261030000001_xoa_clip_goc_sau_render.sql roi vong don moi hoat dong.'
    );
    return ketQua;
  }

  for (const duAnId of duAnIds) {
    try {
      const { data: assets, error: loiAsset } = await supabase
        .from('project_assets')
        .select('id, file_url, file_name')
        .eq('project_id', duAnId)
        .eq('asset_type', 'video')
        .is('storage_deleted_at', null);

      if (loiAsset) throw new Error(`doc asset that bai: ${loiAsset.message}`);
      if (!assets || assets.length === 0) continue;

      const duongDan: string[] = [];
      const idDaGom: string[] = [];
      for (const a of assets as any[]) {
        const p = a.file_url ? storagePathFromUrl(a.file_url, 'project-assets') : null;
        // Không tìm ra đường dẫn thì vẫn đánh dấu: file không thuộc bucket này (link
        // ngoài, hoặc dữ liệu cũ), nên quét lại mãi cũng không dọn được gì.
        if (p) duongDan.push(p);
        idDaGom.push(a.id);
      }

      if (opts.dryRun) {
        console.log(`[Dọn clip] (thử) dự án ${String(duAnId).slice(0, 8)}: ${duongDan.length} clip`);
        ketQua.clipDaXoa += duongDan.length;
        ketQua.duAnDaCham++;
        continue;
      }

      if (duongDan.length > 0) {
        const { error: e } = await supabase.storage.from('project-assets').remove(duongDan);
        if (e) throw new Error(`xoa clip that bai: ${e.message}`);
        ketQua.clipDaXoa += duongDan.length;
      }

      // Ghi mốc SAU khi file đã xoá xong.
      const { error: loiGhi } = await supabase
        .from('project_assets')
        .update({ storage_deleted_at: new Date().toISOString() })
        .in('id', idDaGom);
      if (loiGhi) throw new Error(`ghi moc that bai: ${loiGhi.message}`);

      ketQua.duAnDaCham++;
    } catch (err: any) {
      // Một dự án hỏng không được chặn các dự án còn lại.
      ketQua.loi.push(`du an ${String(duAnId).slice(0, 8)}: ${err.message}`);
    }
  }

  return ketQua;
}

/**
 * Dọn thư mục tạm còn sót trên máy worker.
 *
 * Mỗi lần dựng tạo một thư mục theo `renderId` và xoá nó trong `finally`. Nhưng
 * `finally` không chạy khi tiến trình bị giết giữa chừng — và worker này bị khởi động
 * lại thường xuyên (nạp code mới, mất điện, kill nhầm). Mỗi lần như vậy để lại một
 * thư mục vài trăm MB nằm vĩnh viễn.
 *
 * Spec V3 §10 nói thẳng: "file tạm chỉ giữ trong lúc render + 24 giờ để thử lại, rồi
 * xoá. Không để ổ máy cá nhân đầy dần — đây là lỗi vận hành hay gặp nhất của mô hình
 * render tại nhà."
 *
 * `dangChay` là các renderId đang dựng ở tiến trình này: không bao giờ được xoá thư
 * mục của một job đang chạy, dù mốc thời gian của nó trông có vẻ cũ.
 */
export function donThuMucTamCu(
  fs: typeof import('node:fs'),
  path: typeof import('node:path'),
  thuMucGoc: string,
  opts: { giuGio?: number; dangChay?: Set<string>; dryRun?: boolean } = {}
): { daXoa: number; loi: string[] } {
  const giuGio = opts.giuGio ?? GIU_CLIP_GOC_GIO;
  const dangChay = opts.dangChay ?? new Set<string>();
  const ra = { daXoa: 0, loi: [] as string[] };

  if (!fs.existsSync(thuMucGoc)) return ra;

  const moc = Date.now() - giuGio * 3600_000;

  for (const ten of fs.readdirSync(thuMucGoc)) {
    // `worker.lock` sống cùng chỗ và KHÔNG phải rác — xoá nó là hai worker cùng chạy.
    if (ten === 'worker.lock') continue;
    if (dangChay.has(ten)) continue;

    const duong = path.join(thuMucGoc, ten);
    try {
      const st = fs.statSync(duong);
      if (!st.isDirectory()) continue;
      if (st.mtimeMs >= moc) continue;

      if (opts.dryRun) { ra.daXoa++; continue; }
      fs.rmSync(duong, { recursive: true, force: true });
      ra.daXoa++;
    } catch (err: any) {
      ra.loi.push(`${ten}: ${err.message}`);
    }
  }

  return ra;
}
