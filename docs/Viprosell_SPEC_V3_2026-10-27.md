# Viprosell — Spec V3 (bản chốt kiến trúc)

**Ngày:** 27/10/2026 · **Thay thế:** `docs/Viprosell_SPEC_V2_2026-10-19.md` và mọi tài liệu tháng 4.
**Trạng thái:** chuẩn thực thi. Khi tài liệu khác mâu thuẫn với bản này, bản này đúng.

> Viết cho đội phát triển. Mỗi quyết định kèm lý do và cách kiểm chứng, để người đọc sau
> không phải đoán vì sao lại chọn như vậy.

---

## 0. Vì sao có V3

V2 (19/10) đúng về hướng nhưng ba giả định nền đã thay đổi:

| Giả định V2 | Thực tế 27/10 | Hệ quả |
|---|---|---|
| TTS phải mua (FPT.AI 85đ, Google 590đ/video) | VieNeu-TTS chạy CPU máy nhà, 0đ biến đổi | Khoản chi lớn nhất biến mất — tính lại toàn bộ biên |
| Đầu vào chỉ là ảnh tĩnh | Thêm video người bán tự quay theo gợi ý | Video trung thực hơn, đây là điểm khác biệt |
| Render ở đâu cũng được | Máy cá nhân có sẵn CPU/GPU nhàn rỗi | Chi phí render ≈ 0, VPS chỉ làm API |

V3 giữ nguyên phần đã kiểm chứng của V2 và thay ba chỗ trên.

---

## 1. Chín quyết định kiến trúc

| # | Hạng mục | Chốt | Lý do |
|---|---|---|---|
| 1 | Hàng đợi | Bảng Postgres + `claim_job` có `lease_until` | Bỏ Redis; việc không mất khi worker tắt; worker chết thì job được thu hồi |
| 2 | Render | FFmpeg CPU `libx264` | Đã đo 13,8s CPU cho video 25s; không cần GPU; worker chạy được ở bất kỳ đâu |
| 3 | Nơi chạy worker | Máy cá nhân, worker **gọi ra** kéo việc | Không mở cổng vào máy nhà; không cần Cloudflare Tunnel; chi phí compute ≈ 0 |
| 4 | Phụ đề | File ASS (libass) | `drawtext` xoá cả dòng khi gặp `%`, không tự xuống dòng, và xoá dấu nháy đơn |
| 5 | Giọng đọc | VieNeu-TTS v3 Turbo trên CPU worker | Nền NeuTTS-Air **Apache 2.0**; 0đ biến đổi; dữ liệu không rời máy |
| 6 | LLM | Claude Haiku 5.5 chính, Gemini 2.5 Flash dự phòng | 0,10/0,50 USD so với 0,30/2,50 mỗi 1M token — rẻ hơn ~4 lần |
| 7 | Thanh toán | VietQR / SePay, đối soát bằng **mã tham chiếu** | Phí ~0% so với ~18% của cổng quốc tế trên đơn 99k |
| 8 | Lưu video | Cloudflare R2 + xoá theo chu kỳ | Không phí tải về; ổ máy nhà không phải nơi phục vụ khách |
| 9 | Hosting | Một đích: VPS `v.ninhle.com` | `api.ninhle.com` là bản ghi tunnel đã chết — đã gỡ 26/10 |

**Gỡ bỏ:** Redis/BullMQ, Stripe/PayPal/Lemon Squeezy, face-replace, `src/engine/renderEngine.ts`,
Remotion + `@remotion/player`, `backend/src/lib/drawtext.ts`, tier 3 và tier 4 prompt.

---

## 2. Luồng tạo video — ba đường vào

Điểm khác biệt của Viprosell không nằm ở hiệu ứng, mà ở chỗ **video trông như thật vì nó là thật**.
Ba đường vào, xếp theo mức trung thực giảm dần:

### 2.1 Ảnh sản phẩm (bắt buộc, tối thiểu 3)
Người bán tải lên ảnh thật. Tầng đạo diễn **nhìn được ảnh** (đã triển khai 27/10) nên mô tả
đúng màu, chất liệu, bao bì thay vì đoán từ tên file.

### 2.2 Video tự quay theo gợi ý — *tính năng trọng tâm của V3*

