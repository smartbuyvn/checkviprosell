# Viprosell — Hiện trạng ngày 28/10/2026

Tài liệu bàn giao cho người mới. Đối chiếu với `Viprosell_SPEC_V3_2026-10-27.md`.

---

## 1. Sản phẩm làm gì

Người bán hàng online dán link sản phẩm hoặc tải 3–8 ảnh lên, hệ thống tự viết kịch bản
quảng cáo và dựng ra video dọc 9:16 dài 15–30 giây để đăng TikTok/Reels.

**Đang thu tiền thật.** Không phải demo.

---

## 2. Chạy ở đâu — điều quan trọng nhất phải nắm

Hệ thống chạy ở **hai nơi**, và nhầm chỗ là mất hàng giờ:

| Thành phần | Nơi chạy | Ghi chú |
|---|---|---|
| Web + API | VPS `v.ninhle.com` (`76.13.210.71`) | `/srv/viprosell/dist` và `/srv/viprosell/backend` |
| **Worker dựng video** | **Máy cá nhân** (`D:\vidiosell`) | Chạy `npm run worker:render` |
| CSDL + lưu trữ | Supabase | Bucket `renders` (video), `project-assets` (ảnh gốc) |

**Pipeline AI 4 tầng chạy trong worker ở máy local, KHÔNG phải trên VPS.** Sửa prompt rồi
deploy lên VPS là vô ích — phải khởi động lại worker. Worker nạp code một lần lúc khởi
động, không tự nạp lại.

`npm run worker:render` sinh ra **3 tiến trình `node.exe`** (npm → tsx → worker). Ba tiến
trình không có nghĩa là ba worker; phải xem quan hệ cha-con trước khi kết luận.

Service trên VPS chạy bằng `tsx`, mà `tsx` nằm trong `devDependencies`. **Không bao giờ
chạy `npm install --omit=dev` trên VPS** — nó gỡ `tsx` và service chết ngay.

---

## 3. Luồng xử lý

```
Wizard 5 bước
  → POST /api/v1/render/start  { projectId, mode, aspect, rawInput }
  → bảng renders (status = 'pending')
  → Worker nhặt job
      Tầng 1  brief sản phẩm        (có nhìn ảnh)
      Tầng 2  chiến lược quảng cáo  (3 phương án)
      Tầng 3  đồ thị cảnh           (4–10 cảnh, lời đọc, chữ overlay, góc máy)
      Tầng 4  kế hoạch dựng         (timeline cho ffmpeg)
      → TTS sinh giọng từng cảnh    (nếu chọn "Draft + Giọng đọc")
      → Whisper căn phụ đề theo giọng
      → ffmpeg dựng video
      → tải lên bucket `renders`
      → POST /api/v1/render/callback
```

---

## 4. Nhà cung cấp bên ngoài

| Việc | Dùng gì | Biến môi trường |
|---|---|---|
| LLM chính | Claude Haiku 5.5 | `ANTHROPIC_API_KEY` |
| LLM dự phòng | Gemini 2.5 Flash | `GEMINI_API_KEY` |
| LLM máy nhà | Ollama (mặc định **tắt**) | `OLLAMA_ENABLED` |
| Lồng tiếng | FPT Token Factory | `VIENEU_*` (xem mục 7) |
| Phụ đề | whisper.cpp qua ffmpeg | `WHISPER_MODEL_PATH` |
| Thanh toán | VietQR / SePay | đối soát theo mã đơn |

Chi phí đo thật: **~56–96đ/video** phần LLM với Haiku (Gemini đắt gấp 4,4 lần ở đầu ra).
Render 0đ vì chạy CPU máy nhà, khoảng **13,8 giây cho video 25 giây**.

---

## 5. Đã chạy được

