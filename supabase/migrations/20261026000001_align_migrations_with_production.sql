-- ============================================================
-- Đưa supabase/migrations khớp với CSDL production
-- Ngày 26/10/2026
--
-- Bối cảnh: schema production được dựng từ db/01-schema.sql rồi áp dần các
-- mảnh db/11-trash-logic.sql, db/12-add-progress.sql, db/13-render-pipeline.sql
-- bằng tay. Những mảnh đó chưa bao giờ vào supabase/migrations, nên deploy từ
-- migrations sẽ tạo ra schema THIẾU 11 cột mà code đang dùng.
--
-- Đo ngày 26/10: production 200 cột, migrations 175 cột.
-- Migration này bù đúng phần chênh của 2 bảng còn sống.
--
-- ADD COLUMN IF NOT EXISTS nên chạy trên production là no-op an toàn
-- (các cột đã có sẵn), còn trên máy sạch thì tạo mới cho đủ.
-- ============================================================


-- ─── projects: logic thùng rác và dọn dẹp (nguồn: db/11-trash-logic.sql) ───
-- Dùng bởi routes/projects.ts (/trash, /restore): 5 + 9 + 3 + 2 + 2 chỗ.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by          UUID,
  ADD COLUMN IF NOT EXISTS delete_reason       TEXT,
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_after         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_deleted_at  TIMESTAMPTZ;

-- Dọn định kỳ tìm theo purge_after nên cần chỉ mục
CREATE INDEX IF NOT EXISTS idx_projects_purge_after
  ON public.projects (purge_after)
  WHERE purge_after IS NOT NULL;


-- ─── renders: tiến độ và đường ống dựng video ───
-- Nguồn: db/12-add-progress.sql, db/13-render-pipeline.sql
-- aspect_ratio và progress mỗi cái được dùng 52 chỗ trong code.

ALTER TABLE public.renders
  ADD COLUMN IF NOT EXISTS aspect_ratio    TEXT NOT NULL DEFAULT '9:16',
  ADD COLUMN IF NOT EXISTS progress        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS composition_url TEXT,
  ADD COLUMN IF NOT EXISTS encode_job_id   TEXT;

-- composition_url và encode_job_id hiện chưa có code nào đọc (0 chỗ dùng),
-- giữ lại vì production đã có và việc xóa cột là không hoàn tác được.
