# Viprosell — Gói dịch vụ video: công nghệ nào, giá bao nhiêu

Ngày: 2026-11-01 · Trạng thái: đã chốt, chờ các phép thử ở mục cuối

> **Về tệp này.** Nội dung ban đầu nằm trong một tài liệu trên claude.ai và đã bị xoá.
> Bản này **phục hồi từ bản ghi phiên làm việc**, không phải viết lại từ ký ức — số liệu
> giữ đúng nguyên văn, chỉ sửa lỗi chính tả. Đặt trong repo để không mất lần nữa.
>
> Đọc kèm: `docs/spec-kvm4-2026-10-31.md` (kiến trúc), `backend/prototypes/2-5d/README.md`
> (số đo thật của bản mẫu 2,5D).

**Video AI chuyển động thật không vừa với mô hình giá của Viprosell, và không phải về kỹ thuật mà về số học.** Mô hình rẻ nhất thị trường (Wan 2.5, $0,05 mỗi giây) cho ra video 30 giây tốn **39.000₫** — gấp **9,1 lần** cả giá bán một video ở gói Starter (4.300₫). Loại đắt nhất gấp 43 lần.

Nhưng **đúng cái video bán áo mô tả trong yêu cầu** — ảnh chụp có chuyển động, đổi màu áo, nhạc nền, lời thoại, CTA — **làm được với khoảng 540–750₫**, tức giữ nguyên biên lãi 83–87%. Đó là một đường thứ ba mà thị trường ít nói tới, và nó là lợi thế thật nếu làm sớm.

---

## Niche: số liệu vừa biến một lựa chọn marketing thành một lựa chọn bắt buộc

Khảo sát thị trường đã chọn: **video chốt đơn từ hàng thật của shop, cho shop thời trang trên TikTok Shop.** Số liệu giá vốn **không sửa định vị đó** — nó làm định vị đó chặt hơn nhiều.

### "Hàng thật" vừa là lời hứa, vừa là phép tính

| | Giá vốn một video 30 giây |
| --- | --- |
| Clip thật shop tự quay | **332₫** |
| Ảnh thật + chuyển động 2,5D | **538–746₫** |
| Chuyển động do AI sinh ra | **39.000₫ trở lên** |

Trước đây "không dùng hàng AI giả" là một lời hứa về niềm tin. Bây giờ nó cũng là **lý do sống sót**: hàng thật rẻ hơn **118 lần**. Hai thứ thường ngược nhau — điều đúng về đạo đức và điều đúng về tiền — ở đây trùng khớp. Đó là một vị trí hiếm và nên khoá chặt.

Câu nói với khách không đổi, nhưng giờ có chân đứng: *"Quay hàng 1 phút — nhận 10 video chốt đơn."*

### Một câu hỏi về giá của AiDancing mà chưa trả lời được

AiDancing bán mẫu *"Bán hàng – Thời trang"* (ảnh người + ảnh sản phẩm → video 15–25 giây) ở **1,8 credit ≈ 4.200–4.700₫**. Quy ra khoảng **$0,007–$0,011 mỗi giây video**.

Mức rẻ nhất tìm được trên thị trường quốc tế là **$0,05 mỗi giây** — **đắt gấp 5–7 lần giá bán của họ**. Ba khả năng, và **chưa xác minh được cái nào đúng**:

1. Họ mua được giá nội địa Trung Quốc, thấp hơn nhiều giá API phương Tây.
2. Họ đang bù lỗ để lấy người dùng.
3. Đầu ra ngắn hơn, độ phân giải thấp hơn, hoặc số khung thấp hơn nhiều so với mức mà giá $0,05 mua được.

**Điều này quan trọng vì:** nếu là (1), thì cạnh tranh trực diện ở tính năng sinh video là cuộc chơi Viprosell không thể thắng bằng giá. Nếu là (2) thì họ sẽ phải tăng giá. Nếu là (3) thì chất lượng thật thấp hơn vẻ bề ngoài.

**Phép thử, và nó rẻ:** nạp 52.000₫, tạo 3 video bằng mẫu đó với ảnh sản phẩm thật, rồi xem độ phân giải, số khung, độ dài thật và chất lượng chuyển động. Một buổi chiều trả lời được câu này, và nó quyết định có nên làm gói 3 hay không.

### Đừng so với Creatify và Arcads nữa

Khảo sát thị trường đã nói đúng điều này: **"rẻ hơn 12–67 lần" là thông điệp cho nhà đầu tư, không phải cho chủ shop.** Chủ shop Việt so Viprosell với ba thứ: LayerProof cùng giá, CapCut miễn phí, và gửi hàng cho KOC.