- Pipeline 4 tầng, có nhìn ảnh sản phẩm ở tầng 1
- Lồng tiếng tiếng Việt, cache theo hash câu (sửa một chữ chỉ tốn tiền câu đó)
- Phụ đề căn theo giọng đọc thật, không bám mốc cảnh
- Phụ đề ASS (libass) — `drawtext` đã bỏ vì nó **xoá cả dòng khi gặp `%`**
- Dashboard dạng lưới: thumbnail, thời lượng, phát, chia sẻ, tải về, phân trang 24
- Affiliate: hoa hồng **trả bằng tiền**, có luồng rút, giữ 7 ngày
- Thanh toán đối soát theo **mã đơn** (`VIPRO` + 8 ký tự), không đoán theo số tiền
- Dọn thùng rác định kỳ: quá 30 ngày thì xoá cả file trong bucket

---

## 6. Khác biệt so với spec V3

| Spec chốt | Thực tế | Vì sao |
|---|---|---|
| VieNeu-TTS chạy CPU máy nhà, 0đ | **FPT Token Factory** (~85đ/video) | Giấy phép weights VieNeu chưa ai đọc; rủi ro pháp lý trên sản phẩm thu tiền |
| Hàng đợi bảng Postgres + `claim_job` | Bảng `renders` + quét định kỳ | Đủ dùng ở quy mô hiện tại |
| Lưu trên Cloudflare R2 | **Supabase Storage** | Chưa chuyển; R2 rẻ hơn khi lưu lượng tăng |
| Gộp pipeline 4 tầng còn 2 | Vẫn 4 tầng | Giảm ~40% chi phí LLM nếu làm |
| Shot list, 10 template, `qa_report` | Chưa làm | Mốc S4 |

---

## 7. Biến môi trường tối thiểu

Đặt ở **cả hai nơi**: `D:\vidiosell\backend\.env` và `/srv/viprosell/backend/.env`.

```
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

TTS_ENABLED=true
TTS_PROVIDER=vieneu              # tên cũ, thực chất là client tương thích OpenAI
VIENEU_BASE_URL=https://mkp-api.fptcloud.com
VIENEU_API_KEY=<khoá FPT Token Factory>
VIENEU_MODEL=FPT.TTS-ultra
VIENEU_VOICE=std_vietkhoa
VIENEU_FORMAT=mp3

WHISPER_MODEL_PATH=D:/vidiosell/models/ggml-small.bin
WHISPER_LANGUAGE=vi

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
INTERNAL_CALLBACK_SECRET=...
RENDER_CALLBACK_URL=https://v.ninhle.com/api/v1/render/callback
```

Tên biến `VIENEU_*` là di sản: lớp provider viết cho VieNeu, sau đổi sang FPT Token
Factory mà vẫn dùng chung vì cả hai đều theo chuẩn OpenAI `/v1/audio/speech`.

---

## 8. Những cái bẫy đã cắn — đọc trước khi sửa gì

**Supabase Realtime không phải nguồn trạng thái.** Nó là kênh thông báo và im lặng khi
bảng không nằm trong publication. Đã gây ba lỗi khác nhau: worker bỏ sót job, frontend
treo 0%, job nằm im 45 phút. Quy tắc: **đọc một lần lúc khởi tạo + Realtime + hỏi lại
định kỳ**. Thiếu lớp nào cũng treo im lặng.

**`tsc -p tsconfig.json` không kiểm gì cả.** File đó có `"files": []`, chỉ chứa
`references`. Lệnh đúng là `tsc --noEmit -p tsconfig.app.json`. Hiện còn ~100 lỗi kiểu,
phần lớn là tiếng ồn suy kiểu Supabase, không phải lỗi chạy.

**Giao diện Admin từng không nối với thứ thực sự chạy.** Prompt sửa trong Admin lưu vào
bảng `prompts` nhưng pipeline dùng hằng số viết cứng. Đã nối (có cache 60 giây). Cài đặt
cũng vậy: bảng `system_settings` rỗng thì giao diện hiện **giá trị mặc định** chứ không
phải trạng thái thật.

**ffmpeg dùng `:` làm ký tự phân cách filter**, nên đường dẫn Windows `D:/...` cắt câu
lệnh làm đôi. Cú pháp thoát nhiều tầng rất dễ sai. Cách dứt điểm: `cwd` vào thư mục chứa
file rồi dùng tên trần.

**`zoompan` dịch khung cắt theo bước nguyên pixel** → giật. Phải phóng ảnh gấp đôi trước
rồi zoompan trả về khổ đầu ra.

