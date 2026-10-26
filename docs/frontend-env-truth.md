# Frontend Build Variables Truth

Khi gõ lệnh `npm run build` trên máy cá nhân để xuất file cho Hostinger, Vite sẽ **khóa chết (bake)** các biến môi trường vào Javascript tĩnh. 
Vui lòng tạo file `.env.production` (hoặc sửa trực tiếp biến `.env`) trong thư mục root frontend để `Vite` ăn vào:

```env
VITE_API_BASE_URL=https://api.vidiosell.vn/api/v1
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=ey...
```

**LUẬT BẤT BIẾN:**
Tuyệt đối không nhét `STRIPE_SECRET_KEY` hay `SUPABASE_SERVICE_ROLE_KEY` vào frontend `.env`. Phải tuân thủ zero-trust, UI chỉ giao tiếp API.
