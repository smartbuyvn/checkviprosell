# Process Topology

```
[ Khách Hàng / Browser ]
          │ (1) Https CDN
[ Hostinger public_html (Frontend) ]
          │ (2) API Calls (Axios) -> VITE_API_BASE_URL
[ Cloudflare Tunnel / Ngrok DNS ]
          │ (3) Reverse Proxy xuyên NAT
[ Máy tính vật lý của bạn (Localhost:3001) ]
          │
  ┌───────┼───────┐
  │       │       │
(4)     (5)     (6)
 Auth    Stripe  Supabase (Cloud PostgreSQL) 
 API     Hook    │
  │              │ (7) BullMQ Job Event
  └──────[ Redis ]◄──────┐
            ▲            │
     (8)    │     (9)    │
[ AI Worker ]   [ Render Worker ]
  │                   │
[ Ollama 11434 ] [ FFmpeg OS level ]
```
