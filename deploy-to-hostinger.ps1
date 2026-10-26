#!/usr/bin/env pwsh
# ================================================================
# deploy-to-hostinger.ps1
# Deploy frontend build lên Hostinger qua FTP
# 
# CÁCH DÙNG:
#   .\deploy-to-hostinger.ps1 -Password "your_ftp_password"
#
# FTP Credentials thường lấy từ:
#   hPanel → Hosting → FTP Accounts
# ================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$Password,
    [string]$FtpHost   = "ftp.ninhle.com",
    [string]$FtpUser   = "u123456789",       # Thay bằng FTP username từ hPanel
    [string]$RemotePath = "/public_html",
    [string]$LocalDist  = "D:\vidiosell\dist"
)

$ErrorActionPreference = "Stop"

Write-Host @"
╔══════════════════════════════════════════════════════════╗
║   VIPROSELL — Deploy Frontend to Hostinger via FTP     ║
╠══════════════════════════════════════════════════════════╣
║  FTP Host: $FtpHost
║  User    : $FtpUser
║  Remote  : $RemotePath
║  Local   : $LocalDist
╚══════════════════════════════════════════════════════════╝
"@

# Validate dist folder
if (-not (Test-Path "$LocalDist\index.html")) {
    Write-Host "❌ ERROR: dist/index.html not found. Run 'npm run build' first!" -ForegroundColor Red
    exit 1
}

# Verify API URL in bundle
$bundleFile = Get-ChildItem "$LocalDist\assets" -Filter "index-*.js" | Select-Object -First 1
if ($bundleFile) {
    $content = Get-Content $bundleFile.FullName -Raw
    $apiUrl = [regex]::Match($content, 'https://[a-z.]+/api/v1').Value
    Write-Host "✅ API URL baked in bundle: $apiUrl"
    if ($apiUrl -notlike "*api.ninhle.com*") {
        Write-Host "⚠️  WARNING: API URL is not api.ninhle.com! Rebuild with correct .env" -ForegroundColor Yellow
    }
}

# Get all files to upload
$files = Get-ChildItem $LocalDist -Recurse -File
Write-Host "`n📁 Files to upload: $($files.Count)"

# FTP Upload function
function Upload-FTP {
    param($localFile, $remoteUrl, $user, $pass)
    
    $request = [System.Net.FtpWebRequest]::Create($remoteUrl)
    $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $request.Credentials = New-Object System.Net.NetworkCredential($user, $pass)
    $request.UseBinary = $true
    $request.UsePassive = $true
    $request.EnableSsl = $false
    $request.KeepAlive = $true
    
    $fileContent = [System.IO.File]::ReadAllBytes($localFile)
    $request.ContentLength = $fileContent.Length
    
    $stream = $request.GetRequestStream()
    $stream.Write($fileContent, 0, $fileContent.Length)
    $stream.Close()
    
    $response = $request.GetResponse()
    $response.Close()
}

function Create-FTPDir {
    param($remoteUrl, $user, $pass)
    try {
        $request = [System.Net.FtpWebRequest]::Create($remoteUrl)
        $request.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
        $request.Credentials = New-Object System.Net.NetworkCredential($user, $pass)
        $request.UsePassive = $true
        $response = $request.GetResponse()
        $response.Close()
    } catch {
        # Directory may already exist - ignore error
    }
}

$ftpBase = "ftp://$FtpHost$RemotePath"
$successCount = 0
$failCount = 0

Write-Host "`n🚀 Starting upload..." -ForegroundColor Cyan

foreach ($file in $files) {
    # Get relative path from dist folder
    $relativePath = $file.FullName.Replace($LocalDist, "").Replace("\", "/")
    $remoteUrl = "$ftpBase$relativePath"
    
    # Create parent directory if needed
    $parentDir = Split-Path $remoteUrl -Parent
    if ($parentDir -ne $ftpBase) {
        Create-FTPDir -remoteUrl $parentDir -user $FtpUser -pass $Password
    }
    
    try {
        Upload-FTP -localFile $file.FullName -remoteUrl $remoteUrl -user $FtpUser -pass $Password
        Write-Host "  ✅ $relativePath ($([math]::Round($file.Length/1024,1)) KB)"
        $successCount++
    } catch {
        Write-Host "  ❌ $relativePath — $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════"
Write-Host "Upload Complete!" -ForegroundColor Green
Write-Host "  ✅ Success: $successCount files"
Write-Host "  ❌ Failed:  $failCount files"
Write-Host ""
Write-Host "🌐 Test your site: https://v.ninhle.com"
Write-Host ""
Write-Host "Quick verify:"
Write-Host "  1. Open https://v.ninhle.com → Login page loads"
Write-Host "  2. DevTools → Network tab → Check API calls go to api.ninhle.com"