Trước khi quay, hệ thống sinh **danh sách cảnh cần quay** (shot list) từ chính sản phẩm đó.
Đây là chỗ giải bài toán "góc quay phong phú mà vẫn trung thực": người bán không biết quay gì,
nên tự quay ra video nhàm chán; đưa họ danh sách cụ thể thì chất lượng lên hẳn mà không cần AI dựng cảnh giả.

Mỗi mục trong shot list gồm: góc máy, khoảng cách, động tác, thời lượng, và câu lời thoại tương ứng.

```
Gợi ý quay — Son lì 24h (6 cảnh, tổng ~22 giây)
1. Cận cảnh tĩnh      3s  Đặt son trên nền trắng, xoay nhẹ cho thấy vỏ
2. Cầm trên tay       4s  Mở nắp bằng một tay, quay ngang tầm mắt
3. Cận cảnh chất son  4s  Quẹt lên mu bàn tay, ánh sáng cửa sổ
4. Trước / sau        5s  Môi trước khi tô, cắt sang sau khi tô, cùng góc
5. Thử độ bền         4s  Uống nước rồi lau nhẹ, cho thấy son không trôi
6. Cảnh chốt          2s  Cầm son hướng vào ống kính, nền gọn
```

Yêu cầu kỹ thuật với video tải lên: dọc 9:16 ưu tiên, tối đa 60s mỗi clip, tối đa 200MB,
H.264/HEVC. Worker tự `trim` theo thời lượng cảnh, chuẩn hoá về khung đích, bỏ tiếng gốc
nếu cảnh đó có lời thoại TTS. Kiểm tra trước khi nhận: độ phân giải dưới 720p, quá tối,
rung quá mức — báo lại cho người bán quay lại thay vì cho ra video xấu.

### 2.3 Link sản phẩm — chỉ lấy chữ, **không** lấy ảnh

Link Shopee/TikTok Shop được dùng làm ngữ cảnh văn bản (tên, giá, mô tả) nếu lấy được.
**Không tự tải ảnh từ link.** Hai lý do: điều khoản nền tảng, và ảnh trên sàn thường có
watermark của người bán khác. UI phải nói rõ điều này — hiện FAQ đã sửa đúng (26/10).

---

## 3. Bộ render

- **Template theo mã** (10 cái, chia nhóm mỹ phẩm / thời trang / gia dụng): mỗi template là
  một hàm nhận scene graph, trả về danh sách lớp (nền, chuyển động, chữ, huy hiệu giá, CTA).
  Đây là nơi tạo khác biệt thị giác, không phải chỗ cho LLM.
- **Ảnh tĩnh** dùng `zoompan` (Ken Burns). **Video quay thật** dùng `trim` + `scale` + `crop`
  theo vùng an toàn, không zoom thêm.
- **Phụ đề ASS** (đã triển khai): tự xuống dòng, giữ `%` và dấu nháy, viền đọc được trên nền sáng.
- **`platform_presets`**: kích thước, fps, bitrate, vùng an toàn từng nền tảng. Chữ không đè
  giao diện TikTok/Reels — đây là lý do video "thân thiện với nền tảng".
- **Chuẩn âm lượng −14 LUFS** (`loudnorm`) + nhạc tự hạ dưới giọng (ducking).
- **`qa_report` tự động** trước khi giao: chữ vượt vùng an toàn, ảnh dưới ngưỡng phân giải,
  lệch thời lượng, âm lượng bất thường. Kèm 3 khung hình do hệ thống tự chụp để người bán xem trước.

---

## 4. Giọng đọc — VieNeu-TTS trên CPU

### Chốt
- **Model:** VieNeu-TTS **v3 Turbo**, nền NeuTTS-Air (**Apache 2.0** — dùng thương mại được).
- **KHÔNG dùng bản Nano** dù nhanh hơn: Nano phát hành theo *"NeuTTS Open License 1.0"*,
  chưa đọc được điều khoản. Chỉ xem xét lại sau khi luật sư xem giấy phép đó.
- **KHÔNG dùng VieNeu v4:** bản này đóng nguồn, chỉ qua API trả phí — mâu thuẫn với lý do chọn.
- Chạy trên worker máy cá nhân qua **endpoint tương thích OpenAI** `POST /v1/audio/speech`,
  nên lớp provider trong backend không cần biết đó là model gì.

