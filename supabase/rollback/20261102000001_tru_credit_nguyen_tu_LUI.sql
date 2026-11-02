-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  LÙI migration 20261102000001_tru_credit_nguyen_tu.sql                   ║
-- ║                                                                          ║
-- ║  KHÔNG nằm trong supabase/migrations/ là CỐ Ý: mọi tệp trong thư mục đó  ║
-- ║  sẽ được `supabase db push` áp dụng.                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ── ĐỌC TRƯỚC KHI CHẠY ──
--
-- 1. NẾU `CreditService.deductToLedger` đã gọi `tru_credit_render()` thì PHẢI trả mã
--    về bản cũ TRƯỚC. Xoá hàm trong khi mã còn gọi nó = MỌI lần trừ credit thất bại,
--    tức mọi render hoàn thành đều bị coi là không trừ được tiền.
--
-- 2. Đây là đường TIỀN. Lùi lại là quay về trạng thái có hai lỗ đã biết:
--    - Hai lần trừ đồng thời cùng đọc một số dư, cùng vượt chốt "không đủ".
--    - Không có ràng buộc nào chặn trừ hai lần cho cùng một render.
--    Chỉ lùi khi hàm mới gây sự cố nặng hơn hai lỗ đó.
--
-- 3. PHẦN A đảo ngược hành vi và an toàn. PHẦN B xoá cột, có mất dữ liệu, mặc định khoá.

-- ═══════════════════════════ PHẦN A — AN TOÀN ═══════════════════════════

BEGIN;

-- A1. Hàm. Xoá trước vì nó tham chiếu cột ở phần B.
DROP FUNCTION IF EXISTS tru_credit_render(uuid, uuid, uuid, integer, text);

-- A2. Chỉ mục duy nhất.
--
-- ⚠️ Xoá nó là BỎ bất biến "một render chỉ bị trừ một lần". Sau bước này, hai callback
-- cho cùng một render sẽ trừ tiền khách HAI LẦN mà không gì chặn lại.
DROP INDEX IF EXISTS credit_ledger_render_tru_uniq;

-- A3. Chú thích.
COMMENT ON COLUMN credit_ledger.render_id IS NULL;

COMMIT;

-- Kiểm sau phần A: cả hai dòng phải trả 0.
--
--   SELECT 'ham' AS thu, count(*) FROM pg_proc WHERE proname = 'tru_credit_render'
--   UNION ALL
--   SELECT 'chi muc', count(*) FROM pg_indexes
--    WHERE indexname = 'credit_ledger_render_tru_uniq';


-- ═══════════════════════ PHẦN B — CÓ MẤT DỮ LIỆU ═══════════════════════
--
-- ⚠️  MẶC ĐỊNH BỊ KHOÁ. Phải bỏ dấu chú thích thủ công mới chạy được.
--
-- Phần A đã đủ để hệ thống chạy như cũ. Cột `render_id` nằm im không gây hại: các dòng
-- cũ đều NULL, và không mã nào bắt buộc phải đọc nó sau khi phần A đã chạy.
--
-- Xoá cột là MẤT VĨNH VIỄN mối nối giữa bút toán và render sinh ra nó — thứ duy nhất
-- cho biết một lần trừ tiền thuộc về lần dựng nào. Trên một bảng tiền, đó là dấu vết
-- đối soát, không phải dữ liệu phụ.
--
-- ── Chạy câu này TRƯỚC để biết mình sắp mất gì ──
--
--   SELECT count(*) FILTER (WHERE render_id IS NOT NULL) AS co_render_id,
--          count(*)                                     AS tong
--     FROM credit_ledger;
--
-- co_render_id = 0 → xoá vô hại. Khác 0 → đang xoá dấu vết đối soát thật.
--
-- ── Bỏ chú thích từ đây xuống để thực sự xoá ──
--
-- BEGIN;
-- ALTER TABLE credit_ledger DROP COLUMN IF EXISTS render_id;
-- COMMIT;


-- ═══════════════════════ THỨ KHÔNG LÙI ĐƯỢC ═══════════════════════
--
-- Migration này KHÔNG backfill và KHÔNG sửa dòng nào đang có — nó chỉ cộng thêm một
-- cột, một chỉ mục và một hàm. Nên không có dữ liệu cũ nào cần khôi phục.
--
-- Những bút toán do `tru_credit_render()` tạo ra trong lúc nó còn sống thì VẪN ĐÚNG và
-- phải giữ: chúng là tiền đã trừ thật. Phần B chỉ xoá cột `render_id` của chúng, không
-- xoá bút toán.
