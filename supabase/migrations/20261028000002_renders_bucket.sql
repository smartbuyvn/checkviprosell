-- ============================================================
-- Tạo kho chứa video đã dựng
-- Ngày 28/10/2026
--
-- Lỗi production: "Storage upload failed: Bucket not found"
--
-- render.worker.ts tải video và ảnh đại diện lên bucket 'renders'
-- (supabase.storage.from('renders')), nhưng migration gốc chỉ tạo
-- 'project-assets'. Bucket 'renders' chưa bao giờ tồn tại, nên mọi lần render
-- đều chạy hết pipeline, dựng xong video, rồi hỏng ở bước cuối.
--
-- Để public = true vì frontend phát và tải video qua getPublicUrl(). Đổi sang
-- private thì phải chuyển toàn bộ sang signed URL — thay đổi lớn hơn, để sau.
--
-- ⚠️ Lưu ý về quyền riêng tư: bucket công khai nghĩa là ai có đường dẫn đều xem
-- được video. Tên file là render_final_<uuid>.mp4 nên không đoán ra được, nhưng
-- đây là bảo mật kiểu "link bí mật", không phải kiểm soát truy cập thật. Chấp
-- nhận được với video quảng cáo; không phù hợp nếu sau này chứa nội dung riêng tư.
--
-- Chạy lại nhiều lần đều an toàn.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'renders',
  'renders',
  true,
  -- 200 MB: video 25 giây ở 4 Mbps khoảng 12,5 MB, nên đây là mức rộng rãi
  -- cho video dài hơn mà vẫn chặn được file khổng lồ do lỗi nào đó.
  209715200,
  ARRAY['video/mp4', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ─── Quyền đọc công khai ───
-- Bucket public = true đã cho đọc qua đường dẫn công khai, nhưng thêm policy
-- tường minh để hành vi không phụ thuộc vào cấu hình bucket bị đổi về sau.

DROP POLICY IF EXISTS "Ai cung doc duoc video da dung" ON storage.objects;
CREATE POLICY "Ai cung doc duoc video da dung" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'renders');


-- ─── Quyền ghi ───
-- Worker dùng service role key nên bỏ qua RLS; policy này chỉ để người dùng đã
-- đăng nhập KHÔNG ghi đè được video của người khác nếu sau này có đường ghi từ
-- trình duyệt. Hiện tại không có đường đó.

DROP POLICY IF EXISTS "Chi service role duoc ghi video" ON storage.objects;
CREATE POLICY "Chi service role duoc ghi video" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'renders' AND false);