### Hiệu năng (số của chính dự án, đo trên i5 gen 12, 6 luồng — chưa kiểm chứng độc lập)
| Cấu hình | RTF | Giọng 25 giây mất |
|---|---|---|
| Turbo fp32 | 0,55–0,62 | ~15 giây |
| Turbo int8 | 0,35–0,37 | ~9 giây |

int8 cần CPU có VNNI (AVX-512 VNNI / AVX-VNNI). **Máy không có VNNI thì phải dùng fp32** —
tài liệu dự án cảnh báo int8 trên CPU cũ cho ra tiếng méo. Worker phải tự dò và chọn, không
để người vận hành đoán.

### Bắt buộc
- **Cache theo hash** của `(văn bản, giọng, model, phiên bản)`. Khách sửa chữ rồi render lại
  là việc thường xuyên; không cache thì tốn CPU lặp lại cho cùng một câu.
- Giọng đọc hỏng **không** làm hỏng cả video: render tiếp bản không lời, đánh dấu trong `qa_report`.
- **Âm thanh sinh ra có đóng dấu chìm Perth mặc định** và không có cách tắt chính thức.
  Dấu này không nghe thấy nên không ảnh hưởng quảng cáo, nhưng phải ghi vào điều khoản dịch vụ.

---

## 5. Gói cao cấp — cảnh AI motion qua API

Giữ **một** tuỳ chọn trả phí: chèn 1–2 cảnh chuyển động do API sinh, xen giữa các cảnh thật.
Không làm video AI toàn phần — vừa đắt vừa mất tính trung thực vốn là điểm bán của sản phẩm.

Giá API biến động mạnh và các trang tổng hợp mâu thuẫn nhau, nên **code phải đọc đơn giá từ
`system_settings`, không viết cứng**. Tham chiếu tháng 8–10/2026: Veo 3.1 Lite ~0,03–0,05 USD/giây,
Veo 3.1 Fast ~0,10–0,12, Kling 3.0 ~0,08, Seedance tính theo token nên khó so.

Chốt: **Veo 3.1 Lite** làm mặc định, lớp provider tách riêng để đổi nhà cung cấp mà không sửa luồng.
Bán theo **chi phí thực + 50%**, tính riêng ngoài credit, chỉ mở khi đơn giá ổn định.

Ví dụ ở 0,05 USD/giây, tỷ giá 26.100đ: cảnh 5 giây = 6.525đ vốn → bán ~9.800đ. Con số này
lớn gấp nhiều lần một credit video thường, nên **không được** gộp vào gói.

---

## 6. Mô hình kinh tế — tính lại

Giả định: video 25 giây, 1 preset, lời đọc ~450 ký tự, mỗi lô sinh 10 biến thể nên lần gọi
đạo diễn #1 (có nhìn ảnh) chia đều cho 10. Tỷ giá 26.100đ/USD. File ra ~12,5 MB (H.264 4 Mbps).

| Khoản | V2 (stack rẻ) | **V3** | Ghi chú |
|---|---|---|---|
| LLM 2 lần gọi, có nhìn ảnh | ~10đ | **~30đ** | Haiku 5.5. Thêm ảnh tốn ~258 token/ảnh nên đắt hơn V2 một chút |
| Giọng đọc | 85đ | **0đ** | VieNeu-TTS chạy CPU máy nhà |
| Render | ~2đ | **0đ** | CPU máy cá nhân |
| Lưu trữ + tải về | ~3đ | **~5đ** | R2, 30 ngày, không phí egress |
| **Tổng** | ~100đ | **~35đ** | |
| **× 2 phần lãng phí** | ~200đ | **~70đ** | Tạo lại, biến thể bị bỏ, bản xem trước |

Nếu buộc phải dùng Gemini 2.5 Flash thay Haiku, phần LLM lên ~110đ → tổng ~115đ, ×2 là ~230đ.
Vẫn chấp nhận được, nhưng đó là lý do quyết định #6 chọn Haiku.

**Chi phí cố định** ~2,5 triệu đồng/tháng (Supabase Pro, VPS, dịch vụ phụ).
Với biên ~96% trên gói Seller, hoà vốn ở **~26 gói 99k mỗi tháng**.

