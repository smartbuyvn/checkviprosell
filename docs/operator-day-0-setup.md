# Day-0 Setup Matrices

Tập hợp ma trận ràng buộc của 2 Provider hạ tầng tĩnh (Hostinger SPA Front + Supabase DB).

---

## A. HOSTINGER READINESS MATRIX

| Item | Verified in code | Needs operator dashboard action | Blocker | Done criteria |
|---|---|---|---|---|
| **Vite SPA Build Configuration** | `Verified` (`vite.config.ts`, `package.json`) | No | None | Lệnh `npm run build` nén được Bundle. |
| **Routing Origin Fallback** | `Verified` (`public/.htaccess`) | No | None | Chuyển trang `/tools` không hiện 404 Error. |
| **API Target Isolation** | `Verified` (`import.meta.env.VITE_API_BASE_URL`) | Yes (Fill in `.env.production`) | Tunnel Domain | FE trỏ chính xác về IP backend. |
| **Public Upload / CNAME** | `Documented Target Only` | Yes (hPanel File Manager) | Operator | Tên miền trỏ thành công về Hostinger IP. |

---

## B. SUPABASE READINESS MATRIX

| Item | Verified in code | Needs operator dashboard action | Secret required | Done criteria |
|---|---|---|---|---|
| **Auth JWT Hooks** | `Verified` (Supabase Client SDK load env natives) | No | `SUPABASE_ANON_KEY` | Đăng nhập/Đăng ký trơn tru. |
| **Post-Login Redirect** | `Documented Target Only` | Yes (Tại trình đơn Authentication) | No | Supabase nhả link redirect về đúng tên miền Hostinger. |
| **Datalayer Migrations** | `Verified` (13 Migrations available) | Yes (Chạy `npm run build`) | `SUPABASE_URL` | Bảng Renders và Credits đã mọc ở SQL Remote. |
| **Admin UI Roll** | `Documented Target` | Yes (Chỉnh tay Record Database) | No | Giao diện xuất hiện "Quản Trị Hệ Thống". |

---

## C. EXTERNAL BLOCKERS MATRIX

Ma trận này chỉ ra "Những rào cản từ Thế giới Thực" chặn con đường Live 100%, mà Code (Repo local) không thể tự fix.

| Area | Current status | Why blocked | Repo fix possible | Operator action required |
|---|---|---|---|---|
| **DNS Ngrok / Cloudflare Tunnel** | Blocked Externally | Chưa có đường hầm HTTPS xuyên tường từ Router tới Firewall máy Local. | **No** | Lên web Cloudflare gõ tạo Zero Trust Tunnel, nhập CNAME. |
| **Stripe Live Checkout** | Blocked Externally | Code sẵn sàng, nhưng biến `STRIPE_PRICE_ID_BASIC` đang rỗng, không có giá trị đối chiếu tới Bank Entity. | **No** | Lên Stripe lập gói sản phẩm, thu ID về file `backend/.env`. |
| **Physical Render Worker**| Blocked (Power State)| Code `render.worker.ts` hoàn hảo nhưng yêu cầu Card Đồ Họa vật lý mở điện. | **No** | Bật CMD gõ chuỗi `npm run worker:render` để máy tính bắt đầu nghe nhạc nền BullMQ. |
| **Cloud Render Provider** | Blocked by missing real provider | Source-of-Truth chốt V1 là **Local-only**. | **Yes (Phase 2)** | Không có. Premium Mode đã khóa kín bởi Admin. |
| **Local LLM Verification** | Blocked Externally | Code trỏ về Local port `11434` nhưng Ollama Desktop chưa mồi. | **No** | Operator phải bật APP Ollama và tải model `qwen2.5:7b`. |
