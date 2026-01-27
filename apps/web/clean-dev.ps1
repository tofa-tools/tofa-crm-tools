# Clean Development Environment Script for Windows PowerShell
# This script removes all build caches and node_modules to ensure a fresh start

Write-Host "🧹 Cleaning Next.js and Turborepo build caches..." -ForegroundColor Cyan

# Remove Next.js build cache
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "✅ Removed .next directory" -ForegroundColor Green
}

# Remove Turborepo cache
if (Test-Path ".turbo") {
    Remove-Item -Recurse -Force ".turbo"
    Write-Host "✅ Removed .turbo directory" -ForegroundColor Green
}

# Remove node_modules cache
if (Test-Path "node_modules/.cache") {
    Remove-Item -Recurse -Force "node_modules/.cache"
    Write-Host "✅ Removed node_modules/.cache" -ForegroundColor Green
}

# Remove root-level caches
$rootPath = Join-Path $PSScriptRoot "..\.."
if (Test-Path (Join-Path $rootPath ".turbo")) {
    Remove-Item -Recurse -Force (Join-Path $rootPath ".turbo")
    Write-Host "✅ Removed root .turbo directory" -ForegroundColor Green
}

Write-Host "`n✨ Cleanup complete! You can now run 'npm run dev' for a fresh start." -ForegroundColor Green

