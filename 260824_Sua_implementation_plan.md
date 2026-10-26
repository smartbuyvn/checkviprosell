# Hoàn thiện Master Plan Viprosell Kiến trúc Local GPU Worker

Bản thiết kế (Master Plan) của bạn thực sự giải quyết triệt để nút thắt cổ chai về hiệu năng bằng cách tận dụng Supabase Realtime làm Message Queue thay cho BullMQ/Redis cũ, kết hợp xử lý 4-step Chain-of-Thought pipeline trước khi đẩy vào FFmpeg HWACCEL.

Tôi đã kiểm tra mã nguồn tại local và phát hiện:
1. **Pipeline 4 bước AI** (Brief -> Strategy -> Scene Graph -> Render Plan) đã được tích hợp rất đẹp mắt trong `pipeline.service.ts`.
2. **Local Render Worker** (`render.worker.ts`) đã sử dụng Supabase Realtime và FFmpeg NVENC (GPU 0), đồng thời đã upload lên `Supabase Storage`.
3. **Tuy nhiên**, tàn dư của Redis và BullMQ vẫn còn nằm rải rác ở backend (`queue.ts`, `server.ts`, `ai.worker.ts`), và Frontend vẫn chưa có giao diện tools phân tách theo dạng Shopee-to-Video và Image-to-Video.

Dưới đây là kế hoạch chi tiết để dọn dẹp sạch sẽ và hoàn thiện UI theo yêu cầu của bạn.

## Proposed Changes

### Dọn dẹp Kiến trúc (Backend - Loại bỏ Redis/BullMQ)
Xóa bỏ hoàn toàn Redis/BullMQ, biến hệ thống 100% cloud-native queue qua Supabase Realtime.
*   **[DELETE]** `backend/src/queues/queue.ts`: Không cần file kết nối Redis nữa.
*   **[DELETE]** `backend/src/ai.worker.ts`: Worker AI độc lập này không còn cần thiết vì `render.worker.ts` đã chạy toàn bộ `PipelineService.runFullPipeline()` nối tiếp 4 step.
*   **[MODIFY]** `backend/src/server.ts`: Xóa bỏ code khởi tạo và health-check Redis.
*   **[MODIFY]** `backend/src/routes/admin.ts`, `backend/src/routes/ai.ts`, `backend/src/routes/render.ts`: Xóa các endpoint phụ thuộc vào API của BullMQ.

### Cải tiến UX/UI Frontend (Hệ thống Công cụ & Polling)
Tạo ra các trang đích riêng biệt, rõ ràng và sử dụng cơ chế Polling Fetch Status (tương tự Midjourney/AiDancing).
*   **[MODIFY]** `src/constants/routes.ts`: Thêm định nghĩa route.
*   **[MODIFY]** `src/App.tsx`: Đăng ký các Route mới vào trong layout `AuthGuard`.
*   **[NEW]** `src/pages/tools/ShopeeToVideo.tsx`: Giao diện paste URL Shopee. Luồng: Submit -> Nhận `jobId` -> Hiển thị Loading State -> Polling Supabase API (mỗi 2s) -> Đổi thành trạng thái "Completed" và phát video MP4.
*   **[NEW]** `src/pages/tools/ImagesToVideo.tsx`: Giao diện Upload 3-10 hình ảnh để tạo Video tương tự luồng Shopee.
*   **[NEW]** `src/components/tools/RenderJobStatus.tsx`: Component dùng chung để polling và hiển thị Progress Bar (5% -> 15% -> 25% -> 100%).

## Verification Plan

### Automated / Syntax Check
- Khởi động backend dev server để đảm bảo sạch lỗi import BullMQ.
- Chạy TS compiler cho giao diện mới.

### Manual Verification
- Test truy cập giao diện `/tools/shopee-to-video`.
- Xác nhận job tạo thành công trong Supabase và polling bar hoạt động đúng.

---
**Nhấn Proceed** để tôi chính thức dọn dẹp và bổ sung UI. Mọi thay đổi đều theo sát định hướng Master Plan của bạn!
