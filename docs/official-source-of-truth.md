# Official Source of Truth

Tài liệu này là LUẬT tối cao của kiến trúc Viprosell V1. Mọi code, PR, hay docs khác nếu mâu thuẫn với file này đều bị coi là sai.

### A. Framework/Runtime Chính Thức
- **Frontend Architecture:** React 18 + Vite (Thuần SPA, Không dùng Next.js hay SSR).
- **Backend Architecture:** Node.js 20+ Fastify (Local-first, không dùng Deno Edge/Supabase Edge Functions cho luồng core).
- **Build Command Cuối Cùng:** `npm run build` (Sinh ra thư mục `/dist` nén tĩnh).
- **Deploy Target:** Hostinger Shared/VPS Hosting cho Frontend. Máy trạm vật lý (Operator) cho Backend/AI/Queue.

### B. Phạm Vi Sản Phẩm (Scope) Chính Thức
- **Số lượng Packages:** ĐÓNG TẠI 3 GÓI: QuickAds, ReviewVideo, ConversionVideo. Mọi feature rẽ nhánh khác (FaceFusion, TTS premium, Motion tracking) là *Out-of-Scope Phase 1*.
- **Mức độ phụ thuộc Cloud:** Hệ thống là **Local-First**. Cloud Supabase đóng vai trò DB/Auth, API LLM là cục bộ (Ollama), Render là cục bộ (FFmpeg). Tùy chọn Cloud Render bị khóa mã cứng (`PREMIUM_RENDER_ENABLED=false`).
- **Billing Flow:** Thanh toán Stripe Checkout Session -> Server nhận Webhook -> Bơm Credits. Lỗ hổng Idempotency đã bị khóa chặt. Mọi thanh toán Live đang bị `Blocked` cho đến khi User Operator tự điền Keys Auth thật.
