-- Viprosell — hàng đợi job: lease, attempt, và nhận job an toàn giữa nhiều worker
--
-- ── Vì sao cần ──
--
-- Hiện tại worker nhận việc bằng `select('*') where status='pending'` rồi tự xử lý.
-- Không có khoá nào. Hai worker chạy cùng lúc sẽ nhận TRÙNG một job, và `inFlight`
-- trong mã chỉ chặn được trong MỘT tiến trình (chú thích ở render.worker.ts:2083 đã
-- ghi nhận đúng điều này).
--
-- `reclaimStuckJobs` hiện thả job 'processing' quá 20 phút về 'pending' mà KHÔNG
-- kiểm worker còn sống không. Worker cũ vẫn đang dựng, worker mới nhận lại cùng job,
-- hai bên cùng ghi đè kết quả của nhau.
--
-- ── Cách giải ──
--
-- Một hàm nhận job dùng FOR UPDATE SKIP LOCKED: transaction ngắn, chiếm quyền rồi
-- commit NGAY, không giữ khoá suốt thời gian chạy ffmpeg. Quyền sở hữu thể hiện bằng
-- `claimed_by` + `attempt_id` + `lease_expires_at`. Mọi lệnh ghi kết quả về sau phải
-- kèm đúng cặp đó, nên worker đã mất lease không ghi đè được kết quả của attempt mới.
--
-- KHÔNG tuyên bố exactly-once. SKIP LOCKED cho at-least-once ở mức nhận job; tính
-- một-lần ở mức HIỆU QUẢ đến từ khoá duy nhất trên idempotency_key, kiểm attempt_id
-- khi ghi, và giữ chỗ credit idempotent (migration riêng).

-- ───────────────────────── 1. Cột mới trên bảng cũ ─────────────────────────
-- Không tạo bảng job thứ hai. Mọi gói sau này (thay đồ, KOL, ca nhạc) đi qua
-- `job_type` trên chính bảng này.

ALTER TABLE renders
  ADD COLUMN IF NOT EXISTS job_type              text NOT NULL DEFAULT 'image_ads',
  ADD COLUMN IF NOT EXISTS input_mode            text,
  ADD COLUMN IF NOT EXISTS duration_seconds      integer,
  ADD COLUMN IF NOT EXISTS idempotency_key       text,
  ADD COLUMN IF NOT EXISTS stage                 text,
  ADD COLUMN IF NOT EXISTS attempt_id            uuid,
  ADD COLUMN IF NOT EXISTS attempt_count         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_by            text,
  ADD COLUMN IF NOT EXISTS lease_expires_at      timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_at          timestamptz,
  ADD COLUMN IF NOT EXISTS retryable             boolean,
  ADD COLUMN IF NOT EXISTS next_retry_at         timestamptz,
  ADD COLUMN IF NOT EXISTS input_manifest        jsonb,
  ADD COLUMN IF NOT EXISTS output_manifest       jsonb,
  ADD COLUMN IF NOT EXISTS credit_reservation_id uuid,
  ADD COLUMN IF NOT EXISTS prompt_bundle_version text,
  ADD COLUMN IF NOT EXISTS render_plan_version   text,
  ADD COLUMN IF NOT EXISTS degraded_reason       text,
  ADD COLUMN IF NOT EXISTS started_at            timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at          timestamptz;

COMMENT ON COLUMN renders.job_type IS
  'Loai cong viec: image_ads | clip_edit, va sau nay face_swap | outfit_swap | koc | mv. Worker tra capability registry truoc khi nhan.';
COMMENT ON COLUMN renders.stage IS
  'Buoc trong pipeline, chi co nghia khi status=processing. Khac han status (vong doi job).';
COMMENT ON COLUMN renders.attempt_id IS
  'Sinh moi moi lan nhan job. Moi lenh ghi ket qua phai kem dung gia tri nay, neu khong ket qua bi bo.';
COMMENT ON COLUMN renders.lease_expires_at IS
  'Het han thi job duoc nhan lai. Worker con song phai gia han bang gia_han_lease().';

-- ───────────────────────── 2. Backfill dòng cũ ─────────────────────────
-- `raw_input.source_mode = 'video_edit'` la dau hieu duong clip
-- (render.worker.ts:1330). Moi dong con lai la duong anh.

UPDATE renders
   SET job_type = CASE
         WHEN raw_input->>'source_mode' = 'video_edit' THEN 'clip_edit'
         ELSE 'image_ads'
       END
 WHERE job_type = 'image_ads';

