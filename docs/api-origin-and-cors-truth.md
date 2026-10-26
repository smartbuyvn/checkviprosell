# API Origin & CORS Truth

Mặc định máy chủ Fastify (Backend) ngăn chặn CORS (lỗi chặn AJAX chéo origin). Khách truy cập web Hostinger (`https://vidiosell.vn`) gọi Tunnel API (`https://api.vidiosell.vn`) sẽ bị Blocked by CORS policy nếu backend không cho phép.

Tại file `backend/src/server.ts` dòng 32, biến môi trường quyết định mạng sống kết nối là `ALLOWED_ORIGINS`.

**Sự kiện Operator:**
- Dev: `ALLOWED_ORIGINS=http://localhost:8080,http://localhost:8081`
- Production (Hostinger): Mở file `backend/.env` trên máy vật lý, thêm domain public vào whitelist:
`ALLOWED_ORIGINS=https://vidiosell.vn,http://localhost:8080`

API Tunnel do đó sẽ gửi Header `Access-Control-Allow-Origin: https://vidiosell.vn` trả về cho trình duyệt máy khách. Thái độ Zero-Trust Network!
