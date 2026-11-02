-- Viprosell — Xoá clip gốc sau khi render xong
--
-- ── Vì sao ──
--
-- Bảng dung lượng ở spec V3 chỉ đếm video XUẤT RA (12,5MB/cái). Clip khách tự quay
-- nặng hơn nhiều, và trước nay nằm lại trong bucket cho tới khi dự án vào thùng rác
-- rồi quá 30 ngày:
--
--   1.000 dự án/tháng, chỉ video xuất ra ......  12 GB  ~4.800đ
--   1.000 dự án/tháng, kèm clip gốc thực tế ... 176 GB  ~68.600đ  (gấp 14 lần)
--
-- Clip gốc chỉ có ích TRONG LÚC dựng. Xong rồi thì nó không còn việc gì, trừ khi
-- khách muốn dựng lại — và 24 giờ là đủ rộng cho nhu cầu đó. Giữ 24h thay vì 30 ngày
-- đưa 176 GB xuống còn 5,9 GB.
--
-- ── Vì sao giữ bản ghi ──
--
-- Xoá cả hàng thì mất dấu vết: sau này không biết dự án từng có clip nào, không đối
-- soát được, và `getByProject` không phân biệt nổi "chưa từng tải lên" với "đã dọn".
-- Giống hệt cách `projects.storage_deleted_at` đang làm với video thành phẩm.

alter table public.project_assets
  add column if not exists storage_deleted_at timestamptz;

comment on column public.project_assets.storage_deleted_at is
  'Mốc file đã bị xoá khỏi bucket project-assets. Bản ghi giữ lại để còn lịch sử và đối soát; null = file vẫn còn.';

-- Vòng dọn chạy mỗi giờ và luôn lọc đúng hai cột này, nên đánh chỉ mục riêng phần
-- chưa dọn — phần đã dọn chỉ lớn dần và không bao giờ được quét lại.
create index if not exists project_assets_chua_don_idx
  on public.project_assets (project_id, asset_type)
  where storage_deleted_at is null;
