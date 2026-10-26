# Viprosell Hybrid Transitional Architecture Spec

> [!IMPORTANT]
> **Status:** APPROVED AS HYBRID TRANSITION PLAN
> **Context:** This document refactors the legacy local-GPU-heavy architecture into a robust, scalable Hybrid Architecture. Local RTX 3060 is demoted from the "sole production backbone" to a "specialized fast-lane", paving the way for Serverless production and External Premium GPUs.

---

## I. Hybrid Revised Architecture

Hệ thống chuyển dịch sang kiến trúc **3 Làn (3-Lane Pipeline)** nhằm cân bằng giữa chi phí, tốc độ MVP và khả năng mở rộng (Scale) dài hạn.

### Làn A: Local GPU Lane (RTX 3060)
Không còn là xương sống (backbone) cho toàn bộ hệ thống. Nhiệm vụ của Local GPU được quy hoạch lại thành:
- **Dev/Staging Renderer:** Môi trường test kịch bản, tối ưu composition trước khi đẩy lên Cloud.
- **Preview Renderer:** Render các bản nháp (draft/placeholder) cho user xem thử trên UI.
- **Low-volume QUICK ADS:** Tận dụng bộ mã hóa NVENC cực nhanh của NVIDIA cho các job đơn giản (ảnh tĩnh + hook text + motion nhẹ).
- **Fallback:** Hoạt động như một máy chủ dự phòng khi Cloud gặp sự cố.

### Làn B: Serverless Lane (Main Production)
Đây là hướng đi chính của SaaS (sử dụng Remotion Lambda, AWS, hoặc Google Cloud Run).
- **Primary Production Render:** Mọi lệnh xuất bản video chính thức (Export MP4) của user sẽ chạy qua đây.
- **Scalability:** Tự động Auto-scale để gánh lượng truy cập đột biến (Burst traffic) mà không lo sập hàng đợi.
- **Predictable Accounting:** Dễ dàng tính toán chính xác chi phí sinh ra trên từng giây render của mỗi Job.

### Làn C: Premium GPU Lane (On-Demand API)
Tách rời hoàn toàn các tác vụ nặng nề dễ gây nghẽn cổ chai (như FaceFusion / Face Replacement) ra khỏi Local VPS.
- **Sử dụng External APIs:** (Ví dụ: Fal.ai, Replicate, Runpod Serverless).
- **Phân luồng:** Chỉ gọi khi user trả phí Premium để ghép mặt, trả tiền theo API call. Ngăn chặn rủi ro 1 video ghép mặt làm sập toàn bộ hệ thống render video thông thường.

---

## II. Updated Folder & Service Boundaries

Ranh giới các module trong Source Code (`d:\vidiosell\backend\src\`) được quy hoạch lại rõ ràng:

- **`services/ai.service.ts` (Layer 1):** Gọi Google Gemini API (gemini-1.5-flash) với *Structured Outputs* để sinh `SceneGraph` JSON (Aspect-agnostic).
- **`composition/` (Layer 2):** Chứa các component React của **Remotion**. Định nghĩa video template.
- **`workers/local_render.worker.ts` (Lane A):** Nghe hàng đợi `local-jobs`. Kích hoạt FFmpeg + NVENC cho Preview hoặc Quick Ads.
- **`services/serverless_render.service.ts` (Lane B):** Đẩy dữ liệu JSON SceneGraph lên Cloud (vd: AWS Lambda) để gọi Remotion Cloud Render.
- **`services/premium_gpu.service.ts` (Lane C):** Tương tác với Fal.ai/Replicate để xử lý hình ảnh/video đầu vào trước khi đưa vào Composition.

---

## III. Render Path Matrix

Bảng đối chiếu trách nhiệm của từng môi trường:

| Hạng mục | Local GPU (RTX 3060) | Serverless (Remotion Lambda) | Premium GPU (External API) |
| :--- | :--- | :--- | :--- |
| **Vai trò chính** | Môi trường Dev, QA, Previews, Low-vol QUICK ADS | Production chính, Xử lý số lượng lớn (Scale) | Xử lý FaceSwap, Hiệu ứng AI nặng |
| **Khả năng Scale** | Kém (Dễ nghẽn cổ chai) | Rất Tốt (Tự động mở rộng) | Tốt (Provider bên thứ 3 lo) |
| **Độ ổn định & Dự đoán**| Thấp (Rủi ro sập cả hàng đợi) | Rất Cao | Rất Cao |
| **Hậu quả khi Fail** | Cao (Tắc nghẽn toàn hệ thống) | Thấp (Chỉ fail đúng 1 function) | Thấp (Chỉ fail đúng 1 API call) |
| **Loại Video phù hợp** | Quick Ads (cần NVENC) | Review, Conversion, Quick Ads | Premium Review (Face Replacement) |

---

## IV. Corrected Unit Economics Assumptions

Bác bỏ hoàn toàn Claim Marketing cũ: *"COGS < 150 VNĐ/video"* (vì đây chỉ là chi phí tiền điện biên - Marginal electricity cost). 

Hệ thống Kế toán Chi phí (Cost Accounting) mới bắt buộc phải tính toán dựa trên **Fully-loaded per-video cost**, bao gồm:
1. **Marginal Cost:** Tiền điện chạy máy Local + Tiền API Token (Gemini).
2. **Local Hardware Amortization:** Khấu hao linh kiện phần cứng (RTX 3060, SSD hao mòn, chi phí duy trì mạng/VPS).
3. **Cloud Variable Cost:** Chi phí giây tính toán của Serverless (Lambda) + Băng thông lưu trữ Cloudflare.
4. **DevOps & Failure Impact:** Chi phí cơ hội do job lỗi, phải retry, và thời gian bảo trì.

> [!TIP]
> **Mục tiêu thực tế:** Định mức COGS (Chi phí vốn) cho một video quảng cáo 30s Full HD trên kiến trúc Serverless phải rơi vào khoảng **3,000 - 4,000 VNĐ**. Đây là con số tài chính an toàn, minh bạch và có thể scale dài hạn cho một mô hình SaaS.

---

## V. Migration Plan (Từ Legacy Spec sang Hybrid Spec)

Lộ trình PIVOT hệ thống Viprosell được chia làm 4 giai đoạn:

*   **Giai đoạn 1: Cách ly rủi ro (Risk Isolation)**
    *   Tách tính năng FaceFusion/FaceSwap ra khỏi luồng `local_render.worker.ts`.
    *   Đấu nối API (Fal.ai/Replicate) để xử lý riêng các job Premium.
*   **Giai đoạn 2: Cấu trúc lại Dữ liệu (JSON SceneGraph)**
    *   Chuyển đổi các kịch bản sang định dạng JSON SceneGraph chuẩn mực, aspect-agnostic.
    *   Tiếp tục dùng máy Local làm render engine chính để test định dạng JSON này có chạy đúng không.
*   **Giai đoạn 3: Triển khai Remotion & Serverless (Core Pivot)**
    *   Đưa Remotion vào làm Composition Layer (Layer 2).
    *   Tích hợp Remotion `<Player />` lên UI để user preview không tốn tài nguyên.
    *   Triển khai Remotion Lambda (hoặc tương đương) làm Serverless Lane.
*   **Giai đoạn 4: Hoàn thiện Hybrid Routing**
    *   Cấu hình Router: Nút "Preview" trên UI -> Bắn job về Local GPU. Nút "Xuất bản" -> Trừ Credits & Bắn job lên Serverless Lane.
    *   Hoàn thiện module ghi nhận chi phí `cost_accounting` trên từng Job.
