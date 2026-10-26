# Go With Constraints (Final)

Dấu ấn ký khóa vòng đời Release Candidate 1. Hệ thống đã quét Sạch Sẽ (Repository Freeze + Cleanup Gate Passed).

## QUYẾT ĐỊNH: GO FOR BETA (WITH FIRM CONSTRAINTS)

### Danh Sách Constraint Áp Thêm Gánh Nặng Cho Operator:
1. **Hostinger Stateless Limits**: Front-end chỉ được lưu trữ dạng HTML tĩnh, SEO ban đầu sẽ phụ thuộc bot parse Javascript. Không thể nhồi Server-Side Code vào Shared Hosting này. Phải chấp nhận.
2. **Local Workstation Vulnerability**: Điện cúp, mạng đứt, tắt PC => API Render Video tại nhà sập ngỏm. Stripe Webhook sẽ nhả Warning (nhưng không mất tiền vì Stripe lưu event retry). Operator phải theo cắm `docs/local-services-boot-order.md` mỗi lần bật máy lại.
3. **Hardware Scaling Wall**: Backend là Node.js Async non-blocking chịu tải hàng nghìn API Calls dễ dàng, NHƯNG `render.worker.ts` thì gọi `exec FFmpeg` bằng CPU. Chỉ 2-3 Request Render cùng lúc sẽ ngốn 100% RAM/CPU của Operator. Bắt buộc Operator phải điều phối User Growth (Marketing) cho phù hợp với phần cứng trong nhà ở Beta.

Toàn bộ những hạng mục này đều là Trade-off của yêu cầu cốt lõi ban đầu: "Local-first, không trả tiền thuê Cloud AI/GPU". Chấp nhận. Không còn Blocker Code logic nào gián đoạn luồng Business Payment hay Asset Manipulation.