**Tỉ lệ khung hình là lựa chọn của khách, không phải của AI.** Từng lấy
`renderPlan.export.resolution` do model sinh, nên khách chọn 9:16 mà ra video vuông.

**Không bao giờ `rm -rf dist/assets` trước khi chắc gói mới đã tới.** Đã gây trang trắng.

---

## 9. Việc tiếp theo, theo thứ tự đáng làm

1. **Gộp 4 tầng còn 2** — giảm ~40% chi phí LLM
2. **Chuyển sang Cloudflare R2** — không phí tải về, rẻ hơn khi lưu lượng tăng
3. **Tách code theo route đã làm**; còn ~100 lỗi kiểu cần phân loại
4. **Dọn file tạm** trong `D:\vidiosell\renders_output` — hiện không bao giờ bị xoá
5. Shot list + template theo mã sản phẩm (mốc S4 của spec)

---

## 10. Bài toán kinh tế

Chi phí cố định nếu chạy hoàn toàn trên đám mây: **~1,14 triệu đồng/tháng**
(VPS + worker + Supabase Pro + R2 + tên miền).

Chi phí biến đổi: **~160đ/video** (LLM + TTS). Gói Pro 130.000₫ = 50 credit = 2.600đ/video,
tức lãi **2.439đ/video, biên 94%**.

**Hoà vốn ở ~468 video/tháng, tương đương 10 gói Pro.**

Supabase Pro chiếm 57% chi phí cố định — bỏ được nó thì hoà vốn ở ~5 gói.

---

## 11. Clip người bán tự quay — kiến trúc và dung lượng

*(Bổ sung 28/10, sau khi nối luồng video vào worker.)*

### Vì sao video đi đường khác hẳn ảnh

Ảnh **không** có chuyển động nên phải tạo ra chuyển động — `zoompan` (Ken Burns).
Video **đã** có chuyển động thật. Zoom thêm lên nó là chồng hai chuyển động lên cùng
một khung hình: ra cảm giác chóng mặt và lộ ngay là máy ghép. Spec V3 §3 chốt dùng
`trim` + `scale` + `crop`, **không zoom thêm**.

Cái tự nhiên đó chính là lý do luồng này tồn tại — tay người cầm sản phẩm, ánh sáng
thật, vật chuyển động thật. Zoom lên nó là phá đúng thứ mình đang muốn giữ.

Code: `src/lib/video-asset.ts` (thuần, 30 test) + nhánh `laVideo` trong
`buildFfmpegCommandFromPlan`.

### Ba cái trần từng chặn chết tính năng này

Giao diện đã nhận `video/mp4` từ lâu, nhưng không clip thật nào đi qua nổi:

| Chỗ | Trần cũ | Theo spec | Hậu quả |
|---|---|---|---|
| `asset.service.ts` | 20MB chung cho mọi file | 200MB cho video | Loại gần như **mọi** clip thật |
| `fetch-guard` mặc định | 25MB | — | Worker tải clip về bị cắt giữa chừng |
| `fetch-guard` timeout | 20 giây | — | 200MB không bao giờ tải kịp |

Clip 30 giây quay bằng điện thoại thường nặng 50–150MB. Trần 20MB nghĩa là tính năng
coi như không tồn tại dù giao diện vẫn mời tải lên.

### Dung lượng: clip gốc mới là vấn đề, không phải video xuất ra

Bảng dung lượng ở spec V3 chỉ đếm video xuất ra. Clip gốc nặng hơn nhiều:

| 1.000 dự án/tháng, giữ 30 ngày | Dung lượng | Chi phí R2 |
|---|---|---|
| Chỉ video xuất ra (12,5MB/cái) | 12 GB | ~4.800đ |
| Kèm clip gốc, thực tế (3×60MB) | 176 GB | ~68.600đ — **gấp 14×** |
| Kèm clip gốc, tối đa (3×200MB) | 586 GB | ~228.500đ — **gấp 48×** |

**Quyết định: xóa clip gốc sau khi render xong, giữ 24 giờ để render lại.**

