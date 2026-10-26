# Local Services Boot Order

Khi server local bị sập do cúp điện, hãy khởi động lại theo thứ tự sau để tránh Crash-Loop:

1. [ ] **Boot Redis**: `docker compose -f docker-compose.dev.yml up redis -d`
2. [ ] **Boot Ollama**: Bật app Ollama, load model `qwen2.5:7b` (chạy ngầm).
3. [ ] **Boot Background API**: 
   - `cd backend`
   - `npm run start` (Chờ thông báo `Status: ok` trên port 3001)
4. [ ] **Khởi động AI Queue**:
   - Mở terminal khác, `cd backend`
   - `npm run worker:ai`
5. [ ] **Khởi động Render Queue**:
   - Mở terminal khác, `cd backend`
   - `npm run worker:render`
6. [ ] **Boot Ingress (Cloudflare Tunnel)**:
   - Command ví dụ: `cloudflared tunnel run vidiosell` để mapping internet `api.vidiosell.vn` vào `localhost:3001`.
