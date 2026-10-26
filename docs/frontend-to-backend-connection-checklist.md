# Frontend to Backend Connection Checklist

[ ] Kiểm tra Front-end `.env.production` (hoặc `.env` tùy Vite setup), dòng `VITE_API_BASE_URL` trỏ vào Cloudflare/Ngrok HTTPS link. (Sử dụng URL đầy đủ, VD: `https://api.domain.com/api/v1`).
[ ] File `src/services/billing.service.ts` và mọi Axios/Fetch clients bên trong Frontend phải nương vào biến này để làm `axios.create({ baseURL })`. (Đã verified trong source!).
[ ] Kiểm tra Back-end `.env`, dòng `ALLOWED_ORIGINS` phải chứa Domain Front-end tĩnh (Hostinger).
[ ] Khẩn cấp: Khởi động lại Server Back-end (tắt Cmd và bật lại lệnh `start`) để Biến Cors Environment được nhúng vào memory.