> Mọi con số trên là **ước tính**, trừ 13,8 giây render CPU đã đo thật.
> S1-7 phải thay bằng số đo sau 100 video chạy thật rồi mới chốt bảng giá.

---

## 7. Bảng giá & cấu trúc gói

Ba bậc trả tiền như V2, cộng một bậc dùng thử. **Gói nạp một lần, không thuê bao tự gia hạn** —
khách Việt chủ yếu chuyển khoản, và bỏ thuê bao là bỏ luôn mảng code xử lý huỷ/hoàn/gia hạn hỏng.

| Mã | Tên | Giá | Credit | Đơn giá | Biên |
|---|---|---|---|---|---|
| `trial` | Dùng thử | 0đ | 5 | — | — |
| `seller` | Seller | 99.000đ | 60 | 1.650đ | ~96% |
| `pro` | Pro | 249.000đ | 200 | 1.245đ | ~94% |
| `agency` | Agency | 599.000đ | 600 | 998đ | ~93% |

**Quy ước credit:** 1 credit = 1 video 15–30s, 1 preset. Thêm preset cùng biến thể = 0,5 credit.
Tạo lại kế hoạch (không render) = 0, tối đa 3 lần mỗi dự án. Credit hạn 12 tháng.
Cảnh AI motion bán riêng theo mục 5.

**Khác biệt giữa các bậc chỉ là số credit và thời gian lưu trữ.** Không bịa tính năng để
phân bậc — đó chính là lỗi đã phải gỡ ngày 26/10 (bán "Không watermark" trong khi hệ thống
chưa hề có watermark, bán "API access" khi chưa mở API).

### Việc phải làm để đồng bộ
CSDL đang là `free / pro / business / premium` với giá 0 / 130k / 250k / 520k — **không khớp bảng trên**.
Cần migration đổi mã và giá. Lưu ý `pro` tồn tại ở cả hai bảng nhưng khác giá và khác số credit,
nên migration phải ghi rõ từng dòng, không `UPDATE` theo mã.

### Bốn quy tắc giữ biên (code phải cưỡng chế)
1. **Việt Nam chỉ thu qua VietQR.** Cổng quốc tế ~18% trên đơn 99k, ăn hết biên.
2. **Hoa hồng trả bằng tiền mặt** (xem mục 9). Quy tắc này đã được tính lại ngày 27/10:
   trên nền V3 giá vốn một video chỉ ~70đ nên trả tiền vẫn còn biên ~80% ở gói Seller.
   Nó chỉ trở thành vấn đề nếu sau này chuyển sang TTS trả phí hoặc render trên cloud.
3. **TTS phải cache theo hash.** Đã nêu ở mục 4.
4. **Bản xem trước 540p và giới hạn số lần tạo lại miễn phí.** Đây là chỗ phần lãng phí ×2
   có thể thành ×5 nếu không chặn.

---

## 8. Thanh toán VietQR — đối soát bằng mã tham chiếu

### Lỗi hiện tại phải sửa
`backend/src/routes/webhooks.ts` đang cộng credit bằng **suy đoán theo số tiền**:
`>= 520000` → 240 credit, `>= 250000` → 110, `>= 130000` → 50, còn lại `số tiền / 3000`.
Hệ quả: khách chuyển 1.000.000đ vẫn chỉ nhận 240 credit; chuyển 519.000đ thì tụt hẳn một bậc;
và tỷ lệ dự phòng 3.000đ/credit mâu thuẫn với mọi đơn giá trong bảng.

### Luồng đúng
1. Khách bấm mua gói → tạo bản ghi `payments` trạng thái `pending`, sinh **mã tham chiếu duy nhất**
   (ví dụ `VPS7K3M9`), lưu kèm `plan_code` và số tiền mong đợi.
2. Hiện mã QR VietQR với **nội dung chuyển khoản chứa đúng mã đó**, kèm nút sao chép và
   cảnh báo "giữ nguyên nội dung chuyển khoản".
3. Webhook SePay → chống trùng bằng `idempotency_keys` theo mã giao dịch ngân hàng
   (bảng đã có migration `20260821000001`).
4. **Tìm mã tham chiếu trong nội dung chuyển khoản** → tra ra `payments` đang `pending` →
   cộng đúng số credit của gói đó. Không bao giờ đoán theo số tiền.
