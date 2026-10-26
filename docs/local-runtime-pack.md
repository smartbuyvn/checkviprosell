# Local Runtime Pack

Toàn bộ sức mạnh tính toán (Ollama AI, FFmpeg Render, Video Queue) nằm chết trên PC/Server vật lý của bạn. API Cloud chỉ làm nhiệm vụ giao tiếp dữ liệu.

## Các Node Chạy Đồng Thời:
1. **Redis Server**: Trạm trung chuyển dữ liệu Queue. Chạy bằng Docker (`docker compose up redis -d`).
2. **Ollama**: Nền tảng Local LLM xử lý Product Intelligence và Script, mapping port `11434`.
3. **API Fastify (`backend`)**: Web server chính nhận lệnh từ mảng Frontend và điều phối.
4. **AI Worker**: Node detached chuyên rút event sinh Script.
5. **Render Worker**: Node detached chuyên kích hoạt chip đồ họa/CPU để chạy FFmpeg.

*Mọi logic "Web ảo" hay "Render trên mạng" đều đã bị tắt theo đúng yêu cầu Local-First.*
