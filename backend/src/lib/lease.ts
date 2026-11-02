/**
 * Quyền sở hữu một job render: nhận, giữ, và CHẶN GHI khi đã mất quyền.
 *
 * ── Vì sao cần ──
 *
 * Trước đây worker nhận việc bằng `select('*') where status='pending'`, không khoá gì.
 * Hai worker chạy cùng lúc sẽ nhận TRÙNG một job; `inFlight` trong worker chỉ chặn
 * được trong MỘT tiến trình. Và `reclaimStuckJobs` thả job 'processing' quá 20 phút về
 * 'pending' mà không kiểm worker cũ còn sống không — worker cũ vẫn đang dựng, worker
 * mới nhận lại cùng job, hai bên ghi đè kết quả của nhau.
 *
 * ── Ba thứ làm nên tính một-lần ──
 *
 * 1. `nhan_job_render()` dùng FOR UPDATE SKIP LOCKED: hai worker không bao giờ chiếm
 *    được cùng một dòng. Transaction ngắn — chiếm quyền rồi commit ngay, KHÔNG giữ
 *    khoá suốt thời gian ffmpeg chạy.
 * 2. `attempt_id` sinh mới mỗi lần nhận. Mọi lệnh ghi phải kèm đúng giá trị đó, nên
 *    worker đã mất lease không ghi đè được kết quả của attempt mới.
 * 3. Khoá duy nhất trên `idempotency_key` (migration 20261101000001) chặn một yêu cầu
 *    sinh ra hai job.
 *
 * KHÔNG tuyên bố exactly-once. SKIP LOCKED cho at-least-once ở mức NHẬN job; tính
 * một-lần ở mức HIỆU QUẢ đến từ ba thứ trên.
 *
 * ── Vì sao nhận db qua tham số ──
 *
 * Để test được không cần Supabase. Mọi hàm ở đây nhận client làm tham số đầu, không
 * có client toàn cục và không có tác dụng lề nào lúc nạp module.
 */

/** Quyền sở hữu một attempt. Thiếu một trong ba trường là không ghi được. */
export type QuyenJob = {
  renderId: string;
  attemptId: string;
  worker: string;
};

/**
 * Loại job worker này làm được — "capability registry".
 *
 * Đây là lý do `nhan_job_render` nhận `p_job_types`: một worker chỉ nhận việc nó làm
 * nổi. Máy KVM 4 không có GPU sẽ không bao giờ nhặt job `face_swap`, nên job đó không
 * bị kẹt ở 'processing' rồi hết lease vô ích.
 *
 * Hiện tại worker làm được đúng hai loại. Thêm loại mới là thêm vào đây SAU KHI mã
 * thật sự xử lý được nó — khai trước mà chưa làm được là tự nhận job rồi để nó chết.
 */
export const JOB_TYPES_MAC_DINH: readonly string[] = ['image_ads', 'clip_edit'];

/** Thời hạn lease. Hết hạn mà không gia hạn thì job được worker khác nhận lại. */
export const LEASE_GIAY_MAC_DINH = 90;

/**
 * Số lần gia hạn lỗi LIÊN TIẾP mới coi là mất lease.
 *
 * Một lần chớp mạng không được giết một ca render đang chạy năm phút. Ba lần liên tiếp
 * ở nhịp 30 giây là 90 giây — đúng bằng lease, nên tới đó thì job đã bị nhận lại thật.
 */
export const SO_LAN_LOI_TOI_DA = 3;

/** Lỗi khi worker phát hiện mình đã mất quyền sở hữu job. Worker phải dừng ngay. */
export class MatLeaseError extends Error {
  constructor(public readonly renderId: string, lyDo: string) {
    super(`Mat lease job ${renderId}: ${lyDo}`);
    this.name = 'MatLeaseError';
  }
}