5. Số tiền lệch: thiếu > 2% thì để `pending` và báo người vận hành; thừa thì cộng gói đã khớp,
   phần dư quy ra credit theo đơn giá của chính gói đó, ghi vào ghi chú.
6. Không tìm thấy mã tham chiếu → **không cộng credit tự động**, chuyển sang hàng chờ xử lý tay.
   Thà chậm còn hơn cộng sai.
7. Cộng credit và ghi `credit_ledger` trong **một transaction** với việc cập nhật `payments`.

### Giao diện
Trang thanh toán hiện mã QR, số tài khoản, tên thụ hưởng, số tiền, nội dung chuyển khoản;
tự hỏi trạng thái mỗi 5 giây trong 15 phút rồi chuyển sang "chúng tôi sẽ báo khi nhận được".
Không bắt khách ngồi đợi vô hạn.

---

## 9. Affiliate

### Nguyên tắc
Hoa hồng **trả bằng tiền mặt (VND)**.

Bản V2 từng kết luận phải trả bằng credit vì "cộng với giá vốn thì lỗ". Kết luận đó đúng với
cấu trúc chi phí V2 (giọng đọc 85–590đ, render thuê ngoài → 200–1.400đ mỗi video), nhưng
**không còn đúng với V3**: giọng đọc và render đều chạy trên máy cá nhân nên giá vốn một
video còn ~70đ. Tính lại trên gói Seller:

| Khoản | Số tiền |
|---|---|
| Doanh thu | 99.000đ |
| 60 credit + 6 credit thưởng người mua, × 70đ | −4.620đ |
| Hoa hồng tiền mặt 15% | −14.850đ |
| Phí cổng (VietQR) | ~0đ |
| **Còn lại** | **79.530đ — biên ~80%** |

**Ngưỡng đảo chiều:** nếu giá vốn mỗi video vượt khoảng **1.275đ** thì gói Seller hết lãi
(66 credit × 1.275đ + 14.850đ hoa hồng = 99.000đ doanh thu)
khi có hoa hồng tiền mặt. Chuyển sang TTS trả phí hoặc render cloud là chạm ngưỡng đó, nên
phải tính lại trước khi đổi.

### Thiết kế
| Thành phần | Chốt |
|---|---|
| Quy gán | Chạm đầu tiên (first-touch), cookie 30 ngày, ghi cố định vào hồ sơ người dùng lúc đăng ký |
| Thưởng người giới thiệu | 10% tiền đơn (Bạc) hoặc 15% (Vàng, từ 2.500.000đ hoa hồng tích luỹ). Tính trên **giá niêm yết** của gói, không trên số tiền thực nhận — khách gõ nhầm thêm số 0 thì hoa hồng không phóng theo |
| Thưởng người mua | +10% credit của đơn đầu tiên (logic `* 1.1` hiện có — giữ, nhưng chỉ đơn đầu) |
| Trạng thái | `pending` → `approved` (sau 7 ngày, chống hoàn tiền) → `paid` (đã cộng credit) hoặc `rejected` |
| Chống lạm dụng | Cấm tự giới thiệu (cùng người dùng / cùng thiết bị / cùng số tài khoản nhận tiền); chỉ tính từ đơn trả tiền thật; trần 50 lượt giới thiệu mỗi tháng cho mỗi tài khoản |
| Rút tiền | Ngưỡng tối thiểu 125.000đ. **Chưa có luồng yêu cầu rút** — đây là khoảng trống lớn nhất của tính năng |
| Bảng | Dùng lại `affiliate_events`; `meta.unit` ghi rõ đơn vị để không đọc nhầm |

**Đã có sẵn và đã kiểm chứng (27/10):** chặn tự giới thiệu, chỉ nhập mã một lần, hạng
Bạc/Vàng, tiến trình lên hạng, thưởng +10% credit cho người mua, lịch sử chuyển đổi.

**Còn thiếu so với mặt bằng thị trường** (tham chiếu trang affiliate của AiDancing): nút yêu
cầu rút tiền và kênh nhận yêu cầu. Hiện có ngưỡng và có hiển thị "Sẵn sàng rút" nhưng đối tác
không có cách nào gửi yêu cầu — hoa hồng cứ tích lại mà không rút được.

