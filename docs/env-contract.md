# Official Environment Contract

*Hệ quy chiếu duy nhất về tên Biến. Package.json và Code Base đang bắt đúng Tên In In Đậm này.*

### FRONTEND VITE (Baked to Client)
Rót trực tiếp vào JS tại Browser. Tên biến phải có tiền tố `VITE_`.
1. `VITE_API_BASE_URL`: Địa chỉ Backend Fastify của bạn.
2. `VITE_SUPABASE_URL`: DB URL.
3. `VITE_SUPABASE_ANON_KEY`: Lấy Key Public của Firebase Supabase.

*(Ghi chú: Lịch sử từng dùng `VITE_SUPABASE_PUBLISHABLE_KEY`. Code hiện tại nhận song song hai biến, rớt qua rớt lại. Nhưng chuẩn hóa tài liệu Operator là gõ ANON_KEY).*

### BACKEND FASTIFY (Server Only)
Nằm trong lõi cứng. Tuyệt đối không Leak lên Front-End. Không gắn tiền tố VITE_.
1. `SUPABASE_SERVICE_ROLE_KEY`: Token Thần Thánh Bypass CSDL SQL. 
2. `STRIPE_SECRET_KEY`: Ví tiền Stripe.
3. `STRIPE_WEBHOOK_SECRET`: `whsec_...` bảo vệ Server bị Hacker Spam Tiền giả.
4. `ALLOWED_ORIGINS`: Danh sách Domain FE được phép móc API Backend gọi HTTP Request.
5. `VITE_APP_BASE_URL`: Cái này dành cho lệnh *Backend Redirection* báo lại Stripe đưa khách về Website FE nào, do đó nó nhận giá trị của Website.