Clip gốc chỉ có ích *trong lúc* dựng. Xong rồi thì nó không còn việc gì, trừ khi khách
muốn dựng lại — và 24 giờ là đủ rộng cho nhu cầu đó.

| Giữ 24h thay vì 30 ngày | 5,9 GB | ~2.300đ — tiết kiệm **66.000đ/tháng** |
|---|---|---|

Đặt cạnh chi phí cố định 2,59 triệu/tháng thì 66.000đ không lớn, nhưng nó tỉ lệ thuận
với sản lượng: ở 10.000 dự án/tháng là 660.000đ, bằng một phần tư tiền Supabase Pro.

⚠️ **Chưa triển khai.** `storage-purge.ts` hiện chỉ dọn video quá hạn 30 ngày, chưa
đụng tới clip gốc. Cần thêm `purgeSourceAssets(projectId)` gọi sau khi render thành
công. Đây là xóa dữ liệu của khách nên cần chốt thời hạn trước khi làm.

### Gợi ý trên giao diện

Người bán không biết cần quay gì — hoặc bỏ qua, hoặc quay một đoạn dài vô định không
dùng được cảnh nào. `NewProject.tsx` bước "Nguồn SP" nay có bảng gợi ý ba cảnh (cầm
trên tay / cận cảnh chất liệu / đang dùng thật) kèm yêu cầu kỹ thuật.

Ô dán link cũng đã nói rõ điều spec §2.3 yêu cầu: **link chỉ lấy phần chữ, không lấy
ảnh** (điều khoản sàn, và ảnh trên sàn mang watermark của người bán khác). Trước đây ô
này không nói gì, nên người bán dán link rồi bấm tiếp và tưởng đã xong — dẫn tới dự án
không có ảnh nào và render chết ở guard `NO_PRODUCT_IMAGES`.

---

## 12. Luồng dựng clip: hai call, không phải bốn tầng

### Vì sao không dùng lại chuỗi 4 tầng

Bốn tầng tồn tại để **sáng tác** một kịch bản từ con số không. Với clip khách tự quay
thì nội dung **đã có sẵn** — việc là dựng, không phải viết. Ép qua 4 tầng sẽ khiến model
nghĩ ra một kịch bản rồi cố bẻ footage cho vừa, tức phá đúng thứ luồng này sinh ra để giữ.

```
ffprobe → Whisper → trích 6 khung → Call 1 (đọc) → Call 2 (kế hoạch) → QA → ffmpeg
   code     code         code          LLM             LLM             code    code
```

**Không gửi file video cho LLM.** Thứ cần quyết là mốc thời gian, mà mốc thời gian đã
nằm trong kết quả ffprobe + Whisper + khung hình.

**Sáu khung, không phải mười hai.** Mỗi khung ≈ 1.600 token đầu vào — đây là phần đắt
nhất của luồng. Một clip 30 giây hiếm khi có quá 6 cảnh khác nhau, nên 12 khung là trả
gấp đôi cho rất ít thông tin thêm.

### Cổng QA ở đây mạnh hơn hẳn nhánh ảnh

Vì có **một sự thật để đối chiếu**. Nhánh ảnh sáng tác từ con số không nên `qa-gate.ts`
chỉ chặn được các mẫu chữ cấm đã biết trước. Ở đây có một đoạn phim dài đúng bao nhiêu
mili giây và một transcript ghi đúng những gì khách nói, nên chặn được:

- Mọi `in_ms`/`out_ms` nằm ngoài clip → loại đoạn (ffmpeg nhận `trim` ngoài phạm vi sẽ
  cho ra khung đen mà mã thoát vẫn là 0)
- Mọi dòng chữ khách **không nói** → bỏ chữ, kể cả câu nghe rất hợp lý
- `total_ms` model khai lệch với tổng các đoạn → model cộng sai

### Ba chỗ sửa so với bản đề xuất 28/10

