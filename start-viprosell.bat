@echo off
setlocal enabledelayedexpansion
title Viprosell Render Worker
cd /d "%~dp0"

:: ===================================================================
::  VIPROSELL - KHOI DONG MAY RENDER
::
::  May nay chay DUY NHAT render worker. API va trang web nam tren VPS
::  (v.ninhle.com) nen KHONG khoi dong backend hay frontend o day nua.
::  Cung khong chay Cloudflare Tunnel: api.ninhle.com da ngung dung, va
::  worker goi RA de lay viec chu khong nhan ket noi vao.
::
::  Script kiem tra het dieu kien TRUOC khi chay. Thieu thu gi thi dung
::  han va noi ro thieu gi, thay vi chay roi hong giua chung sau khi da
::  render mat vai phut.
::  Spec: docs/Viprosell_SPEC_V3_2026-10-27.md
:: ===================================================================

set ERRORS=0
set WARNS=0

echo.
echo  ==================================================
echo     VIPROSELL - KIEM TRA TRUOC KHI CHAY
echo  ==================================================
echo.

echo  [1/9] Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo         [X] Khong tim thay Node.js. Cai tai https://nodejs.org
  set /a ERRORS+=1
) else (
  for /f "tokens=*" %%v in ('node --version') do echo         [OK] Node %%v
)

echo  [2/9] Thu vien backend
if exist "backend\node_modules" (
  echo         [OK] node_modules da co
) else (
  echo         [X] Thieu backend\node_modules. Chay: cd backend ^&^& npm install
  set /a ERRORS+=1
)

echo  [3/9] FFmpeg
where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo         [X] Khong tim thay ffmpeg trong PATH
  set /a ERRORS+=1
) else (
  for /f "tokens=3" %%v in ('ffmpeg -version 2^>nul ^| findstr /B "ffmpeg version"') do echo         [OK] ffmpeg %%v
  ffmpeg -version 2>nul | findstr /C:"enable-libx264" >nul
  if errorlevel 1 (
    echo         [X] ffmpeg thieu libx264 - khong ma hoa video duoc
    set /a ERRORS+=1
  ) else (
    echo         [OK] libx264
  )
  ffmpeg -version 2>nul | findstr /C:"enable-libass" >nul
  if errorlevel 1 (
    echo         [X] ffmpeg thieu libass. PHU DE SE KHONG HIEN ma ffmpeg
    echo             van bao render thanh cong. Phai doi ban ffmpeg khac.
    set /a ERRORS+=1
  ) else (
    echo         [OK] libass
  )
)

echo  [4/9] backend\.env
if not exist "backend\.env" (
  echo         [X] Khong co backend\.env. Chep tu backend\.env.example roi dien gia tri.
  set /a ERRORS+=1
) else (
  for %%K in (SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY RENDER_CALLBACK_URL INTERNAL_CALLBACK_SECRET) do (
    findstr /R /B /C:"%%K=..*" "backend\.env" >nul 2>&1
    if errorlevel 1 (
      echo         [X] Thieu hoac de trong: %%K
      set /a ERRORS+=1
    ) else (
      echo         [OK] %%K
    )
  )
)

echo  [5/9] Font phu de
set ASSFONT=Montserrat
for /f "tokens=2 delims==" %%f in ('findstr /R /B /C:"ASS_FONT_NAME=..*" "backend\.env" 2^>nul') do set ASSFONT=%%f
for /f %%r in ('powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; $n=(New-Object System.Drawing.Text.InstalledFontCollection).Families.Name; if ($n -contains $env:ASSFONT) {'YES'} else {'NO'}" 2^>nul') do set FONTOK=%%r
if "!FONTOK!"=="YES" (
  echo         [OK] Font "!ASSFONT!" da cai
) else (
  echo         [!] Khong thay font "!ASSFONT!". libass se tu thay font khac
  echo             va CO THE MAT DAU TIENG VIET. Sua: dat ASS_FONT_NAME=Arial
  echo             trong backend\.env
  set /a WARNS+=1
)

echo  [6/9] Dung luong trong
for /f %%g in ('powershell -NoProfile -Command "[int]((Get-PSDrive (Get-Location).Drive.Name).Free/1GB)" 2^>nul') do set FREEGB=%%g
if "!FREEGB!"=="" set FREEGB=0
if !FREEGB! LSS 5 (
  echo         [!] Chi con !FREEGB! GB. Moi video ~12 MB, file tam con lon hon.
  set /a WARNS+=1
) else (
  echo         [OK] Con !FREEGB! GB
)
if not exist "renders_output" mkdir "renders_output"

