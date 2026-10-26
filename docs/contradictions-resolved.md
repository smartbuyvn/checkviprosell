# Resolved Contradictions

Bảng tổng kết giải quyết toàn bộ các mâu thuẫn lịch sử giữa các file Text rác và Source Code chạy thật.

| Topic | Current conflicting sources | Official decision | Reason | Files updated |
|---|---|---|---|---|
| **Admin Schema Source** | `README.md` (yêu cầu insert bảng `user_roles`) VS `ai.service.ts` (query bảng `profiles`) | Seed Role ở bảng `profiles` | Hệ thống DB Backend và SQL Migration được thiết kế query Role trực tiếp từ bảng Profiles. Tự văng lỗi nếu bảng `user_roles` bị gọi. | `README.md`, `official-supabase-setup.md` |
| **Supabase Frontend Key**| `.env` cũ (xài chung `PUBLISHABLE_KEY` và `ANON_KEY`) | Chỉ gọi duy nhất `VITE_SUPABASE_ANON_KEY` trong tài liệu Setup. | Tránh người mù công nghệ copy nhầm 2 biến. `import.meta.env` có rule fallback tương thích sẵn cả 2. | `env-contract.md` |
| **Render Cloud Ready** | Documents (Báo ready cho Scalable Cloud Render) | **Blocked**. Bắt buộc chạy FFmpeg nội bộ PC tại cổng Terminal phụ. | Codebase chưa hề tích hợp Provider Cloud-GPU (như Replicate/AWS). Bật lên sẽ gãy App. | `official-source-of-truth.md` |
| **Hostinger Deploy SPA**| Báo Deploy tĩnh FTP nhưng không nhắc Root Redirect | Nhét chung file `public/.htaccess` đè lên Root Hostinger. | Trả lỗi HTTP 404 cho mọi Route nếu Server Apache không có quy tắc Redirect React Router (Vite). | `official-hostinger-deploy.md` |

Mọi file cũ trong thư mục gốc nếu dẫn dắt sai lệch bảng này đều bị vô hiệu hóa.
