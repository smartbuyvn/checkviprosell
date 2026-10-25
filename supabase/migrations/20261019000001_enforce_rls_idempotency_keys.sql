-- P0-7: idempotency_keys chỉ backend (service role) được đọc/ghi.
-- Bật RLS không kèm policy = chặn hoàn toàn anon/authenticated qua PostgREST;
-- service role bỏ qua RLS nên webhook không bị ảnh hưởng. Chạy lại nhiều lần vẫn an toàn.
ALTER TABLE IF EXISTS public.idempotency_keys ENABLE ROW LEVEL SECURITY;