| Đề xuất | Vấn đề | Đã làm |
|---|---|---|
| 80MB + "15–40 giây" | 4K chạm 80MB ở giây **13** | **100MB + 30 giây** — cặp khớp cho mọi chế độ 1080p |
| `punch_in` 1.00→1.30, bước ≤0.001 | Đoạn 6s/30fps chỉ đi được 0.18 | Hạ biên độ cho vừa ngân sách bước |
| "Không giữ nhạc gốc" + "giữ giọng khách" | Giọng và nhạc nằm chung một dạng sóng | *Chưa xử lý — xem dưới* |

Chọn 100MB **không phải** để tiết kiệm dung lượng: với hạn giữ 24h thì 100MB và 200MB
chênh 3.800đ/tháng ở mức 1.000 dự án. Lý do là **thời gian tải lên** — mạng di động VN
~10 Mbps, 200MB mất 160 giây nhìn thanh tiến trình trước khi có gì xảy ra.

### Chưa làm

1. **Nhạc nền lẫn trong tiếng gốc.** Không tách được nếu không có source separation.
   Chỉ có hai lựa chọn thật: giữ cả nhạc lẫn giọng, hoặc bỏ cả hai. Dòng UI *"nhạc đó
   sẽ bị bỏ"* trong bản đề xuất hứa một việc không làm được.
2. **Worker chưa gọi `VideoEditService`** — chưa có đường vào cho dự án chế độ video.
3. **Ghép ffmpeg từ segments** — `cropFilter`/`gradeFilter`/`stabilizeParams` đã có và
   có test, nhưng chưa có hàm ráp chúng thành một lệnh hoàn chỉnh.
4. **UI**: chưa có thẻ chọn theme, và wizard chưa tách hai cửa ngang nhau.
5. **vidstab chưa đo.** Nó là bộ lọc **hai lượt** (`vidstabdetect` rồi `vidstabtransform`),
   tức giải mã clip hai lần. Máy có `libvidstab` (đã kiểm), nhưng đừng hiện ước lượng
   thời gian cho khách trước khi đo thật.

---

## 13. Âm thanh của luồng dựng clip — chốt 28/10

### Sự thật vật lý quyết định toàn bộ phần này

Giọng và nhạc trong file khách nộp là **một dạng sóng**. Không có source separation
trong pipeline (mốc này không thêm Demucs), nên không tách được. Chỉ có hai việc làm
được: giữ cả khối tiếng, hoặc bỏ cả khối. **Bỏ cả khối là phá việc "giữ tự nhiên",
nên mặc định là giữ.**

Mọi dòng UI kiểu *"nhạc đó sẽ bị bỏ"* đã gỡ — đó là hứa một việc không làm được.

| Thành phần | Bám vào | Khi cắt / đảo cảnh |
|---|---|---|
| Tiếng gốc | Từng đoạn, cùng `in_ms`/`out_ms` | Đứt đúng chỗ cắt. **Cố ý.** |
| Nhạc thư viện | Đồng hồ thành phẩm, một track trải suốt | Vẫn liền. Hạ xuống khi có lời. |
| TTS | Không đè lên clip có lời | Chỉ khi Call 1 báo không có lời |

### Cờ `music_bed_likely` — đo, không hỏi model

Model nghe mô tả khung hình chứ **không nghe tiếng**, nên `problems: ["music_bed"]`
của Call 1 chỉ là phỏng đoán. Worker gắn cờ trước khi gọi Call 2, theo thứ tự:

1. **Khách tick "Tôi có phát nhạc khi quay"** — lời khách là đúng, phép đo không được
   phủ định.
2. Không tick thì **đo RMS** các khoảng Whisper coi là im (>400ms). Chênh dưới **8 dB**
   so với lúc nói nghĩa là khoảng "im" vẫn đầy âm thanh → gần như chắc chắn là nhạc.

Đo không ra thì nghiêng về phía **có nhạc**: đoán sai phía này thì video hơi kém linh
hoạt; đoán sai phía kia thì bài hát nhảy giữa video và khách nghe ra ngay.

### Khi cờ bật, code ÉP — không để model xin ngoại lệ

- `music_bed = none`
- `speed = 1.0` trên mọi đoạn
- **`in_ms` phải tăng dần** — cấm kéo câu ở giữa clip lên làm hook

