# Bản mẫu chuyển động 2,5D — đã chạy thật 01/11/2026

Thay `zoompan` phẳng bằng thị sai theo độ sâu: điểm gần máy quay dịch nhiều hơn
điểm xa, nên chủ thể tách khỏi nền thay vì trượt cùng một khối.

**Đây là bản mẫu, chưa nối vào worker.** Số đo bên dưới là đo thật trên máy dựng
hiện tại (32 nhân), chưa đo trên KVM 4.

## Số đo

| Việc | Kết quả |
|---|---|
| Sinh bản đồ độ sâu (Depth Anything V2 Small, ONNX, CPU 4 luồng, vào 518×518) | **0,25 giây/ảnh** |
| Dựng thị sai bằng numpy, 1080×1920 | 333 ms/khung → **300 giây** cho video 30 giây |
| Dựng thị sai **thuần ffmpeg** (`geq` + `displace`), 1080×1920 | **34 ms/khung** → **31 giây** cho video 30 giây |
| Nền so sánh: `zoompan` hiện tại | 15,5 giây cho video 20 giây (~23 giây nếu quy về 30 giây) |

Kết luận: **phải dựng bằng ffmpeg, không dựng bằng Python.** Chênh 10 lần.
Thị sai làm tăng khoảng gấp đôi thời gian CPU mỗi video — tiền mặt vẫn 0₫ vì VPS
trả phẳng, nhưng công suất render giảm một nửa.

## Bước 1 — bản đồ độ sâu

```bash
python do_sau.py <model.onnx> <anh_vao.png> <ban_do_ra.png> 518
```

Mô hình: `onnx-community/depth-anything-v2-small`, tệp `onnx/model.onnx` (94,5 MB),
giấy phép **Apache 2.0** — *đọc lại tệp LICENSE trước khi đưa vào bản chạy thật.*

Đầu ra là **độ sâu nghịch**: giá trị LỚN = GẦN máy quay. Dùng thẳng quy ước đó.

> ⚠️ **onnxruntime 1.31.1 segfault khi `intra_op_num_threads = 32`.** Chạy tốt ở
> 1, 4 và 8. Script đã chặn trần ở 4. KVM 4 chỉ có 4 nhân nên vô tình an toàn,
> nhưng máy dựng ở nhà thì chết.

## Bước 2 — dựng thị sai bằng ffmpeg

```bash
ffmpeg -y \
 -loop 1 -framerate 30 -t 3 -i anh.png \
 -loop 1 -framerate 30 -t 3 -i ban_do_do_sau.png \
 -filter_complex "\
[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=rgb24[src];\
[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,format=gray[d];\
[d]split=2[dx][dy];\
[dx]geq=lum='128+(lum(X,Y)-128)*0.55*sin(T*3.14159/6)'[xm];\
[dy]geq=lum='128-(lum(X,Y)-128)*0.19*sin(T*3.14159/6)'[ym];\
[src][xm][ym]displace=edge=smear[v]" \
 -map "[v]" -c:v libx264 -preset faster -crf 18 -pix_fmt yuv420p -r 30 ra.mp4
```

`displace` quy ước mức xám 128 = không dịch, nên hệ số nhân chính là biên độ:
`0.55` cho ra tới ±70 px.

## Bốn điều hỏng đã phát hiện — đọc trước khi nối vào worker

1. **Phóng hình nuốt mất thị sai.** Giữ `zoompan` 1,05 làm mép khung dịch ~46 px,
   trong khi thị sai chỉ ±15 px, nên kết quả nhìn ra y hệt Ken Burns cũ.
   **Bỏ phóng hoặc hạ rất nhỏ khi bật 2,5D.**

2. **Biên độ lớn làm rách mép.** Ở ±70 px, cổ áo bị kéo giãn thấy rõ vì không có
   thông tin phía sau chủ thể. **Ước chừng an toàn ±20–30 px**, cần dò ngưỡng thật.

3. **Nền phẳng thì gần như không được gì.** Thị sai lộ ra nhờ nền có vân để so.
   Ảnh sản phẩm trên nền trắng trơn — rất phổ biến ở shop — không hưởng lợi.
   **Bật có điều kiện, không bật đại trà.** Cách dò: đo độ lệch chuẩn mức xám của
   vùng có độ sâu thấp; dưới ngưỡng thì không bật.

4. **Chênh lệch điểm ảnh KHÔNG đo được dịch chuyển.** Vùng phẳng (áo đen trơn)
   dịch bao nhiêu cũng cho chênh lệch gần 0. Lần đầu tôi đo bằng cách này và kết
   luận sai rằng thị sai chạy ngược. Muốn kiểm thì nhìn, hoặc tính dịch chuyển
   theo công thức, đừng lấy `|a−b|`.

## Còn thiếu

- Chưa đo trên KVM 4 (chưa có máy).
- Chưa dò ngưỡng biên độ an toàn theo từng loại ảnh.
- Chưa có cổng tự quyết định khi nào nên bật.
- Chưa nối vào `render.worker.ts`.
