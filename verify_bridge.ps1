# Verification Script for Meta Bridge (v2)
# Usage: powershell -File verify_bridge.ps1 -GAS_URL "YOUR_WEB_APP_URL"

param (
    [string]$GAS_URL = "https://script.google.com/macros/s/AKfycbzuu5lo8A60vNV5vSNby36qDJo0Ix8aB8jjuNS1khaQzbTse6tlraPGkgO_G3-kYBUL/exec"
)

Write-Host "--- Pinnacle Dental Meta Bridge Diagnostic ---" -ForegroundColor Cyan

if ($GAS_URL -eq "PASTE_YOUR_URL_HERE") {
    Write-Host "Please provide your Web App URL as a parameter or edit the script." -ForegroundColor Red
    exit
}

# 1. Test Webhook Verification (GET)
Write-Host "`n[1/2] Testing Webhook Verification (GET)..." -ForegroundColor Yellow
$verify_token = "pinnacle_dental_meta"
$challenge = "123456789"
$verify_url = "$GAS_URL?hub.mode=subscribe&hub.verify_token=$verify_token&hub.challenge=$challenge"

try {
    $response = Invoke-WebRequest -Uri $verify_url -Method Get -UseBasicParsing
    if ($response.Content -eq $challenge) {
        Write-Host "✅ SUCCESS: Verification challenge returned correctly!" -ForegroundColor Green
    } else {
        Write-Host "❌ FAILED: Unexpected response: $($response.Content)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERROR: Could not reach the script. Check your URL and Deployment settings." -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# 2. Test Message Handling (POST)
Write-Host "`n[2/2] Testing Message Handling (POST)..." -ForegroundColor Yellow
$payload = @{
    object = "page"
    entry = @(
        @{
            messaging = @(
                @{
                    sender = @{ id = "DEBUG_USER" }
                    message = @{ text = "Hi, I need a dental check-up" }
                }
            )
        }
    )
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-WebRequest -Uri $GAS_URL -Method Post -Body $payload -ContentType "application/json" -UseBasicParsing
    Write-Host "Response Body: $($response.Content)"
    if ($response.Content -like "*success*") {
        Write-Host "✅ SUCCESS: Bridge processed the message and logged it!" -ForegroundColor Green
    } else {
        Write-Host "❌ FAILED: The bridge returned an error. Check your 'Logs' sheet." -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERROR: Failed to send POST request." -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host "`n--- Diagnostic Complete ---" -ForegroundColor Cyan