Với cả ba, câu trả lời đều là gói số 0: **"video nào ra đơn"**. CapCut không trả lời được, LayerProof không trả lời được, và KOC thì trả lời được nhưng ăn hoa hồng mãi mãi.

---

## Bốn đường tạo chuyển động, và giá của chúng

Cột cuối mới là cột quyết định: giá vốn so với **4.300₫** — số tiền khách Starter trả cho một video 30 giây.

| Đường | Cách làm | Giá vốn / video 30 giây | So với giá bán |
| --- | --- | --- | --- |
| **1. Ken Burns** (đang làm) | `zoompan` của ffmpeg | **538₫** | biên lãi **87%** |
| **2. Lối giữa 2,5D** | Bản đồ độ sâu + dựng thị sai, đổi màu bằng mặt nạ | **538–746₫** | biên lãi **83–87%** |
| 3. AI i2v — Wan 2.5 | fal.ai, $0,05/giây | 39.000₫ | **gấp 9,1 lần** |
| 3. AI i2v — Kling 2.5 Turbo | $0,07/giây | 54.600₫ | **gấp 12,7 lần** |
| 3. AI i2v — Wan 2.1 Replicate 480p | $0,09/giây | 70.200₫ | **gấp 16,3 lần** |
| 3. AI i2v — Seedance 2 | ~$0,24/giây | 187.200₫ | **gấp 43,5 lần** |
| 4. Tự chạy mô hình trên GPU thuê | Wan 2.2, Apache 2.0 | **chưa đo** | xem bên dưới |

### Đường 3 không phải là lựa chọn

Để bán video AI i2v mà có biên lãi 60%, giá mỗi video phải lên:

| Mô hình | Phải bán từ | Hiện bán |
| --- | --- | --- |
| Wan 2.5 | 97.500₫ | 4.300₫ |
| Kling 2.5 Turbo | 136.500₫ | 4.300₫ |
| Seedance 2 | 468.000₫ | 4.300₫ |

Tức là gói Starter 129.000₫ sẽ chỉ còn **1 video** thay vì 30. Đó không phải việc điều chỉnh bảng giá — đó là một sản phẩm khác, bán cho khách khác.

### Vì sao không tự chạy mô hình cho rẻ (đường 4)

Wan 2.2 mang giấy phép **Apache 2.0** và chạy được từ ~12 GB VRAM. Nghe như lối thoát, nhưng ba điều chặn lại:

1. **KVM 4 không có GPU.** Phải thuê máy GPU riêng, và một máy GPU thuê trọn tháng chỉ đáng khi chạy gần hết 730 giờ.
2. **Thời gian sinh video dài.** **Chưa đo** — nhưng một clip 5 giây trên GPU hạng phổ thông thường mất vài phút. Video 30 giây cần 6 clip.
3. **Giá thuê GPU không tự động rẻ hơn API.** API đã là giá bán buôn của chính phép tính đó, có tối ưu và gộp tải.

Tự chạy chỉ đáng khi sản lượng đủ lấp đầy một GPU. Ở mức 1.000 video/tháng thì không.

