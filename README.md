# Viprosell (VidioSell)

Viprosell là web app SaaS tạo video bán hàng ngắn cho seller/shop online từ link sản phẩm, 3–8 ảnh, hoặc 1 video mẫu. Dự án theo định hướng local-first, cloud-optional, asset-first: AI hỗ trợ phân tích và viết nội dung, còn video đầu ra được dựng từ asset thật thay vì mặc định dùng full generative video.

## Locked MVP Scope

MVP chỉ hỗ trợ 3 package:
- `quickads`
- `reviewvideo`
- `conversionvideo`

Đầu vào hợp lệ:
- Product URL
- 3–8 ảnh sản phẩm
- 1 video mẫu
- Mixed images + video
- Manual notes hỗ trợ AI parse

Đầu ra cốt lõi:
- Video draft 9:16
- Script
- Scene cards
- Overlay list
- Subtitle
- Caption/hashtags
- Thumbnail text

Không thuộc MVP:
- WordPress plugin
- Motion clone
- AI dancing
- Virtual try-on
- Face swap
- Full avatar presenter
- Full text-to-video mặc định
- Trend hunter phức tạp
- Batch generation lớn
- Marketplace templates

## System Architecture

Kiến trúc chuẩn của Viprosell gồm 3 khối tách biệt:

1. **Web UI / App Service**
   - Phụ trách giao diện, auth, dashboard, billing, affiliate, project CRUD và admin UI.

2. **AI Orchestrator**
   - Xử lý product intelligence, commerce angle, script, caption, subtitle và các JSON agents.
   - Ưu tiên local/self-host trước; cloud chỉ là tùy chọn hoặc fallback khi policy cho phép.

3. **Render Worker**
   - Chịu trách nhiệm render draft video, subtitle burn-in, overlay/CTA assembly, preview/export.
   - Được thiết kế tách riêng khỏi UI runtime để dễ scale.

Nguyên tắc hệ thống:
- Không nhúng render engine trực tiếp vào frontend.
- Mọi job AI/render phải đi qua record trạng thái.
- Web app chỉ đọc trạng thái qua API chuẩn hóa.

## Admin Policy Model

Hệ thống có các policy settings cốt lõi để kiểm soát local/cloud behavior:
- `LOCALONLYMODE`
- `CLOUDFALLBACKENABLED`
- `PREMIUMRENDERENABLED`
- `ALLOWEXTERNALAIAPIS`
- `LOCALLLMURL`
- `LOCALRENDERWORKERURL`
- `DEFAULTTTSMODE`

Các policy này được kiểm tra ở backend. Nếu cấu hình mâu thuẫn, backend reject (ví dụ LOCALONLYMODE=true nhưng PREMUM=true).

## Verification State

- **Repo-verified**: scope sản phẩm, kiến trúc 3 khối, local-first/cloud-optional, policy model, route groups và các nguyên tắc data flow. Cấu trúc JSON contract của Prompt.
- **Operator-dependent**: domain public, Supabase dashboard setup, SePay API Token/Webhook keys, Lemon Squeezy Store/Webhook secrets, tunnel/CORS, local Ollama, local worker startup. Biến môi trường hardware acceleration.
- **Needs runtime verification**: Mức độ hoàn thiện thực tế của render vật lý (tốc độ encode CPU/GPU), queue execution attempts, webhook SePay/Lemon Squeezy return flows, provider integrations, độ chính xác của AI parsing trên payload thực tại môi trường host.

## Known Limitations

- Render vật lý `draft_local` hiện tại mới ở dạng MVP (Stitching asset/placeholder), phần composition cao cấp (Subtitles động, Overlay phức tạp) yêu cầu runtime verification thêm.
- Tốc độ và concurrency của bullmq/worker trên máy chưa có benchmark, hệ thống cung cấp biến env nhưng chạy thực tế operator cần giám sát tài nguyên host.
- SePay và Lemon Squeezy webhooks yêu cầu tunneling (ngrok/Cloudflare) thực tế để nghiệm thu chu kỳ end-to-end làm single source of truth cho payment ledger. (Hệ thống Stripe cũ chỉ giữ cho mục đích legacy/deprecated).

## Core Flow & Developer Setup

Xem chi tiết trong:
- `FINAL-RUNBOOK.md`: runbook khởi động và vận hành.
- `operator-day-0-setup.md`: checklist/operator blockers.