echo  [7/9] Ket noi Supabase
for /f "tokens=2 delims==" %%u in ('findstr /R /B /C:"SUPABASE_URL=..*" "backend\.env" 2^>nul') do set SUPAURL=%%u
if "!SUPAURL!"=="" (
  echo         [X] Khong doc duoc SUPABASE_URL
  set /a ERRORS+=1
) else (
  for /f %%c in ('curl -s -o nul -w "%%{http_code}" --max-time 12 "!SUPAURL!/rest/v1/" 2^>nul') do set SUPACODE=%%c
  if "!SUPACODE!"=="000" (
    echo         [X] Khong ket noi duoc Supabase. Kiem tra mang.
    set /a ERRORS+=1
  ) else (
    echo         [OK] Supabase tra loi HTTP !SUPACODE!
  )
)

echo  [8/9] Backend VPS - noi worker bao ket qua ve
for /f "tokens=2 delims==" %%u in ('findstr /R /B /C:"RENDER_CALLBACK_URL=..*" "backend\.env" 2^>nul') do set CBURL=%%u
for /f %%c in ('curl -s -o nul -w "%%{http_code}" --max-time 12 "https://v.ninhle.com/api/v1/billing/summary" 2^>nul') do set APICODE=%%c
if "!APICODE!"=="000" (
  echo         [X] Khong goi duoc API. Worker se render xong nhung
  echo             KHONG bao ket qua ve duoc, video coi nhu mat.
  set /a ERRORS+=1
) else (
  if "!APICODE!"=="401" (
    echo         [OK] API song ^(401 = chua dang nhap, dung nhu mong doi^)
  ) else (
    echo         [!] API tra ve HTTP !APICODE!, mong doi 401
    set /a WARNS+=1
  )
)

echo  [9/9] Ollama - tuy chon
where ollama >nul 2>&1
if errorlevel 1 (
  echo         [-] Khong co Ollama. Khong sao, he thong dung Gemini.
) else (
  curl -s -o nul --max-time 3 "http://127.0.0.1:11435/api/tags" >nul 2>&1
  if errorlevel 1 (
    echo         [..] Dang khoi dong Ollama tren cong 11435
    start "Viprosell Ollama" /min cmd /c "set OLLAMA_HOST=127.0.0.1:11435 && ollama serve"
    ping -n 5 127.0.0.1 >nul
  ) else (
    echo         [OK] Ollama dang chay
  )
)

echo.
echo  ==================================================
if !ERRORS! GTR 0 (
  echo     DUNG LAI - con !ERRORS! loi phai sua
  echo  ==================================================
  echo.
  echo   Khong khoi dong worker khi con loi: chay tiep chi lam
  echo   hong video giua chung roi kho tim nguyen nhan.
  echo.
  pause
  exit /b 1
)
if !WARNS! GTR 0 (
  echo     SAN SANG - co !WARNS! canh bao o tren
) else (
  echo     SAN SANG - tat ca dieu kien dat
)
echo  ==================================================
echo.
echo   Worker se tu chay lai neu bi dung dot ngot.
echo   Dong cua so nay de tat han.
echo.
ping -n 4 127.0.0.1 >nul

:: ===================================================================
::  BIEN DICH LAI TRUOC KHI CHAY
::
::  `npm run worker:render` chay dist\render.worker.js, KHONG phai src.
::  Ngay 03/11/2026 dist\ la ban cua 01/11 — cu hon src hai ngay va khong
::  he co ma hang doi co khoa. Bat HANG_DOI_LEASE roi khoi dong voi dist cu
::  thi co KHONG CO TAC DUNG GI, va phep thu chung minh sai ma khong ai biet.
::
::  Build mat ~20 giay va chi chay mot lan moi lan mo script, khong chay
::  lai trong vong tu khoi dong lai.
:: ===================================================================
echo   Bien dich lai backend...
cd /d "%~dp0backend"
call npm run build
if errorlevel 1 (
  echo.
  echo   [X] Bien dich that bai. KHONG chay worker voi dist cu — no se
  echo       chay ma cu ma khong bao gi.
  echo.
  pause
  exit /b 1
)
echo   [OK] Da bien dich
echo.

:: ===================================================================
::  HANG DOI CO KHOA
::
::  Bat tu 03/11/2026. Worker nhan job qua nhan_job_render() dung
::  FOR UPDATE SKIP LOCKED, thay vi `select where status='pending'` khong
::  khoa gi. Moi lenh ghi kem attempt_id nen worker mat lease khong ghi de
::  duoc ket qua cua attempt moi. reclaimStuckJobs nghi — RPC tu nhan lai
::  job het lease trong cung mot cau.
::
::  TAT: doi thanh 0, hoac xoa dong duoi. Worker in ro dang chay duong nao
::  ngay luc khoi dong, nen khong can doan.
:: ===================================================================
set HANG_DOI_LEASE=1

set RESTARTS=0
:worker_loop
cd /d "%~dp0backend"
call npm run worker:render
set /a RESTARTS+=1
echo.
echo  [!] Worker da dung - lan thu !RESTARTS!. Chay lai sau 10 giay.
echo      Bam Ctrl+C de thoat han.
ping -n 11 127.0.0.1 >nul
goto worker_loop
