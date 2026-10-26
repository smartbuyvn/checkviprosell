# Official Installation Guide

Sổ tay lắp ráp cài đặt ViproSell lên Môi trường Production (Nửa Cloud - Nửa Local).

### Phase 1: Mở Port & Configs Local
1. Checkout toàn bộ Repo.
2. Thiết lập 2 File Môi trường (`.env` thư mục gốc, và `.env` trong thư mục `/backend` theo file template `env-contract.md`). Đảm bảo nhập Public URL, Secret Keys thật.
3. Mở Port Router (Tạo Cloudflare Tunnel) trỏ DNS `api.vidiosell.vn` vào `127.0.0.1:3001`.

### Phase 2: Hostinger Deploy SPA
1. Đọc và làm theo `docs/official-hostinger-deploy.md`.
2. Dùng lệnh `npm run build` -> quăng `/dist` tĩnh lên Hostinger. Giao diện được cấp điện.

### Phase 3: Supabase Setup (Cơ sở dữ liệu)
1. Đọc `docs/official-supabase-setup.md`. Kích hoạt Auth Email. Trỏ Redirect URL đúng IP/Domain bạn vừa mua.
2. Thêm tay quyền `admin` cho nick vận hành.

### Phase 4: Heartbeat Booting
1. `docker compose up redis -d`
2. Khởi chạy 3 cửa sổ CMD Node Backend liên tiếp:
   - `npm run backend:dev`
   - `npm run worker:ai`
   - `npm run worker:render`
3. Check `https://api.vidiosell.vn/health` -> Trả về JSON 200 OK. 
Mọi thứ đã Live. Bắt đầu đẩy Ads kinh doanh!
