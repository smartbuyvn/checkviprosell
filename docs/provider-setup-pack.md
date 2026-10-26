# Provider Setup Pack

Để Viprosell chạy End-To-End, Operator cần kết nối 3 nền tảng Cloud:
1. **Supabase (Dữ liệu & Định danh)**: Cloud Postgres DB giữ chân lý về System Settings, User Profiles, Auth JWT, Payments, Asset URLs.
2. **Stripe (Tiền tệ)**: Gateway chặn gian lận, mở ra Webhook Payout 1 chiều giấu mặt.
3. **Cloudflare/Ngrok (Ingress Tunnel)**: Tầm hầm xuyên tường lửa nhà bạn để Frontend (Hostinger) và Stripe (Webhook) có thể gọi vào máy tính của bạn an toàn.
