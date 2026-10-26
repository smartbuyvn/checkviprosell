# Frontend Production Env Truth

Frontend SPA React được Build bằng Vite. Vite sẽ Bake cứng (hardcode) tất cả các biến có tiền tố `VITE_` vào mã Javascript minified cuối cùng.

Cấu trúc file `.env.production` (hoặc cấu hình CI/CD tại Hostinger):

| Variable | Target Value Type | Purpose | Risk Level |
|---|---|---|---|
| `VITE_API_BASE_URL` | Public Tunnel URL | Địa chỉ duy nhất để Axios gọi lệnh vào Cổng API Local nhà bạn. | Kẹt logic nếu gõ sai |
| `VITE_SUPABASE_URL` | Cloud DB URL | Giao tiếp Backend-as-a-service. | Mất DB/Auth nếu sai |
| `VITE_SUPABASE_ANON_KEY` | Public Anon JWT | Chìa khóa công khai nhận diện ứng dụng với Supabase Row Level Security. | Không nguy hiểm (Public key) |
| `VITE_APP_BASE_URL` | (DO NOT BAKE HERE) | Biến này thuộc Backend, không nhét vào Frontend vì nhầm lẫn. | N/A |

Hãy tạo thủ công file `.env.production` ở root folder trước khi chạy `npm run build`.
