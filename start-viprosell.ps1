# start-viprosell.ps1
# Script khởi động toàn bộ hạ tầng Local AI Video Render cho Viprosell

echo "================================================="
echo "   KHOI DONG HE THONG VIPROSELL LOCAL AI         "
echo "================================================="

# 1. Ollama AI Model (Port 11435)
echo "[1/5] Starting Ollama AI Service (Port 11435)..."
Start-Process cmd -ArgumentList "/c `"set OLLAMA_HOST=127.0.0.1:11435 && ollama serve`"" -WindowStyle Normal

# Đợi Ollama khởi động
Start-Sleep -Seconds 3

# 2. Backend API
echo "[2/5] Starting Backend API (Port 3001)..."
Start-Process cmd -ArgumentList "/k `"cd D:\vidiosell\backend && npx tsx src/server.ts`"" -WindowStyle Normal

# 3. Render Worker (AI Pipeline + FFmpeg + NVENC)
echo "[3/5] Starting Render Worker (AI + FFmpeg GPU)..."
Start-Process cmd -ArgumentList "/k `"cd D:\vidiosell\backend && npx tsx src/render.worker.ts`"" -WindowStyle Normal

# 4. Frontend Web
echo "[4/5] Starting Frontend Web..."
Start-Process cmd -ArgumentList "/k `"cd D:\vidiosell && npm run dev`"" -WindowStyle Normal

# 5. Cloudflare Tunnel (Tunnel port 3001 ra api.ninhle.com)
echo "[5/5] Starting Cloudflare Tunnel..."
Start-Process cmd -ArgumentList "/k `"cloudflared tunnel run vidiosell`"" -WindowStyle Normal

echo "================================================="
echo " He thong da duoc khoi dong tren cac cua so moi!"
echo " - Ollama AI     : http://localhost:11435"
echo " - Backend API   : http://localhost:3001"
echo " - Frontend Web  : http://localhost:5173"
echo " - Cloudflare    : api.ninhle.com"
echo "================================================="