/** Loại job worker này nhận. Đặt WORKER_JOB_TYPES để thu hẹp khi chạy nhiều máy. */
export function jobTypesHoTro(env: Record<string, string | undefined> = process.env): string[] {
  const dat = (env.WORKER_JOB_TYPES ?? '').trim();
  if (!dat) return [...JOB_TYPES_MAC_DINH];
  const ra = dat.split(',').map((x) => x.trim()).filter(Boolean);
  return ra.length ? ra : [...JOB_TYPES_MAC_DINH];
}

/**
 * Tên worker, dùng làm `claimed_by`.
 *
 * Phải phân biệt được từng TIẾN TRÌNH, không chỉ từng máy: lúc thử nghiệm sẽ mở hai
 * worker trên cùng một máy để chứng minh không nhận trùng. Thiếu pid thì hai tiến
 * trình cùng tên và `attempt_id` là thứ duy nhất phân biệt — mỏng hơn mức cần.
 */
export function tenWorker(
  env: Record<string, string | undefined> = process.env,
  host = '',
  pid: number = process.pid,
): string {
  const dat = (env.WORKER_NAME ?? '').trim();
  if (dat) return dat;
  const may = (host || env.HOSTNAME || env.COMPUTERNAME || 'may-khong-ten').trim();
  return `${may}:${pid}`;
}

/** Nhịp gia hạn: một phần ba lease, không bao giờ dưới 5 giây. */
export function nhipTimGiay(leaseGiay: number = LEASE_GIAY_MAC_DINH): number {
  return Math.max(5, Math.floor(leaseGiay / 3));
}

/** Đường nhận job mới có bật hay chưa. Mặc định TẮT — worker chạy y như trước. */
export function leaseDangBat(env: Record<string, string | undefined> = process.env): boolean {
  return env.HANG_DOI_LEASE === '1';
}

/**
 * Phần client Supabase mà module này dùng tới.
 *
 * `PromiseLike` chứ không phải `Promise`: `rpc()` và chuỗi `.select()` của supabase-js
 * trả về `PostgrestFilterBuilder`, một thenable `await` được nhưng không có `.catch`
 * hay `.finally`. Khai là `Promise` thì client thật không khớp type.
 */
