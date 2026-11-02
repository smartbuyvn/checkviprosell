-- ============================================================
-- Chỉ mục cho vòng quét job tồn
-- Ngày 27/10/2026
--
-- Tách khỏi 20261027000002 vì Postgres không cho dùng giá trị enum vừa thêm
-- ('pending') trong cùng transaction đã thêm nó. Gộp chung thì migration
-- trước đổ lỗi "unsafe use of new value of enum type render_status".
--
-- render.worker.ts gọi sweepPendingJobs() lúc khởi động để nhặt job đã vào
-- hàng đợi trong lúc worker chết, vì Realtime chỉ bắn khi có INSERT mới.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_renders_pending
  ON public.renders (created_at)
  WHERE status = 'pending';