### Giao diện Affiliate (đã có khung, cần hoàn thiện)
Link giới thiệu + nút sao chép; bảng số liệu (lượt nhấp, đăng ký, đơn trả tiền, credit đã nhận);
lịch sử từng sự kiện kèm trạng thái; giải thích rõ "thưởng bằng credit" ngay trên trang.

---

## 10. Lưu trữ & xoá theo chu kỳ

### Vì sao không phục vụ video thẳng từ máy cá nhân
Máy nhà có thể tắt, đường lên nhà dân yếu, và mở cổng vào máy cá nhân là đúng thứ mà
quyết định #3 tránh. Máy cá nhân **render**, rồi **đẩy lên R2**; R2 phục vụ khách.

### Phép tính
Video 25s, 1080×1920, 4 Mbps ≈ **12,5 MB**.

| Lượng | Dung lượng thường trú (giữ 30 ngày) | Chi phí R2 |
|---|---|---|
| 100 video/tháng | 1,25 GB | ~500đ/tháng |
| 1.000 video/tháng | 12,5 GB | ~5.000đ/tháng |
| 10.000 video/tháng | 125 GB | ~50.000đ/tháng |

R2 **không tính phí tải về**, nên chi phí gần như chỉ là lưu trữ. Supabase Storage tính
0,09 USD/GB tải về — với 1.000 video tải mỗi tháng là ~29.000đ, đắt hơn R2 nhiều lần khi lớn.

### Chính sách giữ file
| Bậc | Giữ | Báo trước khi xoá |
|---|---|---|
| Dùng thử | 7 ngày | 2 ngày |
| Seller / Pro | 30 ngày | 3 ngày |
| Agency | 90 ngày | 7 ngày |

- Tác vụ dọn chạy hằng ngày, xoá file R2 và đánh dấu `renders.deleted_at`, **giữ lại bản ghi**
  để khách còn thấy lịch sử và số liệu.
- Khách tải về bao nhiêu lần tuỳ ý trong thời gian giữ; có nút tải cả lô dạng ZIP.
- Khách tự xoá được video bất kỳ lúc nào (nút xoá trong dashboard) — xoá là xoá thật trên R2.
- **Trên máy worker:** file tạm chỉ giữ trong lúc render + 24 giờ để thử lại, rồi xoá.
  Không để ổ máy cá nhân đầy dần — đây là lỗi vận hành hay gặp nhất của mô hình render tại nhà.

---

## 11. Frontend & giao diện

### Nguyên tắc nội dung
**Mọi câu trên giao diện phải ứng với một tính năng đã chạy.** Ngày 26/10 đã phải gỡ sáu
tuyên bố sai (giọng đọc chưa có, render cloud đang khoá, "Không watermark" khi chưa có
watermark, "API access", "Dự án không giới hạn", chữ "credits/tháng" khi không có gia hạn).
Quy tắc: thêm một câu quảng cáo thì phải chỉ ra được dòng code thực hiện nó.

### Trang cần hoàn thiện

**Dashboard** — danh sách dự án kèm ảnh đại diện lấy từ khung hình do hệ thống chụp (hiện đang
để trống), trạng thái, thời lượng, số credit còn lại, thời hạn xoá của từng video.
Trạng thái rỗng phải hướng dẫn việc tiếp theo, không để trắng.

**Trang dự án** — trình phát video ngay trên trình duyệt: thẻ `<video>` HTML5, khung 9:16
co theo màn hình, có ảnh poster, phụ đề đã cháy sẵn nên không cần track riêng.
Nút tải về dùng URL ký sẵn của R2. Có nút tạo lại (đếm số lần đã dùng trong 3 lần miễn phí).

**Gợi ý quay (mới)** — hiện shot list ở mục 2.2 thành danh sách việc: mỗi cảnh một thẻ,
có nút tải video lên cho đúng cảnh đó, đánh dấu cảnh đã có. Đây là màn hình quan trọng nhất
của V3 vì nó quyết định chất lượng đầu vào.

**Tài khoản** — số credit, lịch sử giao dịch, gói đang dùng, link affiliate, hạn credit.

**Thanh toán** — theo mục 8: QR, nội dung chuyển khoản sao chép được, tự hỏi trạng thái.

