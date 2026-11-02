-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  LÙI migration 20261101000001_hang_doi_job_lease.sql                     ║
-- ║                                                                          ║
-- ║  KHÔNG nằm trong supabase/migrations/ là CỐ Ý: mọi tệp trong thư mục đó  ║
-- ║  sẽ được `supabase db push` áp dụng. Script lùi nằm lẫn ở đó là tai nạn  ║
-- ║  chờ sẵn. Chạy tệp này BẰNG TAY và chỉ khi thực sự cần lùi.             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ── ĐỌC TRƯỚC KHI CHẠY ──
--
-- 1. NẾU worker đã được nối vào `nhan_job_render()` thì PHẢI trả mã worker về bản
--    cũ TRƯỚC. Xoá hàm trong khi worker còn gọi nó = worker chết ngay, không nhận
--    được job nào nữa.
--
-- 2. Dừng worker trước khi chạy. Hàng đợi rỗng là lúc an toàn nhất (ngày 01/11/2026
--    lúc viết migration: 0 pending, 0 queued, 0 processing).
--
-- 3. Script chia hai mức. PHẦN A đảo ngược mọi THAY ĐỔI HÀNH VI và an toàn tuyệt
--    đối. PHẦN B xoá cột, có mất dữ liệu, và mặc định BỊ KHOÁ.
--
-- Mọi lệnh đều `IF EXISTS` nên chạy được cả khi migration mới áp dụng một phần
-- (ví dụ nó chết giữa chừng ở bước tạo hàm).

-- ═══════════════════════════ PHẦN A — AN TOÀN ═══════════════════════════
-- Đảo ngược toàn bộ hành vi mới. Không dòng dữ liệu nào bị đụng.
-- Sau phần này, hệ thống quay về đúng cách hoạt động trước migration.

BEGIN;

-- A1. Hai hàm RPC. Xoá trước vì chúng tham chiếu tới các cột ở phần B.
DROP FUNCTION IF EXISTS nhan_job_render(text, text[], integer);
DROP FUNCTION IF EXISTS gia_han_lease(uuid, uuid, text, integer);

-- A2. Hai chỉ mục.
--
-- Lưu ý về `renders_idempotency_key_uniq`: xoá nó là BỎ LUÔN lớp chống trùng yêu
-- cầu. Nếu API đã bắt đầu nhận `idempotency_key`, hãy trả API về bản cũ cùng lúc,
-- nếu không hai lần bấm sẽ sinh hai job và trừ credit hai lần.
DROP INDEX IF EXISTS renders_idempotency_key_uniq;
DROP INDEX IF EXISTS renders_claimable_idx;

-- A3. Chú thích. Trả về NULL đúng như trước.
COMMENT ON TABLE  face_replace_jobs        IS NULL;
COMMENT ON COLUMN renders.job_type         IS NULL;
COMMENT ON COLUMN renders.stage            IS NULL;
COMMENT ON COLUMN renders.attempt_id       IS NULL;
COMMENT ON COLUMN renders.lease_expires_at IS NULL;

COMMIT;

-- Kiểm sau phần A: cả bốn dòng phải trả 0.
--
--   SELECT 'ham'    AS thu, count(*) FROM pg_proc
--    WHERE proname IN ('nhan_job_render','gia_han_lease')
--   UNION ALL
--   SELECT 'chi muc', count(*) FROM pg_indexes
--    WHERE indexname IN ('renders_idempotency_key_uniq','renders_claimable_idx');


-- ═══════════════════════ PHẦN B — CÓ MẤT DỮ LIỆU ═══════════════════════
--
-- ⚠️  MẶC ĐỊNH BỊ KHOÁ. Phải bỏ dấu chú thích thủ công mới chạy được.
--
-- Phần A đã đủ để hệ thống chạy như cũ. 21 cột thừa nằm im **không gây hại gì**:
-- không tốn đáng kể dung lượng (toàn NULL), không làm chậm truy vấn nào, và không
-- có mã nào bắt buộc phải đọc chúng.
--
-- Xoá cột chỉ nên làm khi chắc chắn sẽ không quay lại phương án này. Và nó MẤT
-- VĨNH VIỄN dấu vết điều tra: `attempt_id`, `claimed_by`, `attempt_count`,
-- `degraded_reason` là thứ duy nhất cho biết job nào đã chạy bao nhiêu lần và vì
-- sao xuống cấp.
--
-- ── Chạy câu này TRƯỚC để biết mình sắp mất gì ──
--
--   SELECT count(*) FILTER (WHERE attempt_id            IS NOT NULL) AS co_attempt,
--          count(*) FILTER (WHERE claimed_by            IS NOT NULL) AS co_worker,
--          count(*) FILTER (WHERE idempotency_key       IS NOT NULL) AS co_idem,
--          count(*) FILTER (WHERE duration_seconds      IS NOT NULL) AS co_thoi_luong,
--          count(*) FILTER (WHERE output_manifest       IS NOT NULL) AS co_manifest,
--          count(*) FILTER (WHERE credit_reservation_id IS NOT NULL) AS co_giu_cho,
--          count(*)                                                  AS tong
--     FROM renders;
--
-- Mọi cột trả 0 → xoá vô hại. Có cột khác 0 → đang xoá dữ liệu thật, cân nhắc lại.
--
-- ── Bỏ chú thích từ đây xuống để thực sự xoá ──
--
-- BEGIN;
--
-- ALTER TABLE renders
--   DROP COLUMN IF EXISTS job_type,
--   DROP COLUMN IF EXISTS input_mode,
--   DROP COLUMN IF EXISTS duration_seconds,
--   DROP COLUMN IF EXISTS idempotency_key,
--   DROP COLUMN IF EXISTS stage,
--   DROP COLUMN IF EXISTS attempt_id,
--   DROP COLUMN IF EXISTS attempt_count,
--   DROP COLUMN IF EXISTS claimed_by,
--   DROP COLUMN IF EXISTS lease_expires_at,
--   DROP COLUMN IF EXISTS heartbeat_at,
--   DROP COLUMN IF EXISTS retryable,
--   DROP COLUMN IF EXISTS next_retry_at,
--   DROP COLUMN IF EXISTS input_manifest,
--   DROP COLUMN IF EXISTS output_manifest,
--   DROP COLUMN IF EXISTS credit_reservation_id,
--   DROP COLUMN IF EXISTS prompt_bundle_version,
--   DROP COLUMN IF EXISTS render_plan_version,
--   DROP COLUMN IF EXISTS degraded_reason,
--   DROP COLUMN IF EXISTS started_at,
--   DROP COLUMN IF EXISTS completed_at,
--   DROP COLUMN IF EXISTS cancelled_at;
--
-- COMMIT;


-- ═══════════════════════ THỨ KHÔNG LÙI ĐƯỢC ═══════════════════════
--
-- Hai lệnh UPDATE backfill ở phần 2 của migration GHI ĐÈ không thể đảo.
-- Chúng chỉ ghi vào CỘT MỚI (`job_type`, `duration_seconds`), nên:
--
--   - Chạy PHẦN B (xoá cột) → dữ liệu backfill biến mất cùng cột. Sạch.
--   - Chỉ chạy PHẦN A      → giá trị backfill còn đó nhưng không ai đọc. Vô hại.
--
-- Không cột cũ nào bị migration sửa, nên không có gì để khôi phục. Đó là lý do
-- migration này an toàn: nó chỉ CỘNG THÊM, không bao giờ sửa thứ đang có.
