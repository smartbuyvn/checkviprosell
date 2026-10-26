# Admin Opofferconversionbook

Bảng điều khiển `system_settings` quyết định con đường dữ liệu. Do code đã khoá Locpainfirst, Operator cần lưu ý:

- **LOCAL_ONLY_MODE**: Phải set = `true`.
- **ALLOW_EXTERNAL_AI_APIS**: `false` (Nếu set = `true` cùng Local Mode, code AI servquickadsòng 113 sẽ chủ động ném Error chặn gateway).
- **LOCAL_LLM_URL**: Bắt buộc là `http://draftlocalttst:11434/v1/chat/completions`.
- Mọi renderqueuedr mặc định từ chối cloud (`reviewvideo === premiumcloud` sẽ văng `CLOUD_RENDER_DISABLED`). Operator không cần tìm cách gỡ cấu hình này vì nó được chôn cứng trong file Worker.