### Media còn thiếu phải bổ sung
Ảnh đại diện video (chụp từ khung hình thật), trạng thái rỗng cho dashboard và danh sách dự án,
minh hoạ cho từng bước của luồng tạo video, ảnh mẫu cho từng template trong thư viện template.
Không dùng ảnh sản phẩm bịa — đã thống nhất từ 26/10: khung minh hoạ dựng bằng đồ hoạ,
vì bịa ảnh sản phẩm là quảng cáo sai.

---

## 12. Thông điệp landing — danh sách chuẩn

Dùng đúng những câu này, không thêm bớt. Mỗi câu kèm thứ chứng minh được.

| Thông điệp | Chứng minh |
|---|---|
| "Tạo video bán hàng từ ảnh sản phẩm thật của bạn" | Bắt buộc tải ≥3 ảnh; AI nhìn được ảnh |
| "Hệ thống chỉ cho bạn quay những cảnh nào" | Shot list ở mục 2.2 |
| "Có giọng đọc tiếng Việt" | VieNeu-TTS — **chỉ bật câu này sau khi S3-1 chạy thật** |
| "Phụ đề cháy sẵn, đúng dấu tiếng Việt" | Phụ đề ASS, đã kiểm chứng bằng render thật 27/10 |
| "Video đúng khung 9:16, chữ không đè giao diện TikTok" | `platform_presets` + kiểm vùng an toàn |
| "Không cần cài gì trên máy" | Khách chỉ dùng web; worker là hạ tầng của Viprosell |
| "Thanh toán bằng chuyển khoản VietQR" | SePay |
| "Thưởng giới thiệu bằng credit" | Mục 9 — **sửa cùng lúc với code** |

**Cấm dùng:** "local-first" (gây hiểu nhầm là chạy trên máy khách), "tự động lấy ảnh từ link"
(không có), "render tại máy bạn" (render ở hạ tầng Viprosell), mọi câu về watermark cho tới
khi có watermark thật.

---

## 13. Dữ liệu & API

### Bảng thêm / sửa
| Bảng | Việc |
|---|---|
| `render_jobs` | **Mới.** Hàng đợi: `status`, `lease_until`, `attempts`, `worker_id`. Thay Redis |
| `platform_presets` | **Mới.** Kích thước, fps, bitrate, vùng an toàn từng nền tảng |
| `shot_lists` | **Mới.** Gợi ý quay của mục 2.2, gắn với dự án |
| `tts_cache` | **Mới.** Khoá là hash `(văn bản, giọng, model, phiên bản)` |
| `credit_ledger` | **Mới.** Mọi thay đổi credit đều có dòng — cộng từ thanh toán, trừ khi render, thưởng affiliate |
| `plans` | Đổi sang `trial/seller/pro/agency` theo mục 7 |
| `payments` | Thêm `ref_code` duy nhất + `plan_code` + số tiền mong đợi |
| `affiliate_events` | `commission_amount` → `commission_credits` |
| `renders` | Thêm `deleted_at`, `expires_at`, `qa_report`, `preview_url` |

`supabase/migrations` là nguồn sự thật duy nhất. `db/*.sql` là bản lưu trữ, đã gắn cảnh báo 26/10.

### API V2 (giữ nguyên tinh thần V2, tối giản)
```
POST   /v1/projects                 tạo dự án
POST   /v1/projects/:id/assets      tải ảnh / video quay
GET    /v1/projects/:id/shotlist    gợi ý quay
POST   /v1/projects/:id/plan        2 lần gọi LLM -> biến thể
PATCH  /v1/variants/:id             sửa chữ, đổi thứ tự cảnh, đổi template
POST   /v1/variants/:id/render      giữ credit -> tạo job render
GET    /v1/renders/:id              trạng thái + qa_report
DELETE /v1/renders/:id              khách tự xoá
POST   /v1/billing/checkout/sepay   sinh ref_code + QR
POST   /v1/webhooks/sepay           đối soát theo ref_code
GET    /v1/worker/claim             worker kéo việc (gọi ra, không mở cổng vào)
POST   /v1/worker/jobs/:id/result   worker trả kết quả
```

---

## 14. Lộ trình