type Db = {
  rpc: (ten: string, tham: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
  from: (bang: string) => any;
};

/**
 * Nhận đúng MỘT job. Trả về dòng render đã chiếm được, hoặc null khi không có việc.
 *
 * Ném lỗi khi gọi RPC thất bại, KHÔNG trả null: "không có việc" và "không gọi được
 * cơ sở dữ liệu" là hai chuyện khác nhau, lẫn chúng vào nhau thì một sự cố mạng trông
 * y như một hàng đợi rỗng và không ai biết worker đang đói.
 */
export async function nhanJob(
  db: Db,
  opts: { worker: string; jobTypes: string[]; leaseGiay?: number },
): Promise<Record<string, any> | null> {
  const { data, error } = await db.rpc('nhan_job_render', {
    p_worker: opts.worker,
    p_job_types: opts.jobTypes,
    p_lease_giay: opts.leaseGiay ?? LEASE_GIAY_MAC_DINH,
  });
  if (error) throw new Error(`nhan_job_render that bai: ${error.message ?? error}`);
  const dong = Array.isArray(data) ? data : data ? [data] : [];
  return dong.length ? dong[0] : null;
}

/** Lấy quyền sở hữu từ dòng render vừa nhận được. */
export function quyenTuDong(dong: Record<string, any>, worker: string): QuyenJob {
  if (!dong?.id) throw new Error('Dong render khong co id');
  if (!dong?.attempt_id) throw new Error(`Dong render ${dong.id} khong co attempt_id`);
  return { renderId: String(dong.id), attemptId: String(dong.attempt_id), worker };
}

/**
 * Gia hạn lease. FALSE nghĩa là lease đã mất — worker phải dừng và không ghi gì thêm.
 *
 * Ném lỗi khi gọi RPC thất bại. Phân biệt với FALSE là quan trọng: FALSE là "job không
 * còn của mày", lỗi là "chưa biết". Coi lỗi thành FALSE sẽ huỷ một ca render đang chạy
 * vì một gói tin rơi.
 */
export async function giaHanLease(
  db: Db,
  quyen: QuyenJob,
  leaseGiay: number = LEASE_GIAY_MAC_DINH,
): Promise<boolean> {
  const { data, error } = await db.rpc('gia_han_lease', {
    p_id: quyen.renderId,
    p_attempt: quyen.attemptId,
    p_worker: quyen.worker,
    p_lease_giay: leaseGiay,
  });
  if (error) throw new Error(`gia_han_lease that bai: ${error.message ?? error}`);
  return data === true;
}

/**
 * Ghi vào dòng render, CHỈ KHI còn giữ quyền.
 *
 * `quyen = null` thì ghi thẳng, không chặn — đó là đường cũ, khi chưa bật lease và dòng
 * chưa có `attempt_id` nào để so.
 *
 * Trả FALSE khi không dòng nào bị sửa, tức attempt đã bị thay. Ném lỗi khi lệnh ghi
 * thất bại — cùng lý do như `giaHanLease`.
 */
export async function ghiCoChan(
  db: Db,
  quyen: QuyenJob | null,
  renderId: string,
  truong: Record<string, unknown>,
): Promise<boolean> {
  let q = db.from('renders').update(truong).eq('id', quyen ? quyen.renderId : renderId);
  if (quyen) q = q.eq('attempt_id', quyen.attemptId).eq('claimed_by', quyen.worker);

  const { data, error } = await q.select('id');
  if (error) throw new Error(`Ghi renders that bai: ${error.message ?? error}`);
  if (!quyen) return true;
  return Array.isArray(data) && data.length > 0;
}

export type NhipTim = {
  /** Dừng gia hạn. Gọi được nhiều lần. */
  dung: () => void;
  /** Lease đã mất chưa — worker kiểm trước các bước dài. */
  daMat: () => boolean;
};

/**
 * Gia hạn lease định kỳ cho tới khi gọi `dung()`.
 *
 * Khi mất lease thì gọi `onMatLease` MỘT lần rồi tự dừng. Không ném ra ngoài vì nó chạy
 * trong timer — ném ở đó thành unhandled rejection, giết cả tiến trình worker thay vì
 * chỉ huỷ một job.
 */
export function batDauNhipTim(
  db: Db,
  quyen: QuyenJob,
  opts: {
    leaseGiay?: number;
    nhipMs?: number;
    soLanLoiToiDa?: number;
    onMatLease?: (lyDo: string) => void;
    onLoi?: (e: unknown, soLanLoiLienTiep: number) => void;
  } = {},
): NhipTim {
  const leaseGiay = opts.leaseGiay ?? LEASE_GIAY_MAC_DINH;
  const nhipMs = opts.nhipMs ?? nhipTimGiay(leaseGiay) * 1000;
  const toiDa = opts.soLanLoiToiDa ?? SO_LAN_LOI_TOI_DA;

  let daMat = false;
  let soLoi = 0;
  let dungRoi = false;

  const dung = () => {
    if (dungRoi) return;
    dungRoi = true;
    clearInterval(dongHo);
  };

  const mat = (lyDo: string) => {
    if (daMat) return;
    daMat = true;
    dung();
    opts.onMatLease?.(lyDo);
  };

  const dongHo = setInterval(() => {
    void (async () => {
      if (dungRoi) return;
      try {
        const con = await giaHanLease(db, quyen, leaseGiay);
        soLoi = 0;
        if (!con) mat('gia_han_lease tra FALSE — attempt da bi thay');
      } catch (e) {
        soLoi += 1;
        opts.onLoi?.(e, soLoi);
        if (soLoi >= toiDa) mat(`${soLoi} lan gia han loi lien tiep`);
      }
    })();
  }, nhipMs);

  // Không giữ tiến trình sống chỉ vì cái timer này.
  (dongHo as any).unref?.();

  return { dung, daMat: () => daMat };
}
