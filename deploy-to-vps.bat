@echo off
setlocal enabledelayedexpansion
title Viprosell - Deploy Frontend to VPS
chcp 65001 >nul

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     VIPROSELL - DEPLOY FRONTEND LEN VPS (NGINX)     ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ============================================================
:: CAU HINH - chinh lai neu doi VPS
:: ============================================================
set VPS_IP=76.13.210.71
set VPS_USER=viprosell
set VPS_PORT=22
set VPS_WEBROOT=/srv/viprosell/dist
set DIST_DIR=D:\vidiosell\dist
set WORK_DIR=D:\vidiosell
:: ============================================================

cd /d "%WORK_DIR%"

:: --- BUOC 1: Build frontend moi nhat ---
echo  [1/4] Kiem tra ban build...
if not exist "%DIST_DIR%\index.html" (
    echo  [!] Chua co ban build. Dang build...
    call npm run build
    if errorlevel 1 (
        echo  [X] Build that bai! Kiem tra loi o tren.
        pause & exit /b 1
    )
    echo  [OK] Build thanh cong!
) else (
    echo  [OK] Da co ban build san. Neu muon build moi, xoa thu muc dist\ truoc.
)
echo.

:: --- BUOC 2: Ket noi VPS va tim web root ---
echo  [2/4] Ket noi VPS va detect Nginx web root...
echo.
echo  [INFO] Ban se duoc hoi nhap password VPS ngay sau lenh sau:
echo.
echo  Chay lenh tim web root...

:: Dung native ssh (co san Windows 10+) de tim web root tu dong
set "DETECT_CMD=sudo nginx -T 2>/dev/null | grep 'root ' | grep -v '#' | head -3 || echo 'DEFAULT:/var/www/html'"
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -p %VPS_PORT% %VPS_USER%@%VPS_IP% "%DETECT_CMD%" > "%TEMP%\vps_webroot.txt" 2>&1

set /p DETECT_RESULT=<"%TEMP%\vps_webroot.txt"
echo  [INFO] Ket qua detect: %DETECT_RESULT%

:: Neu detect duoc thu muc cu the tu nginx config
echo %DETECT_RESULT% | findstr "root " >nul 2>&1
if %errorlevel% == 0 (
    for /f "tokens=2" %%a in ("%DETECT_RESULT%") do set VPS_WEBROOT=%%a
    set VPS_WEBROOT=!VPS_WEBROOT:;=!
    echo  [OK] Nginx web root: !VPS_WEBROOT!
) else (
    echo  [!] Dung web root mac dinh: %VPS_WEBROOT%
)
echo.

:: --- BUOC 3: Upload file ---
echo  [3/4] Upload toan bo file dist len VPS...
echo  [INFO] Ban se duoc yeu cau nhap PASSWORD VPS mot lan nua.
echo.

:: Dung native scp upload toan bo thu muc dist
scp -o StrictHostKeyChecking=no -P %VPS_PORT% -r "%DIST_DIR%\." %VPS_USER%@%VPS_IP%:/tmp/viprosell_deploy/

if errorlevel 1 (
    echo.
    echo  [X] Upload that bai! Co the do:
    echo     - Sai password
    echo     - VPS khong cho phep password SSH (can bat PasswordAuthentication yes)
    echo     - Kiem tra lai IP VPS: %VPS_IP%
    echo.
    echo  === GIAI PHAP THAY THE: Deploy thu cong qua WinSCP ===
    echo  1. Tai WinSCP mien phi: https://winscp.net/
    echo  2. Mo WinSCP - chon SFTP - nhap IP: %VPS_IP%
    echo  3. User: %VPS_USER% - Password cua ban
    echo  4. Panel trai: chon thu muc D:\vidiosell\dist\
    echo  5. Panel phai: di den %VPS_WEBROOT%\
    echo  6. Chon tat ca file, keo sang phai (overwrite)
    echo  7. Sau khi xong, mo SSH terminal tren WinSCP va chay:
    echo     nginx -s reload
    echo.
    pause & exit /b 1
)

:: --- BUOC 4: Chuyen file vao web root va reload Nginx ---
echo.
echo  [4/4] Cap nhat web root va reload Nginx...
echo  [INFO] Ban co the duoc hoi password lan cuoi.
echo.

set "DEPLOY_CMD=mv %VPS_WEBROOT% %VPS_WEBROOT%_old 2>/dev/null; mkdir -p %VPS_WEBROOT% && cp -r /tmp/viprosell_deploy/* %VPS_WEBROOT%/ && chmod -R 755 %VPS_WEBROOT% && rm -rf /tmp/viprosell_deploy && echo '=== DEPLOY_SUCCESS ==='"

ssh -o StrictHostKeyChecking=no -p %VPS_PORT% %VPS_USER%@%VPS_IP% "%DEPLOY_CMD%"

if errorlevel 1 (
    echo  [X] Buoc cuoi that bai. Thu ssh vao VPS va chay thu cong:
    echo     cp -r /tmp/viprosell_deploy/* %VPS_WEBROOT%/
    echo     nginx -s reload
    pause & exit /b 1
)

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     DEPLOY THANH CONG! ^(^_^)                        ║
echo  ║     https://v.ninhle.com da duoc cap nhat           ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Kiem tra ngay: https://v.ninhle.com
echo.
pause
endlocal