| Sprint | Nội dung | Xong khi |
|---|---|---|
| **S1** | Bật worker trên hạ tầng thật; hàng đợi `render_jobs` + `claim_job`; gỡ Redis/BullMQ, Remotion, `renderEngine.ts`, `drawtext.ts` | Một video đi hết luồng và khách tải về được |
| **S2** | Thanh toán theo `ref_code`; `credit_ledger`; migration bảng giá `trial/seller/pro/agency`; affiliate trả bằng credit | Chuyển khoản 99k ra đúng 60 credit, có dòng sổ |
| **S3** | VieNeu-TTS (dò VNNI, cache hash, hỏng thì bỏ qua); −14 LUFS + ducking | Video có giọng đọc, render lại cùng câu không tốn CPU lần hai |
| **S4** | Shot list + tải video quay; 10 template theo mã; `platform_presets` + `qa_report` | Người bán quay theo gợi ý, video ra đúng vùng an toàn |
| **S5** | R2 + chính sách giữ file + tác vụ dọn; dashboard, trình phát, tải về, trang tài khoản | Ổ đĩa không đầy dần; khách xem và tải trên web |
| **S6** | Provider Anthropic Haiku 5.5; gộp pipeline 4 lần gọi còn 2; bản xem trước 540p + giới hạn tạo lại | Chi phí LLM giảm ~75%, đo được |
| **Sau** | Cảnh AI motion qua Veo 3.1 Lite (mục 5) | Chỉ mở khi đơn giá API ổn định |

Đã làm xong trước S1 (26–27/10): phụ đề ASS, render CPU mặc định, tầng đạo diễn nhìn được ảnh,
sửa enum `render_mode`, bịt lỗ lách khoá admin, gỡ sáu tuyên bố sai khỏi bảng giá.

---

## 15. Rủi ro & việc chưa biết

| Việc | Tình trạng | Cần làm |
|---|---|---|
| Giấy phép **weights** của VieNeu-TTS | Repo ghi Apache-2.0 nhưng **không ghi giấy phép cho weights** | Đọc model card trên Hugging Face trước khi phát hành |
| Giấy phép **NeuCodec** | Không tìm thấy | Kiểm tra riêng; đây là thành phần bắt buộc của model |
| "NeuTTS Open License 1.0" (bản Nano) | Chưa đọc được điều khoản | Chỉ dùng Nano sau khi đọc. Mặc định dùng Turbo |
| Dấu chìm Perth trong âm thanh | Có mặc định, không có cách tắt chính thức | Ghi vào điều khoản dịch vụ |
| CPU máy worker có VNNI không | Chưa kiểm tra | Worker tự dò; không có VNNI thì fp32 (chậm hơn ~1,7 lần) |
| Số đo render/TTS trên máy thật | Mới có số của nhà phát hành | S1-7: đo 100 video rồi mới chốt giá |
| Giá API video | Các nguồn mâu thuẫn, 0,03–0,40 USD/giây | Đọc đơn giá từ `system_settings`, không viết cứng |
| Lấy dữ liệu từ link sàn | Có thể vi phạm điều khoản nền tảng | Chỉ lấy chữ, không lấy ảnh; cần luật sư xem trước khi mở rộng |
| Nhãn AIGC của nền tảng | Quy định thay đổi liên tục | Kiểm tra trang chính sách hiện hành khi làm S4 |

---

## 16. Nguồn

- VieNeu-TTS (giấy phép repo, số đo CPU, endpoint tương thích OpenAI): https://github.com/pnnbao97/VieNeu-TTS
- NeuTTS Air (giấy phép model, dấu chìm Perth): https://github.com/neuphonic/neutts-air
- Giá API video tháng 8–10/2026 (các nguồn mâu thuẫn, chỉ dùng làm khoảng tham chiếu):
  https://invideo.io/blog/ai-video-model-pricing/ · https://www.cometapi.com/ai-video-api-pricing/
- Số đo render 13,8 giây CPU và khung chi phí gốc: `docs/Viprosell_SPEC_V2_2026-10-19.md`

Bằng chứng kiểm chứng trong kho mã: `backend/tests/ass-subtitle.test.ts` (11 test),
`backend/tests/render-mode-enum.test.ts`, `backend/tests/db-tables.test.ts`.
