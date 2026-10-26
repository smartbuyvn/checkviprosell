# Thư mục `db/` — lưu trữ lịch sử, KHÔNG phải nguồn sự thật

**Nguồn sự thật của schema là `supabase/migrations/`.** Chốt ngày 26/10/2026.

## Vì sao có ghi chú này

Các file trong đây là cách dựng schema thời kỳ đầu: `01-schema.sql` tạo nền,
rồi áp dần các mảnh đánh số (`11-trash-logic.sql`, `12-add-progress.sql`,
`13-render-pipeline.sql`…) lên production **bằng tay**.

Hệ quả: tồn tại song song hai bộ mô tả schema lệch nhau, và không có gì chỉ ra
bộ nào đúng. Ngày 20/10/2026 việc này đã dẫn tới một kết luận sai trong tài liệu
kế hoạch — `db/01-schema.sql` bị coi là file cũ bỏ đi, trong khi nó mới là thứ
khớp với production.

Đo ngày 26/10/2026 trước khi hợp nhất:

| | Số cột |
| --- | --- |
| Production | 200 |
| `supabase/migrations/` | 175 |

Phần chênh 25 cột: 17 thuộc 2 bảng chết (`scenes`, `face_replace_jobs` — đã xóa),
11 cột còn lại thuộc `projects` và `renders`, **đang được code dùng**
(`aspect_ratio` và `progress` mỗi cái 52 chỗ).

Migration `20261026000001_align_migrations_with_production.sql` đã bù phần chênh đó.

## Quy tắc từ nay

- Mọi thay đổi schema viết thành migration mới trong `supabase/migrations/`.
- **Không sửa file trong thư mục này.** Không áp file ở đây lên bất kỳ CSDL nào.
- Không sửa schema trực tiếp trên dashboard Supabase — làm vậy là tạo lại đúng
  tình trạng lệch đã mất công gỡ.

Giữ thư mục để tra cứu lịch sử. Xóa được khi không còn ai cần đối chiếu.
