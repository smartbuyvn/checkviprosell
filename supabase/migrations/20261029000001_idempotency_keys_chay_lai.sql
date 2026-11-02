-- ============================================================
-- Tạo bảng `idempotency_keys` trên CSDL thật.
--
-- Vì sao phải chạy lại: migration 20260821000001 có trong repo nhưng CHƯA BAO GIỜ
-- được áp lên CSDL production. Hậu quả phát hiện ngày 29/10/2026:
--
--   Webhook SePay chèn khoá chống trùng TRƯỚC khi cộng credit, và fail-closed khi
--   bảng không có (đúng — không chống trùng được thì không được cộng tiền). Nhưng
--   bảng không tồn tại, nên MỌI giao dịch thật trả về 500 IDEMPOTENCY_UNAVAILABLE.
--   Không một khách nào mua được gói. Đo thật: 5/5 phép thử luồng tiền đều trượt.
--
-- Không test nào bắt được vì `tests/db-tables.test.ts` chỉ đối chiếu mã nguồn với
-- một danh sách cứng, còn `soat-tien.ts` dùng `count: 'exact', head: true` — kiểu
-- truy vấn trả về `error=null, count=null` cho bảng không tồn tại, nên nó in
-- "0 dong" y như một bảng rỗng.
--
-- Chạy lại nhiều lần đều an toàn.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  action          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Chỉ service role (webhook) đụng tới bảng này. Service role vốn bỏ qua RLS, nên
-- chính sách dưới đây chủ yếu để chặn người dùng thường: bật RLS mà không có chính
-- sách nào áp dụng cho họ nghĩa là họ không đọc không ghi được gì.
DROP POLICY IF EXISTS "Service role full access" ON public.idempotency_keys;
CREATE POLICY "Service role full access" ON public.idempotency_keys
  FOR ALL TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Dọn khoá cũ theo thời gian.
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON public.idempotency_keys (created_at);

-- Báo PostgREST nạp lại schema, nếu không bảng vẫn "không tìm thấy" cho tới lần
-- nạp lại kế tiếp và sẽ rất khó hiểu vì sao vừa tạo xong mà vẫn lỗi y như cũ.
NOTIFY pgrst, 'reload schema';
