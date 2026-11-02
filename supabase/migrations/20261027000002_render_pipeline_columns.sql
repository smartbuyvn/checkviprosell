-- ============================================================
-- Bù phần còn thiếu của đường ống render
-- Ngày 27/10/2026
--
-- Bối cảnh: migration 20261026000001 ghi nguồn là db/13-render-pipeline.sql
-- nhưng chỉ mang sang aspect_ratio, progress, deleted_at, composition_url
-- và encode_job_id. Năm cột JSONB và giá trị enum 'pending' bị bỏ sót, nên
-- production báo:
--
--   RENDER_INSERT_FAILED: Could not find the 'scene_graph_json' column
--   of 'renders' in the schema cache
--
-- Sửa xong cột vẫn chưa chạy được: render_status trên production là
-- ('queued','processing','completed','failed','cancelled') - không có
-- 'pending', trong khi composition.service.ts insert status='pending' và
-- render.worker.ts chỉ lắng nghe filter status=eq.pending. Thiếu một trong
-- hai thứ thì job không bao giờ được nhận.
--
-- Chạy lại nhiều lần đều an toàn: IF NOT EXISTS ở mọi câu lệnh.
-- ============================================================


-- ─── renders: năm cột JSONB của đường ống 4 tầng ───
-- raw_input          <- composition.service.ts, render.worker.ts
-- scene_graph_json   <- composition.service.ts:44, quick-ads-render.service.ts:108
-- product_brief_json <- tầng 1 ghi brief sản phẩm
-- strategy_json      <- tầng 2 ghi chiến lược
-- render_plan_json   <- tầng 4 ghi kế hoạch dựng, worker đọc lại để render

ALTER TABLE public.renders
  ADD COLUMN IF NOT EXISTS raw_input          JSONB,
  ADD COLUMN IF NOT EXISTS scene_graph_json   JSONB,
  ADD COLUMN IF NOT EXISTS product_brief_json JSONB,
  ADD COLUMN IF NOT EXISTS strategy_json      JSONB,
  ADD COLUMN IF NOT EXISTS render_plan_json   JSONB;


-- ─── renders: ảnh đại diện của video ───
-- Trang chủ, Dashboard và trang dự án đều cần một ảnh tĩnh để hiện trước khi
-- khách bấm phát. Trước giờ chưa có cột nào giữ nó, nên các khung demo ngoài
-- trang chủ phải vẽ gradient giả thay cho ảnh thật.
--
-- render.worker.ts trích một khung hình bằng ffmpeg ngay sau khi dựng xong,
-- tải lên cùng chỗ với video rồi ghi đường dẫn vào đây.

ALTER TABLE public.renders
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;


-- ─── render_status: thêm 'pending' ───
-- Đặt trước 'queued' cho khớp thứ tự trong db/01-schema.sql, vì thứ tự giá trị
-- enum quyết định kết quả khi ORDER BY theo cột này.
--
-- KHÔNG gộp chung transaction với câu lệnh nào dùng giá trị 'pending':
-- Postgres không cho dùng giá trị enum vừa thêm trong cùng transaction.

ALTER TYPE public.render_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'queued';
