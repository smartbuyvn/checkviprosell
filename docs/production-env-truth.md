# Production Environment Truth

Văn bản thiết lập biến môi trường chuẩn nhất cho Giai đoạn Production.

## 1. Domain Chính Thức (Canonical Domain)
Tên miền Frontend được chọn làm mốc chuẩn (Dựa trên file `.env` Operator vừa truyền vào): **`https://xyzbuy.net`**.
*Lưu ý (Needs operator confirmation): Bạn báo lỗi xảy ra ở `xyzbuy.net`. Nếu tên miền thực tế bạn mua là đuôi `.net`, vui lòng tự đổi tất cả đuôi `.com` dưới đây thành `.net` khi dán vào Code thực.*

## 2. API Target Tunnel
Frontend gọi API qua Cloudflare Tunnel: **`https://api.xyzbuy.net/api/v1`** (Không được phép dùng Localhost 3001 tại Hostinger).
*Blocker/Needs Confirmation:* Ở biến môi trường `VITE_API_BASE_URL`, **Dường như bạn dùng Hostinger tĩnh**, việc set Proxy Pass ở đó rất mệt mỏi. Cách Nhẹ Nhàng Nhất là tạo subdomain `api` trên Cloudflare trỏ CNAME về Tunnel. Sửa thành `VITE_API_BASE_URL=https://api.xyzbuy.net/api/v1`.

## 3. Bản Mẫu An Toàn Cho Production (`.env` Front-end)
Rập khuôn cứng như sau:
```env
VITE_API_BASE_URL=https://api.xyzbuy.net/api/v1
VITE_APP_BASE_URL=https://xyzbuy.net
VITE_SUPABASE_URL=https://zwyslulwwfdvjxrkcleq.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_eQnapT8swzUkOUFTD...
```

## 4. Bản Mẫu An Toàn Cho Server Backend `backend/.env`
```env
ALLOWED_ORIGINS=https://xyzbuy.net,http://localhost:8080
SUPABASE_URL=https://zwyslulwwfdvjxrkcleq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
# Stripe webhook sau này
```