Nguồn giá: [fal.ai](https://fal.ai/pricing), [Replicate — pricing](https://replicate.com/pricing), [so sánh mô hình mở](https://www.thundercompute.com/blog/best-open-source-ai-video-generation-models). Các mức giá trên đọc từ trang tổng hợp ngày 01/11/2026 — **giá loại này đổi nhanh, kiểm lại trước khi quyết.**

---

## Lối giữa: dựng đúng video bán áo ấy bằng gì

Bốn thành phần trong yêu cầu — chuyển động, đổi màu áo, nhạc nền, lời thoại + CTA — **chỉ có hai cái đầu là mới**. Hai cái sau Viprosell đã làm được.

### Chuyển động 2,5D thay cho Ken Burns

| | Ken Burns (đang làm) | Dựng thị sai 2,5D |
| --- | --- | --- |
| Cách | Phóng và rê cả tấm ảnh phẳng | Dựng bản đồ độ sâu, cho gần và xa dịch khác tốc độ |
| Mắt nhìn ra | Hai lớp dính nhau — "ảnh đang trượt" | Áo tách khỏi nền — "máy đang đi quanh" |
| Chi phí | 0₫ | **0₫ tiền mặt** (chạy CPU trên chính KVM 4) — nhưng xem mục đo thật bên dưới |

Quy trình: **Depth Anything V2 Small** (Apache 2.0) sinh bản đồ độ sâu, rồi một hàm nắn ảnh theo bản đồ đó trong khi dịch một "máy quay ảo". Kết xuất vẫn bằng ffmpeg.

Đây là khoản nâng chất lượng **lớn nhất trên mỗi đồng chi ra** trong cả danh sách này: nó đổi hẳn cảm giác của video mà không thêm một đồng giá vốn nào.

### Đổi màu áo

Làm đúng cách là **giữ nguyên độ sáng, chỉ thay sắc độ** (không gian màu LAB: giữ kênh L, thay kênh a và b). Nếp gấp, bóng đổ và vân vải giữ nguyên, nên nhìn vẫn là cái áo đó chứ không phải một mảng màu dán đè.

| Bước | Công cụ | Chi phí |
| --- | --- | --- |
| Tách vùng áo | SAM 2 (Apache 2.0) | ~52₫/ảnh trên GPU T4 thuê, hoặc 0₫ trên CPU (chậm hơn) |
| Đổi màu | Phép tính LAB, viết tay | 0₫ |

> **Cảnh báo về chính tấm ảnh áo đen đã gửi.** Áo **đen** là trường hợp khó nhất: màu đen có sắc độ gần bằng không và độ sáng rất thấp, nên không còn tín hiệu để nhuộm lại — đổi đen sang đỏ sẽ ra một vệt đỏ phẳng, lộ ngay. **Đổi màu chỉ nên mở cho áo màu sáng hoặc trung tính.** Với áo tối, cách đúng là bắt khách tải lên ảnh của từng màu — shop thường đã có sẵn.

### Một điều về các video TikTok được dẫn

Link `@outerity.sg` bị TikTok chặn bằng CAPTCHA và tôi không giải CAPTCHA. Chỉ đọc được tiêu đề: *"Áo form đã ha #outerity #xuhuong"*.

Nhưng điều này đáng nói dù không xem được: **phần lớn video thời trang triệu view không phải video AI.** Đó là người thật mặc áo thật, quay bằng điện thoại, cắt nhanh theo nhạc. Chuyển động ở đó là người cử động, không phải máy sinh ra.

Điều đó **củng cố đường clip** đã chọn trong khảo sát thị trường, chứ không phải đường ảnh. Ảnh tĩnh dù nắn khéo tới đâu cũng không thay được một người xoay người khoe dáng áo. Lối giữa 2,5D làm đường ảnh **đỡ rẻ tiền**, không làm nó thắng đường clip.

### Đã dựng thử thật trên chính tấm ảnh áo đen — 01/11/2026

Không để đây là lời hứa. Đã chạy thật, và **một khẳng định ở bản trước là sai**.

| Đo được | Kết quả |
| --- | --- |
| Sinh bản đồ độ sâu (Depth Anything V2 Small, ONNX, CPU 4 luồng) | **0,25 giây mỗi ảnh** |
| Chất lượng độ sâu trên áo đen / nền tối | **Sạch** — tách đúng người, cổ áo và tay áo có khối |
| Thị sai có đọc ra không | **Có** — áo dịch rõ so với vân tường |
| Dựng bằng numpy | 333 ms/khung → **300 giây** cho video 30 giây |
| Dựng thuần bằng ffmpeg (`geq` + `displace`) | **34 ms/khung → 31 giây** cho video 30 giây |

**Sửa lại khẳng định cũ:** bản trước viết "cộng 0₫". **Không đúng.** Tiền mặt thì vẫn 0₫ vì VPS trả phẳng, nhưng nó **tăng khoảng gấp đôi thời gian CPU mỗi video** (31 giây so với ~23 giây của `zoompan`). Điều đó **cắt đôi công suất render** của KVM 4, nên phải vào lại phép tính công suất trong spec. Với mức ~1.000 video/tháng thì vẫn thừa rất xa.

### Bốn điều hỏng phát hiện khi dựng

1. **onnxruntime vỡ (segfault) khi đặt 32 luồng.** Chạy tốt ở 1, 4 và 8. Phải chặn trần luồng — KVM 4 chỉ có 4 nhân nên vô tình an toàn, nhưng máy dựng ở nhà 32 nhân thì chết.
2. **Phóng hình nuốt mất thị sai.** Giữ phóng Ken Burns 1,05 làm mép khung dịch ~46 px, trong khi thị sai chỉ ±15 px — kết quả nhìn ra y hệt Ken Burns cũ. **Phải bỏ phóng hoặc hạ rất nhỏ** khi bật 2,5D.
3. **Biên độ lớn làm rách mép.** Ở ±70 px, cổ áo bị kéo giãn thấy rõ — vì không có thông tin phía sau chủ thể. **Cần dò ngưỡng an toàn**, ước chừng ±20–30 px.
4. **Nền phẳng thì lợi ích nhỏ.** Thị sai lộ ra nhờ nền có vân để so. Ảnh sản phẩm trên nền trắng trơn — rất phổ biến ở shop — **gần như không được gì**. Nên bật 2,5D có điều kiện, không bật đại trà.

**Kết luận của phép thử: đường này dùng được**, với ba điều kiện — dựng bằng ffmpeg chứ không bằng Python, bỏ phóng khi bật, và chỉ bật khi nền có chi tiết.

Chi tiết lệnh ffmpeg và script: `backend/prototypes/2-5d/README.md`.

---

## Ba repo nên dùng — và một cái tuyệt đối không

| # | Repo | Làm gì cho Viprosell | Giấy phép | Chạy ở đâu |
| --- | --- | --- | --- | --- |
| 1 | **Depth Anything V2 — bản Small** | Bản đồ độ sâu cho chuyển động 2,5D | **Apache 2.0** | CPU của KVM 4 |
| 2 | **SAM 2** | Tách vùng áo để đổi màu | **Apache 2.0** | T4 thuê hoặc CPU |
| 3 | **ComfyUI-Recolor / comfyui-garment-recolor** | Bản mẫu phép đổi màu LAB trên mặt nạ vải | cần đọc từng repo | chép thuật toán, không chạy ComfyUI |

Repo số 3 dùng theo kiểu **đọc để học**, không phải cài đặt. ComfyUI là một hệ đồ hoạ nặng không đáng kéo vào một worker; thuật toán LAB bên trong nó chỉ khoảng vài chục dòng.

### Bẫy giấy phép phải biết trước

| Thứ | Giấy phép | Vấn đề với Viprosell |
| --- | --- | --- |
| **DepthFlow** (thư viện dựng thị sai sẵn) | **AGPLv3** hoặc MIT thương mại trả phí | **AGPL là copyleft qua mạng.** Chạy nó trong một dịch vụ khách truy cập qua Internet là **phải mở toàn bộ mã nguồn Viprosell**. Muốn dùng thì phải mua giấy phép MIT của họ |
| **Depth Anything V2 bản Base / Large** | có thể là CC-BY-NC | **Chỉ dùng bản Small.** Lấy nhầm bản lớn là vi phạm |
| **IDM-VTON** (thay đồ) | CC BY-NC-SA 4.0 | **Cấm thương mại.** Đã ghi trong spec |
| **Ken Burns 3D** (Niklaus) | CC-NC | Cấm thương mại |
| **HunyuanVideo** | Giấy phép cộng đồng Tencent | Loại trừ EU, Anh, Hàn Quốc |
| **LTX-2 / 2.3** | Miễn phí dưới doanh thu $10 triệu | **Dùng được** ở quy mô này |
| **Wan 2.2** | **Apache 2.0** | Dùng được, kể cả đầu ra |

**AGPL là cái bẫy dễ đạp nhất trong danh sách này.** Nó không giống GPL thường: chỉ cần khách **dùng qua mạng** là đã kích hoạt nghĩa vụ mở mã, không cần phân phối phần mềm. Rất nhiều SaaS dính ở đúng điểm này.

Vì thế đề xuất là **tự viết phần nắn ảnh** (khoảng vài trăm dòng) thay vì kéo DepthFlow vào. Mô hình độ sâu (Apache 2.0) và ffmpeg là đủ; DepthFlow chủ yếu đóng gói sẵn phần shader.

### Mức tin cậy của bảng này

Giấy phép đọc từ **trang tổng hợp và blog của nhà cung cấp**, chưa mở từng tệp `LICENSE` trên GitHub và Hugging Face. Riêng IDM-VTON thì đã đọc thẳng trang mô hình và xác nhận đúng.

**Trước khi viết dòng mã đầu tiên, mở tận tệp `LICENSE` của từng repo và từng checkpoint.** Một giờ đọc giấy phép rẻ hơn nhiều so với việc gỡ một thư viện ra khỏi sản phẩm đang bán.

Nguồn: [So sánh mô hình video mở](https://www.thundercompute.com/blog/best-open-source-ai-video-generation-models), [LTX vs Wan](https://magichour.ai/blog/ltx-2-3-vs-wan-2-2), [IDM-VTON trên Replicate](https://replicate.com/cuuupid/idm-vton), [DepthFlow](https://pypi.org/project/depthflow), [ComfyUI-Recolor](https://comfy.icu/extension/benjamin-bertram__ComfyUI-Recolor), [comfyui-garment-recolor](https://comfy.icu/extension/wama-rohan__comfyui-garment-recolor)

---

## HyperFrames và Claude Agent Skills

**Cả hai đều dùng được về mặt kỹ thuật, và cả hai đều không nên đưa vào đường render.** Lý do khác nhau.

### HyperFrames — hay, nhưng sai chỗ

HyperFrames kết xuất **HTML thành video** bằng cách tua một dòng thời gian đã dừng, từng khung một. Nó có kho **khoảng 450 khối dựng sẵn**: chuyển cảnh, lớp phủ, tiêu đề, chữ động, phụ đề, chuyển động máy quay. Chạy bằng `npx hyperframes`, cần Node 22+ và FFmpeg.

Vấn đề là **tốc độ**. Một video 30 giây ở 30 hình/giây là **900 khung**, mỗi khung phải để trình duyệt vẽ xong rồi chụp lại. So với `zoompan` của ffmpeg — đo thật **15,5 giây cho một video 20 giây** — thì đây là một bậc độ lớn khác hẳn. Trên một KVM 4 không GPU, chia CPU với Postgres, nó phá vỡ mọi tính toán công suất trong spec.

Thêm một điều: CLI có lệnh báo **hạn mức gói còn lại**, tức đây là **sản phẩm thương mại có hạn ngạch**, không phải thư viện mở miễn phí. Điều kiện nhúng vào một sản phẩm bán cho người khác: **chưa xác minh**.

**Nơi nó đáng dùng:** làm video giới thiệu cho **chính Viprosell** — phim trang chủ, video hướng dẫn, quảng cáo tuyển khách. Ở đó mỗi tháng làm vài video, chất lượng quan trọng hơn tốc độ, và kho 450 khối là lợi thế thật.

**Cách dùng thông minh nhất:** đọc các khối **phụ đề và chữ động** trong kho để học cách họ đặt chữ, rồi mang cách đó về cho ASS — giống hệt cách dùng repo đổi màu: **chép thiết kế, không chép bộ chạy.**

### Claude Agent Skills — đúng công cụ, sai bài toán

Skills là thư mục chứa tệp `SKILL.md`, thành chuẩn mở từ tháng 12/2025, dùng được qua Agent SDK nên **nhúng vào backend được**.

Nhưng Skills sinh ra để một **tác nhân tự quyết định làm gì tiếp**. Pipeline của Viprosell **không có hình dạng đó**:

| Viprosell đang làm | Agent Skills giả định |
| --- | --- |
| 4 lần gọi cố định, biết trước thứ tự | Tác nhân tự chọn bước |
| Mỗi lần ra JSON, zod kẹp chặt | Đầu ra tự do, tác nhân tự sửa |
| Tầng 4 là **hàm**, không gọi LLM | Thêm lượt gọi để suy nghĩ |
| Một video phải ra trong giây | Vòng lặp tác nhân tính bằng phút |

Thêm một vòng lặp tác nhân vào đây là **đánh đổi tính xác định lấy sự linh hoạt không ai cần**. Pipeline hiện tại đã biết phải làm gì; vấn đề của nó là chất lượng từng bước, không phải việc chọn bước.

Cộng thêm: Claude đắt hơn Gemini Flash / Haiku mà Viprosell đang dùng, trong khi **LLM đã là khoản biến đổi lớn nhất** (76₫ trên 538₫ giá vốn một video).

**Nơi Skills đáng dùng:** công cụ nội bộ — soát mã, dựng báo cáo. Không phải trong đường chạy của khách.

### Tóm lại

| Công cụ | Đường render | Việc khác |
| --- | --- | --- |
| HyperFrames | **Không** — chậm gấp bội, có hạn ngạch | **Có** — video marketing của chính Viprosell |
| Kho 450 khối hiệu ứng | **Không chạy** | **Có** — đọc để học cách đặt chữ cho ASS |
| Claude Agent Skills | **Không** — sai hình dạng bài toán | **Có** — công cụ nội bộ |

---

## Lộ trình gói dịch vụ, xếp theo giá vốn

Thứ tự dưới đây **không theo việc AiDancing đã có gì**, mà theo hai thước: giá vốn có vừa mô hình kinh doanh không, và nó có gần khách thời trang không.

| Thứ | Gói | Giá vốn thêm | Credit đề xuất | Rủi ro pháp lý |
| --- | --- | --- | --- | --- |
| **0** | **Báo cáo video nào ra đơn** | **~0₫** | miễn phí, kèm gói | Không |
| **1** | **2,5D + đổi màu áo** | **0–208₫** | **không tính thêm** | Không |
| 2 | Thay đồ trên ảnh | 1.040–1.950₫/ảnh | **+3 credit/ảnh** | Thấp nếu dùng mô hình có giấy phép |
| 3 | KOL từ ảnh nói | **chưa đo** | chưa đặt | Trung bình — quyền hình ảnh |
| 4 | MV ca nhạc | nhạc 1.040–3.900₫ + hình | chưa đặt | **Cao** — bản quyền nhạc |

### Gói số 0 là thứ đáng làm nhất, và nó không phải tính năng render

Khảo sát thị trường đã chỉ đúng: **đối thủ thật là KOC affiliate**, vì shop trả hoa hồng trên đơn thành công chứ không trả trước. Cách duy nhất cạnh tranh với một thứ "chỉ trả khi có đơn" là **chứng minh video của mình ra đơn**.

Thứ đó không cần GPU, không cần mô hình mới, không thêm một đồng giá vốn nào. Nó là một mã theo dõi trên đường dẫn và một bảng. **Đây là món có tỉ lệ giá trị trên công sức cao nhất trong cả tài liệu này**, và chưa đối thủ nội địa nào làm.

### Gói 1 — không tính thêm tiền, có chủ đích

2,5D và đổi màu tốn gần như bằng không, nên **đừng bán rời**. Đưa thẳng vào mọi video là cách nâng mặt bằng chất lượng mà không động tới bảng giá — và là thứ khách nhìn thấy ngay trong ba giây đầu khi so với đối thủ.

### Gói 2 — thay đồ, đúng đau của shop thời trang

Một mẫu, nhiều bộ, không chụp lại. AiDancing bán rời — khách phải tự ghép ảnh thay đồ, video mẫu và lời thoại. **Viprosell thắng ở chỗ gộp cả ba vào một luồng**, không phải ở chất lượng mô hình.

Ở +3 credit mỗi ảnh (6.450₫ giá Starter) so với giá vốn xấu nhất 1.950₫ — biên lãi 70%, an toàn ngay cả với nhà cung cấp đắt nhất.

### Gói 3 — KOL từ ảnh, chưa đặt giá được

AiDancing bán 12.000–13.300₫. **Chưa đo được giá vốn**, và đây là chỗ dễ lỗ: nếu phải dùng mô hình sinh video toàn khung thì giá vốn một đoạn 15 giây đã là ~19.500₫ — **bán bằng AiDancing là lỗ**.

Phép thử cần làm trước khi hứa gì: chạy thử các mô hình **chỉ nắn vùng miệng** (rẻ hơn sinh toàn khung nhiều lần) trên 10 ảnh thật, ghi thời gian và tiền.

### Gói 4 — MV ca nhạc, để cuối

Xa nhu cầu chốt đơn nhất và rủi ro bản quyền cao nhất. Nhạc AI có giấy phép thương mại: Google Lyria ~1.040₫ cho 30 giây, ElevenLabs Music ~3.900₫ mỗi phút.

**Cảnh báo:** không phải mọi nhạc AI đều được dùng cho quảng cáo. Phải có điều khoản **cấp quyền thương mại rõ ràng** trong hợp đồng API; thiếu nó là vi phạm giấy phép. Hai mươi mẫu "cover lại bài hát" của AiDancing nằm đúng vùng này — đó là lý do không đi theo.

### Đường clip vẫn là sản phẩm chính

Đường clip có giá vốn **332₫**, thấp hơn đường ảnh (538₫) vì không cần nâng ảnh. Nó **vừa rẻ hơn vừa gần thị trường hơn** — hiếm khi hai thứ đó trùng nhau. Mọi gói mở rộng nên cắm vào đó trước.

---

## Giá bán đề xuất

**Hai dòng sản phẩm nên bán cùng một giá**, vì giá vốn của chúng gần như bằng nhau. Nhưng bảng giá hiện tại có **hai lựa chọn không ai nên mua**, cần sửa trước khi mở bán.

### Lỗi 1: gói Business bị Premium áp đảo

| Gói | Giá | Credit | Mỗi credit |
| --- | --- | --- | --- |
| Starter | 129.000₫ | 60 | 2.150₫ |
| Pro | 249.000₫ | 160 | 1.556₫ |
| **Business** | **499.000₫** | **360** | **1.386₫** |
| **Premium** | **520.000₫** | **480** | **1.083₫** |

Trả thêm **4,2%** tiền được thêm **33%** credit. Không khách nào tỉnh táo mua Business, nên nó không sinh ra đồng doanh thu nào — chỉ làm bảng giá dài thêm một dòng.

**Sửa:** đẩy Premium thành bậc thật — **899.000₫ cho 800 credit** (1.124₫/credit). Thang giá khi đó giảm đều: 2.150 → 1.556 → 1.386 → 1.124.

### Lỗi 2: mốc 20 giây bị mốc 30 giây áp đảo

Một credit đổi 15 giây, làm tròn lên. Nên:

| Thời lượng | Credit | Giá ở Starter |
| --- | --- | --- |
| 15 giây | 1 | 2.150₫ |
| **20 giây** | **2** | **4.300₫** |
| **30 giây** | **2** | **4.300₫** |
| 45 giây | 3 | 6.450₫ |

Cùng giá thì không ai chọn 20 giây. **Sửa: bỏ mốc 20 giây**, chỉ còn 15 / 30 / 45 — đúng 1 / 2 / 3 credit, và vẫn phủ đủ dải thời lượng mà TikTok, Reels và Shorts ưu ái.

### Hai dòng sản phẩm: vì sao cùng giá

| | Video từ ảnh sản phẩm | Video từ clip quay điện thoại |
| --- | --- | --- |
| Pipeline LLM 4 tầng | Có | Có |
| Tổng hợp giọng | Có | Có |
| Nâng ảnh Real-ESRGAN | Có | Không cần |
| Giải mã và cắt video nguồn | Không | Có |
| **Giá vốn mỗi video 30 giây** | **332₫** | **~332₫** |

Hai chênh lệch triệt tiêu nhau: dòng ảnh tốn thêm phần nâng ảnh, dòng clip tốn thêm phần giải mã. Khoản đắt nhất — LLM và TTS — giống hệt nhau.

Một giá duy nhất còn là **lợi thế bán hàng**: đối thủ tính tiền theo từng loại thao tác, khách phải tra bảng mới biết một video hết bao nhiêu. "Một credit = 15 giây, mọi kiểu video" là câu nói được trong một hơi.

Chỉ nên thu thêm khi clip tải lên vượt hạn mức dung lượng — đó là chi phí thật và khách hiểu được.

### Mức giá này đứng ở đâu trên thị trường

| | Mỗi video 30 giây |
| --- | --- |
| **Viprosell Starter** | **4.300₫ (~$0,17)** |
| Creatify | $2 – $5 |
| Arcads | $11 |

Chênh **12 đến 67 lần**. Với biên lãi gộp 92% và mốc hoà vốn 4,4 khách, giá hiện tại **không phải rủi ro tài chính**. Khuyến nghị giữ nguyên để chiếm chỗ, vì đang có **0 khách trả tiền** — chưa đo được mức sẵn sàng chi trả thì nâng giá là đoán mò.

Nhưng đừng neo thấp vĩnh viễn. Tham chiếu để định giá lại sau này: nhà bán TikTok Shop đang chi tới **15% doanh thu** cho làm video và KOC. Gói Pro 249.000₫ chỉ chiếm **1,7%** ngân sách nội dung của một shop doanh thu 100 triệu/tháng. **Rào cản không nằm ở giá — nằm ở chỗ họ chưa biết mình tồn tại.**

---

## Rủi ro phải mang theo

**Rủi ro lớn nhất không nằm ở kỹ thuật.** Dự án hiện có **0 khách trả tiền**, nên mọi con số doanh thu trong tài liệu này là mô hình chứ không phải đo đạc. Phần hạ tầng thì đã chắc chắn đủ: nó chỉ cần rẻ và không sập.

| Rủi ro | Chặn trước thế nào |
| --- | --- |
| **Một máy hỏng là mất tất** — không còn bản dự phòng do Supabase lo | `pg_dump` hằng ngày lên R2 + ảnh chụp VPS hằng tuần của Hostinger. **Cửa 2 bắt phải khôi phục thử thành công trước khi chuyển dữ liệu thật** |
| **Tự vá bảo mật** — bản tự chạy không tự cập nhật | Ghim phiên bản trong `docker-compose.yml`, đặt lịch rà bản vá mỗi tháng |
| **vCPU Hostinger chậm hơn dự tính** — 15,5 giây là đo trên máy hiện tại | Đo lại **ngay ngày đầu của bước 2**, trước khi tắt máy ở nhà. Chậm 4 lần thì lên KVM 8 |
| **Render bỏ đói Postgres** — chung bốn nhân | `CPUQuota` trong systemd, chừa tối thiểu một nhân cho API và CSDL |
| **Giá VPS gia hạn tăng 140–232%** | Lấy giá gia hạn để tính hoà vốn, không lấy giá năm đầu |
| **Mô hình AI cấm dùng thương mại** | Kiểm giấy phép trước khi tích hợp bất kỳ mô hình nào, không chỉ so giá |

### Ba điều tài liệu này chưa trả lời được

1. **Mức sẵn sàng chi trả ở Việt Nam.** Không tìm được bảng giá công bố nào cho dịch vụ làm video quảng cáo thuê trong nước. Con số "15% doanh thu cho video và KOC" là một trường hợp đơn lẻ, không phải mức chung.
2. **Tốc độ thật của Hostinger.** Chưa đo được cho tới khi dựng máy.
3. **Supabase có thực sự đang tráo bộ nhớ hay không.** Suy ra bằng cách loại trừ, không đọc được chỉ số thật của máy đó. Điều này **không đổi kết luận** — vì cả ba nguyên nhân Supabase nêu đều được giải bằng một máy to hơn, và một máy to hơn là điều phương án này mang lại.

---

## Chưa chắc, và phép thử cần làm

### Spec KVM 4 không phải viết lại

Nói trước điều này vì nó quyết định có phải hoãn không: **không có phát hiện nào ở trên làm đổi kiến trúc trong spec.**

| Thứ mới | Vào spec ở đâu | Có phải sửa kiến trúc? |
| --- | --- | --- |
| Chuyển động 2,5D | Thêm một `stage` trong đường ảnh | Không — chạy CPU, như mọi bước khác |
| Đổi màu áo | Thêm một `stage`, gọi T4 như nâng ảnh | Không — cùng khuôn fallback |
| Thay đồ, KOL, MV | Đã có `job_type` + capability registry | Không — spec đã chừa chỗ |
| Báo cáo video ra đơn | Nằm ngoài đường render | Không |

**Có thể chốt spec và bắt tay làm.** Những thứ dưới đây chạy song song, không chặn.

### Phép thử, xếp theo giá trị trên công sức

| # | Phép thử | Công | Trả lời điều gì |
| --- | --- | --- | --- |
| 1 | **Nạp 52.000₫ vào AiDancing, tạo 3 video mẫu thời trang** | nửa buổi | Họ dựng bằng gì, chất lượng thật ra sao, có đáng đua không |
| 2 | **Dựng thử 2,5D trên 10 ảnh sản phẩm thật** | 1 ngày | Chuyển động có đẹp thật không, hay chỉ đẹp trên lý thuyết |
| 3 | **Đổi màu thử trên áo sáng và áo tối** | nửa ngày | Ngưỡng màu nào dùng được, màu nào phải chặn |
| 4 | **Mở tận tệp `LICENSE` của từng repo và checkpoint** | 1 giờ | Tránh bẫy AGPL và bẫy CC-BY-NC |
| 5 | **Đo mô hình chỉ nắn vùng miệng trên 10 ảnh** | 1 ngày | Gói KOL có bán được không |
| 6 | **Đọc lại giá trên trang chính thức của fal.ai và Replicate** | 30 phút | Giá trong tài liệu này đúng tới đâu |

### Những điều không xác minh được

| Điều | Tình trạng |
| --- | --- |
| Giá API sinh video | Đọc từ **trang tổng hợp**, không phải trang nhà cung cấp. Loại giá này đổi nhanh |
| Giấy phép các mô hình mở | Đọc từ blog, **chưa mở tệp `LICENSE`**. Riêng IDM-VTON đã đọc thẳng và xác nhận cấm thương mại |
| Điều kiện nhúng HyperFrames vào sản phẩm bán | **Chưa xác minh** — chỉ biết nó có hạn ngạch theo gói |
| Giá vốn gói KOL từ ảnh | **Chưa đo** |
| Tốc độ Depth Anything và SAM 2 trên CPU của KVM 4 | **Chưa đo** — bản mẫu đo 0,25 giây/ảnh trên máy 32 nhân, chưa đo trên 4 nhân |
| Chuyển động 2,5D có đẹp trên **nhiều loại** ảnh sản phẩm không | **Đã thử 1 ảnh, dùng được.** Chưa thử trên 10 ảnh đa dạng |
| Nội dung video TikTok được dẫn | **Không xem được** — TikTok chặn bằng CAPTCHA và tôi không giải CAPTCHA |

### Về cái link TikTok

Nếu những video ấy quan trọng cho quyết định — và tôi nghĩ là có — thì cách nhanh nhất là **tải về vài video mẫu rồi đưa trực tiếp**. Tôi đọc được tệp video, và khi đó có thể nói cụ thể từng nhịp cắt, kiểu chữ, cách đặt móc ba giây đầu — thay vì đoán từ tiêu đề.
