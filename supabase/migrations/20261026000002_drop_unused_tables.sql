-- ============================================================
-- Xóa 2 bảng chết: scenes và face_replace_jobs
-- Ngày 26/10/2026
--
-- Kiểm chứng trước khi xóa:
--   - Số dòng trên production: scenes = 0, face_replace_jobs = 0
--     (so sánh: projects 25, renders 8, profiles 10 — dữ liệu thật nằm chỗ khác)
--   - Số chỗ dùng trong code: 0 cho cả hai
--     (grep from('scenes') và from('face_replace_jobs') trên backend/src và src)
--   - Cả hai bật RLS nhưng KHÔNG có policy nào, nên frontend cũng không đọc được
--
-- Kế hoạch V2 đã chốt bỏ face-swap, nên face_replace_jobs không còn vai trò.
-- scenes bị thay bằng variants.timeline_json trong thiết kế V2.
--
-- CASCADE để gỡ luôn policy và ràng buộc trỏ tới hai bảng này.
-- ============================================================

DROP TABLE IF EXISTS public.face_replace_jobs CASCADE;
DROP TABLE IF EXISTS public.scenes CASCADE;
