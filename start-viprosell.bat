@echo off
title Viprosell Local AI System Boot
echo =================================================
echo    KHOI DONG HE THONG VIPROSELL LOCAL AI         
echo =================================================

:: 1. Ollama AI Model (Port 11435 theo .env)
echo [1/5] Starting Ollama AI Service (Port 11435)...
:: Khoi dong Ollama serve voi bien moi truong rieng de lang nghe tren port 11435
start "Viprosell Ollama AI" cmd /c "set OLLAMA_HOST=127.0.0.1:11435 && ollama serve"
:: Cho 3 giay de Ollama kip khoi dong truoc khi start backend
timeout /t 3 /nobreak >nul

:: 2. Backend API
echo [2/5] Starting Backend API (Port 3001)...
start "Viprosell Backend API" cmd /k "cd backend && npm run start"

:: 3. Render Worker (AI Pipeline + FFmpeg + NVENC)
echo [3/5] Starting Render Worker (AI + FFmpeg GPU)...
start "Viprosell Render Worker" cmd /k "cd backend && npm run worker:all"

:: 4. Frontend Web (Port 5173 / 8080)
echo [4/5] Starting Frontend...
start "Viprosell Frontend" cmd /k "npm run dev"

:: 5. Cloudflare Tunnel
echo [5/5] Starting Cloudflare Tunnel...
start "Viprosell Cloudflare Tunnel" cmd /k "cloudflared tunnel run vidiosell"

echo =================================================
echo  He thong da duoc khoi dong vao cac cua so rieng biet!
echo  - Ollama AI     : http://localhost:11435
echo  - Backend API   : http://localhost:3001
echo  - Frontend Web  : http://localhost:5173
echo  - Cloudflare    : api.ninhle.com (hoac theo config tunnel)
echo =================================================
pause