-- Thoi luong dang nam trong raw_input chu khong phai mot cot (credit-cost.ts:107).
-- Keo ra thanh cot that de truy van va doi soat khong phai boc jsonb.
UPDATE renders
   SET duration_seconds = NULLIF(raw_input->>'duration_seconds', '')::int
 WHERE duration_seconds IS NULL
   AND raw_input ? 'duration_seconds'
   AND NULLIF(raw_input->>'duration_seconds', '') ~ '^[0-9]+$';

-- ───────────────────────── 3. Chỉ mục ─────────────────────────

-- Mot idempotency_key chi sinh ra mot job. Day la mot trong ba thu lam nen
-- tinh mot-lan o muc hieu qua.
CREATE UNIQUE INDEX IF NOT EXISTS renders_idempotency_key_uniq
  ON renders (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Chi muc cho vong nhan job. Khong quet toan bang.
CREATE INDEX IF NOT EXISTS renders_claimable_idx
  ON renders (status, next_retry_at, created_at)
  WHERE status IN ('pending', 'queued', 'processing');

-- ───────────────────────── 4. Hàm nhận job ─────────────────────────
--
-- Gom ca viec THU HOI job het lease vao cung mot cau, thay vi mot buoc rieng tha
-- job ve 'pending'. Lam mot cau thi khong co khe thoi gian nao job mang trang thai
-- 'pending' trong khi thuc ra van dang co worker lam.

CREATE OR REPLACE FUNCTION nhan_job_render(
  p_worker     text,
  p_job_types  text[],
  p_lease_giay integer DEFAULT 90
)
RETURNS SETOF renders
LANGUAGE sql
VOLATILE
AS $$
  WITH ung_vien AS (
    SELECT id
      FROM renders
     WHERE deleted_at IS NULL
       AND job_type = ANY(p_job_types)
       AND (next_retry_at IS NULL OR next_retry_at <= now())
       AND (
             status IN ('pending', 'queued')
             -- Job co worker chet giua chung: lease het han thi nhan lai duoc.
             OR (status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < now())
           )
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE renders r
     SET status           = 'processing',
         stage            = 'claimed',
         attempt_id       = gen_random_uuid(),
         attempt_count    = r.attempt_count + 1,
         claimed_by       = p_worker,
         lease_expires_at = now() + make_interval(secs => p_lease_giay),
         heartbeat_at     = now(),
         started_at       = COALESCE(r.started_at, now()),
         updated_at       = now()
    FROM ung_vien
   WHERE r.id = ung_vien.id
  RETURNING r.*;
$$;

COMMENT ON FUNCTION nhan_job_render(text, text[], integer) IS
  'Nhan dung MOT job bang FOR UPDATE SKIP LOCKED. Transaction ngan: chiem quyen roi commit, KHONG giu khoa suot ffmpeg. Tra ve 0 dong khi khong co viec.';

-- ───────────────────────── 5. Gia hạn lease ─────────────────────────
--
-- Worker goi dinh ky. Tra FALSE nghia la lease da bi tuoc — worker phai TU HUY
-- viec dang lam va khong ghi gi them.

CREATE OR REPLACE FUNCTION gia_han_lease(
  p_id         uuid,
  p_attempt    uuid,
  p_worker     text,
  p_lease_giay integer DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  so_dong integer;
BEGIN
  UPDATE renders
     SET heartbeat_at     = now(),
         lease_expires_at = now() + make_interval(secs => p_lease_giay),
         updated_at       = now()
   WHERE id = p_id
     AND attempt_id = p_attempt
     AND claimed_by = p_worker
     AND status = 'processing';
  GET DIAGNOSTICS so_dong = ROW_COUNT;
  RETURN so_dong > 0;
END;
$$;

COMMENT ON FUNCTION gia_han_lease(uuid, uuid, text, integer) IS
  'Gia han quyen so huu job. FALSE = lease da mat, worker phai dung ngay va khong ghi ket qua.';

-- ───────────────────────── 6. Chỉ service_role được gọi ─────────────────────────

REVOKE ALL ON FUNCTION nhan_job_render(text, text[], integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION gia_han_lease(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION nhan_job_render(text, text[], integer) TO service_role;
GRANT EXECUTE ON FUNCTION gia_han_lease(uuid, uuid, text, integer) TO service_role;

-- ───────────────────────── 7. Bảng job thứ hai: đóng băng ─────────────────────────
--
-- `face_replace_jobs` co truoc va nghich voi nguyen tac "khong schema thu hai".
-- Khong migrate du lieu trong lan nay; danh dau de khong ai phat trien tiep.

COMMENT ON TABLE face_replace_jobs IS
  'NGUNG DUNG tu 01/11/2026. Goi thay khuon mat sau nay di qua renders.job_type = face_swap. Khong phat trien them tren bang nay.';
