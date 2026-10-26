# Viprosell — Dedicated Ollama instance pinned to GPU 1 (RTX 3060 Ti 8GB)
# Port 11435 — separate from the shared instance on 11434 (NOVA/Ninhclaw untouched).
# Model store is shared (~/.ollama/models), so qwen2.5:7b is available immediately.
#
# Usage:  powershell -ExecutionPolicy Bypass -File ops/ollama-gpu1.ps1
# Verify: curl http://localhost:11435/api/tags

$env:CUDA_VISIBLE_DEVICES = "1"
$env:OLLAMA_HOST = "127.0.0.1:11435"
$env:OLLAMA_KEEP_ALIVE = "30m"

Write-Host "Starting dedicated Ollama on 127.0.0.1:11435 (GPU 1: RTX 3060 Ti 8GB)..." -ForegroundColor Green

# First run: ensure model is pulled (shared store — skips if present)
ollama pull qwen2.5:7b

Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden

Start-Sleep -Seconds 4
try {
    $tags = Invoke-RestMethod -Uri "http://localhost:11435/api/tags" -TimeoutSec 5
    Write-Host "OK — Ollama GPU-1 instance up. Models:" -ForegroundColor Green
    $tags.models | ForEach-Object { Write-Host "  - $($_.name)" }
} catch {
    Write-Warning "Instance may still be starting. Retry: curl http://localhost:11435/api/tags"
}