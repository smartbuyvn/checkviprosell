# ViproSell — Local Environment Validator
# Run from repo root: .\scripts\validate-local.ps1
# Checks that all required services are running before starting development.

$pass = 0
$fail = 0

function Check($name, $block) {
    try {
        $result = & $block
        Write-Host "  [OK] $name" -ForegroundColor Green
        $script:pass++
        return $result
    } catch {
        Write-Host "  [FAIL] $name — $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
        return $null
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ViproSell Local Validation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Backend health (Redis + DB)
Write-Host "1. Backend (Fastify on :3001)" -ForegroundColor White
$health = Check "Backend /health" {
    $r = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 3 -ErrorAction Stop
    $body = $r.Content | ConvertFrom-Json
    if ($body.redis -ne "up") { throw "redis status: $($body.redis)" }
    "redis=$($body.redis)"
}

# 2. Ollama
Write-Host ""
Write-Host "2. Ollama (LLM on :11434)" -ForegroundColor White
$ollama = Check "Ollama /api/tags" {
    $r = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 3 -ErrorAction Stop
    $body = $r.Content | ConvertFrom-Json
    $models = $body.models | ForEach-Object { $_.name }
    $hasModel = $models | Where-Object { $_ -match "qwen2.5" }
    if (-not $hasModel) { Write-Host "    WARNING: qwen2.5:7b not found. Run: ollama pull qwen2.5:7b" -ForegroundColor Yellow }
    "models: $($models -join ', ')"
}

# 3. Supabase REST
Write-Host ""
Write-Host "3. Supabase (local on :54321)" -ForegroundColor White
$anonKey = ""
if (Test-Path ".env") {
    $envContent = Get-Content ".env" | Where-Object { $_ -match "VITE_SUPABASE_ANON_KEY=" }
    if ($envContent) {
        $anonKey = ($envContent -replace "VITE_SUPABASE_ANON_KEY=","").Trim()
    }
}

Check "Supabase REST /rest/v1/" {
    $headers = @{}
    if ($anonKey) { $headers["apikey"] = $anonKey }
    
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:54321/rest/v1/" -Headers $headers -TimeoutSec 3 -ErrorAction Stop
        "HTTP $($r.StatusCode)"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 400) {
            "HTTP $($_.Exception.Response.StatusCode) (Port open and serving REST API)"
        } else {
            throw $_
        }
    }
}

# 4. Redis (via Docker exec)
Write-Host ""
Write-Host "4. Redis (Docker on :6379)" -ForegroundColor White
Check "Redis PING" {
    $containerId = docker ps -qf "name=redis" 2>$null
    if (-not $containerId) { throw "No running Redis container found" }
    $pong = docker exec $containerId redis-cli ping 2>&1
    if ($pong -ne "PONG") { throw "Expected PONG, got: $pong" }
    "PONG"
}

# 5. FFmpeg
Write-Host ""
Write-Host "5. FFmpeg (required for render worker)" -ForegroundColor White
Check "ffmpeg in PATH" {
    $ff = ffmpeg -version 2>&1 | Select-Object -First 1
    if (-not $ff) { throw "ffmpeg not found. Install from https://ffmpeg.org and add to PATH" }
    $ff
}

# 6. Frontend (Vite)
Write-Host ""
Write-Host "6. Frontend default: http://localhost:8080 (Vite default in this repo). If port 8080 is occupied, Vite may fall back to another available port such as http://localhost:8081." -ForegroundColor White
Check "Frontend :8080" {
    $r = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 3 -ErrorAction Stop
    "HTTP $($r.StatusCode)"
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($fail -gt 0) {
    Write-Host "  RESULT: $pass passed, $fail FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Fix failures above, then re-run: .\scripts\validate-local.ps1" -ForegroundColor Yellow
} else {
    Write-Host "  RESULT: All $pass checks passed ✅" -ForegroundColor Green
    Write-Host "  System is ready for local development." -ForegroundColor Green
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
