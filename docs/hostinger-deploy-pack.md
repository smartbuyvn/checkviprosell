# Hostinger Deploy Pack

## Architecture Context
Viprosell's Frontend is a React SPA (Vite). Hostinger Shared/Premium Hosting **does not run Node.js** robustly for our FFmpeg/BullMQ needs. Therefore, Hostinger acts **strictly as a static CDN** serving the HTML/JS/CSS.

## Static Boundaries
- **No SSR (Server-Side Rendering)**: The app boots in the user's browser.
- **Routing**: Because it's an SPA, if a user directly visits `https://vidiosell.vn/dashboard`, Apache would normally throw a 404. The `public/.htaccess` file intercepts this and redirects to `index.html`.
- **API Proxy**: Frontend does NOT connect to `localhost`. It talks to your self-hosted API via a secure ingress tunnel (e.g., Cloudflare Tunnel mapping `https://api.vidiosell.vn` -> `localhost:3001`).
