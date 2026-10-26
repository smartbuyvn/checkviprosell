#!/usr/bin/env pwsh
# ================================================================
# deploy-cloudflare-pages.ps1
# Deploy frontend lên Cloudflare Pages (v.ninhle.com)
#
# CÁCH DÙNG:
#   .\deploy-cloudflare-pages.ps1 -CfApiToken "your_token_here"
#
# Lấy API Token tại:
#   https://dash.cloudflare.com/profile/api-tokens
#   → Create Token → Edit Cloudflare Workers template
#   → Permissions thêm: Account | Pages | Edit
# ================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$CfApiToken,
    [string]$ProjectName = "viprosell",  # Tên Cloudflare Pages project
    [string]$DistPath = "D:\vidiosell\dist"
)

$ErrorActionPreference = "Stop"

Write-Host @"
╔════════════════════════════════════════════════════════════╗
║   VIPROSELL — Deploy to Cloudflare Pages                  ║
╠════════════════════════════════════════════════════════════╣
║  Project: $ProjectName
║  Dist   : $DistPath
║  Target : https://v.ninhle.com
╚════════════════════════════════════════════════════════════╝
"@

# Verify dist
if (-not (Test-Path "$DistPath\index.html")) {
    Write-Host "❌ dist/index.html not found. Run 'npm run build' first!" -ForegroundColor Red
    exit 1
}

# Verify API URL in bundle
$bundle = Get-ChildItem "$DistPath\assets" -Filter "index-*.js" | Select-Object -First 1
$content = Get-Content $bundle.FullName -Raw
$apiUrl = [regex]::Match($content, 'https://[a-z.]+/api/v1').Value
Write-Host "✅ API URL in bundle: $apiUrl"

# Set CF token env
$env:CLOUDFLARE_API_TOKEN = $CfApiToken

Write-Host "`n🚀 Deploying to Cloudflare Pages..."
$result = & npx wrangler@latest pages deploy $DistPath `
    --project-name $ProjectName `
    --commit-message "Deploy: Fix API URL to api.ninhle.com" 2>&1

Write-Host $result

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deploy thành công!" -ForegroundColor Green
    Write-Host "🌐 https://v.ninhle.com đã được cập nhật"
    Write-Host ""
    Write-Host "Verify trong 30-60s:"
    Write-Host "  curl -I https://v.ninhle.com"
} else {
    Write-Host "❌ Deploy thất bại" -ForegroundColor Red
    Write-Host "Log: $result"
}