Ràng buộc thứ ba là nặng nhất: nó bỏ mất đúng kỹ thuật mạnh nhất của luồng này. Đổi lại,
bài nhạc không nhảy ngược. Hook vẫn tồn tại — chỉ là nó phải là đoạn mạnh nhất **trong
số các đoạn còn lại theo thứ tự thời gian**.

### Quy tắc ráp audio — trong hàm ghép, không trong prompt

- Mỗi đoạn: `atrim` → `asetpts` về 0 → **fade 12ms hai đầu** để hết tiếng click.
  Không dài hơn 12ms: dài hơn là nghe thành tiếng phai, mà trên clip có nhạc thì mỗi
  lần phai là bài hát mờ đi rồi rõ lại — lộ chỗ cắt rõ hơn là để nguyên.
- **`xfade_160` chỉ hợp lệ khi hai đoạn liền nhau trên clip gốc** (hở < 80ms). Cách
  nhau mà hoà vào nhau là tiếng của hai thời điểm chồng lên. QA ép về `cut`.
- Nhạc thư viện: một track dài bằng `total_ms`, bắt đầu cùng khung 0 của file xuất,
  **không cắt theo đoạn**. Nền 20%, `sidechaincompress` hạ còn ~10% khi có giọng.
- Hàm ghép coi **cờ của worker là nguồn đúng**, kể cả khi Call 2 vẫn khai `music_bed`
  khác `none` — nó không dựa vào việc QA có chạy hay không.
- Không time-stretch tiếng gốc để vá lỗ. Lỗ do cắt thì bỏ hẳn, hình và tiếng cùng ngắn lại.

### Vẫn chưa đo

**Không hiện ước lượng thời gian cho khách** cho tới khi đo xong một lượt vidstab trên
máy worker. vidstab là bộ lọc hai lượt — giải mã clip hai lần.

---

## 14. Nối chuỗi UI → worker cho luồng clip

### Chỗ chuỗi từng đứt

`rawInput` ở `NewProject.tsx` **không mang** `source_mode`, `theme`, `has_background_music`
xuống backend. Giao diện có đủ thông tin, worker không bao giờ nhận được — nên dù khách
chọn gì thì cũng luôn chạy nhánh ảnh.

Lỗi kiểu này không lộ ra ở `tsc` (vì `raw_input` là JSON tự do) và không lộ ra ở test
đơn vị (vì mỗi bên đều đúng khi đứng riêng). Nó chỉ lộ khi khách bấm Render và nhận về
một video sai hẳn thứ họ chọn. `tests/video-chain.test.ts` khoá hợp đồng này lại.

```
NewProject.rawInput → RenderService.createJob → POST /render/start
  → CompositionService.startComposition → renders.raw_input
  → worker: raw_input.source_mode === 'video_edit' → runVideoEditJob
```

### Bỏ chế độ "chỉ link"

`SourceMode` cũ là `'url' | 'upload'`, tức cho phép chọn **chỉ link**. Nhưng không chỗ
nào trong hệ thống tải ảnh từ link về, và spec V3 §2.3 cấm làm việc đó. Chế độ đó dẫn
thẳng tới dự án không có liệu nào — người bán dán link, bấm tiếp, tưởng đã xong, rồi
render chết ở `NO_PRODUCT_IMAGES`.

Giờ là `'images' | 'video'`, hai cửa ngang nhau, và link là ô phụ **không bắt buộc**
hiện ở cả hai chế độ, ghi rõ *"chỉ để lấy tên và giá"*.

### Ô tick "Tôi có phát nhạc khi quay"

Không phải tiện ích. Đây là **nguồn số 1** của cờ `music_bed_likely`, được ưu tiên hơn
phép đo RMS ở worker, và cờ đó quyết định có được đảo thứ tự cảnh hay không.

### Một điểm đồng bộ phải giữ bằng tay

`THEME_CARDS` ở `NewProject.tsx` và `THEMES` ở `backend/src/lib/video-edit.ts` là hai
nơi. Backend là nguồn sự thật về nhạc/màu/chống rung; frontend chỉ giữ nhãn.
`tests/video-chain.test.ts` kiểm bốn khoá khớp nhau — thêm theme mới thì phải sửa cả hai.
