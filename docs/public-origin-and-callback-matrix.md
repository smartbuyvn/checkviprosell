# Public Origin & Callback Matrix

Luồng dữ liệu giao tiếp liên nền tảng được định tuyến qua 3 biến môi trường mang tính xương sống:

| Env Var | Nơi Khai Báo | Vai trò | Điền bằng Data thật nào? |
|---|---|---|---|
| **VITE_API_BASE_URL** | Frontend `.env.production` | Trỏ App SPA vào Endpoint API trung tâm. | Domain của Cloudflare Tunnel, ví dụ: `https://api.vidiosell.vn/api/v1` |
| **ALLOWED_ORIGINS** | Backend `.env` | Bảo vệ Fastify CORS filter khỏi DDoS giả mạo domain ác ý. | Domain của Hostinger, ví dụ: `https://vidiosell.vn` |
| **VITE_APP_BASE_URL** | Backend `.env` | Nói cho Webhook Stripe biết sau khi khách trả tiền xong thì đá về trang web nào. | Domain của Hostinger, ví dụ: `https://vidiosell.vn` |
| **BACKEND_PUBLIC_BASE_URL** | Backend `.env` | Tự Fastify chỉ điểm ra Node public của nó, để FFmpeg Local gọi URL cập nhật status Render Exported. | Domain của Cloudflare Tunnel, ví dụ: `https://api.vidiosell.vn/api/v1` |

Hậu quả nếu Operator cấu hình vòng lặp này sai: Mất mạng Auth, Tiền Stripe thu được xong kẹt màn trắng ảo, hoặc Export Render không trừ điểm User.
