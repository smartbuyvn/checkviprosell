# ==============================================================================
# Viprosell — Render Worker (máy nhà)
#
# Kiến trúc chốt 24/10: VPS chỉ chạy API + web tĩnh. Render và TTS chạy ở đây.
# Lý do: VPS Hostinger KVM 2 chỉ có 2 vCPU và chạy chung với NOVA (giao dịch
# tiền thật) + NinhClaw; một video render trên đó mất 3-4,5 phút và tranh CPU
# với NOVA, trong khi ở máy này chỉ mất ~30 giây.
#
# Worker tự gọi ra lấy việc qua Supabase Realtime — không cần mở cổng vào máy.
#
# Dùng: bấm phải -> Run with PowerShell, hoặc:  powershell -File start-render-worker.ps1
# Dừng: Ctrl+C
# ==============================================================================

$ErrorActionPreference = 'Stop'
$Root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root 'backend'
$LogDir  = Join-Path $Root 'logs'
$LogFile = Join-Path $LogDir ("render-worker-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))

function Say($msg, $color = 'Gray') { Write-Host "  $msg" -ForegroundColor $color }

Write-Host ""
Write-Host "  VIPROSELL - RENDER WORKER" -ForegroundColor Cyan
Write-Host "  =========================" -ForegroundColor Cyan
Write-Host ""

# ─── Kiểm tra điều kiện trước khi chạy ───────────────────────────────────────
$fail = $false

if (-not (Test-Path (Join-Path $Backend 'node_modules'))) {
  Say "THIEU node_modules. Chay: cd backend; npm install" 'Red'; $fail = $true
} else { Say "node_modules: OK" 'Green' }

$ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ff) { Say "THIEU ffmpeg trong PATH" 'Red'; $fail = $true }
else { Say "ffmpeg: $((& ffmpeg -version 2>$null | Select-Object -First 1) -replace '^ffmpeg version ','' -replace ' .*','')" 'Green' }

$envFile = Join-Path $Backend '.env'
if (-not (Test-Path $envFile)) {
  Say "THIEU backend/.env" 'Red'; $fail = $true
} else {
  # Chi kiem tra BIEN CO MAT, khong in gia tri
  $envText = Get-Content $envFile -Raw
  foreach ($k in @('SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','INTERNAL_CALLBACK_SECRET','RENDER_CALLBACK_URL')) {
    if ($envText -notmatch "(?m)^\s*$k\s*=\s*\S") { Say "THIEU bien $k trong backend/.env" 'Red'; $fail = $true }
  }
  if (-not $fail) { Say "backend/.env: du bien bat buoc" 'Green' }

  # Canh bao neu callback van tro ve localhost (worker o nha goi localhost la sai)
  if ($envText -match '(?m)^\s*RENDER_CALLBACK_URL\s*=\s*.*localhost') {
    Say "CANH BAO: RENDER_CALLBACK_URL dang tro ve localhost." 'Yellow'
    Say "          Worker o may nha phai goi ve API tren VPS, neu khong" 'Yellow'
    Say "          ket qua render khong bao duoc ve. Sua thanh:" 'Yellow'
    Say "          https://v.ninhle.com/api/v1/render/callback" 'Yellow'
  }
  if ($envText -notmatch '(?m)^\s*ALLOWED_ASSET_HOSTS\s*=') {
    Say "CHU Y: chua co ALLOWED_ASSET_HOSTS. Host cua SUPABASE_URL duoc tu them," 'Yellow'
    Say "       nen anh trong Supabase Storage van tai duoc; anh o host khac bi chan." 'Yellow'
  }
}

if ($fail) { Write-Host ""; Say "Dung lai vi thieu dieu kien o tren." 'Red'; Write-Host ""; exit 1 }

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
Write-Host ""
Say "Log: $LogFile"
Say "Dung bang Ctrl+C"
Write-Host ""

# ─── Vòng chạy, tự khởi động lại khi worker thoát ────────────────────────────
# Backoff tăng dần để không quay vòng liên tục khi lỗi cấu hình.
$delay = 5
$maxDelay = 120
$runs = 0

while ($true) {
  $runs++
  $stamp = Get-Date -Format 'HH:mm:ss'
  Say "[$stamp] Khoi dong worker (lan $runs)..." 'Cyan'
  Add-Content -Path $LogFile -Value "=== [$((Get-Date).ToString('s'))] start #$runs ===" -Encoding utf8

  Push-Location $Backend
  try {
    # Ghi log bang UTF-8. Tee-Object -Append tren Windows PowerShell ghi UTF-16,
    # lam file log day ky tu NUL va khong grep duoc.
    & npx tsx src/render.worker.ts 2>&1 | ForEach-Object {
      Write-Host $_
      Add-Content -Path $LogFile -Value $_ -Encoding utf8
    }
    $code = $LASTEXITCODE
  } catch {
    $code = -1
    Add-Content -Path $LogFile -Value "EXCEPTION: $($_.Exception.Message)" -Encoding utf8
  } finally {
    Pop-Location
  }

  $stamp = Get-Date -Format 'HH:mm:ss'
  if ($code -eq 0) {
    Say "[$stamp] Worker thoat binh thuong (ma 0). Dung." 'Green'
    break
  }

  Say "[$stamp] Worker thoat voi ma $code. Chay lai sau $delay giay..." 'Yellow'
  Start-Sleep -Seconds $delay
  $delay = [Math]::Min($delay * 2, $maxDelay)
}
