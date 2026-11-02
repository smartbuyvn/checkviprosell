-- ============================================================
-- Ràng buộc duy nhất trên project_id cho 4 bảng kết quả pipeline
-- Ngày 27/10/2026
--
-- Lỗi production (log VPS 27/10 09:31:58):
--   Script DB Error: there is no unique or exclusion constraint
--   matching the ON CONFLICT specification
--   at Object.runScriptComposer (.../src/services/ai.service.ts:299:26)
--
-- ai.service.ts gọi upsert(..., { onConflict: 'project_id' }) ở 4 chỗ:
--   dòng 146 product_intelligence
--   dòng 291 scripts
--   dòng 308 visual_packs
--   dòng 315 caption_exports
--
-- Postgres chỉ chấp nhận ON CONFLICT khi cột đó có ràng buộc duy nhất. Không
-- bảng nào có, nên cả 4 lệnh ghi đều hỏng: pipeline chạy xong rồi mất kết quả.
--
-- Mỗi dự án chỉ có MỘT bản ghi mỗi loại, đúng như upsert ngụ ý, nên project_id
-- là duy nhất là mô hình đúng chứ không phải mẹo vá lỗi.
--
-- ⚠️ CHẠY 20261027000004a_check_duplicates.sql TRƯỚC.
-- Nếu đang có dòng trùng, migration này sẽ báo lỗi và KHÔNG tạo chỉ mục nào.
-- Đó là cố ý: tôi không xoá dữ liệu production thay bạn.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_intelligence_project
  ON public.product_intelligence (project_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_scripts_project
  ON public.scripts (project_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_visual_packs_project
  ON public.visual_packs (project_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_caption_exports_project
  ON public.caption_exports (project_id);
