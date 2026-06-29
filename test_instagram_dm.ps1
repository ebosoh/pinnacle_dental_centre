# Simulation Test for Instagram DM
# This script simulates a message being sent from Instagram to your Apps Script bridge.

$GAS_URL = "https://script.google.com/macros/s/AKfycbzuu5lo8A60vNV5vSNby36qDJo0Ix8aB8jjuNS1khaQzbTse6tlraPGkgO_G3-kYBUL/exec"

$payload = @{
    object = "instagram"
    entry = @(
        @{
            id = "INSTAGRAM_BUSINESS_ACCOUNT_ID"
            time = 1625061600
            messaging = @(
                @{
                    sender = @{ id = "IG_USER_123" }
                    recipient = @{ id = "INSTAGRAM_BUSINESS_ACCOUNT_ID" }
                    timestamp = 1625061600
                    message = @{ 
                        mid = "m_123"
                        text = "Hello Instagram AI! Can I book for Tuesday?" 
                    }
                }
            )
        }
    )
} | ConvertTo-Json -Depth 5

Write-Host "Sending simulated Instagram message to GAS..." -ForegroundColor Magenta
try {
    $response = Invoke-WebRequest -Uri $GAS_URL -Method Post -Body $payload -ContentType "application/json" -UseBasicParsing
    Write-Host "Response Status: " -NoNewline; Write-Host $response.StatusCode -ForegroundColor Green
    Write-Host "Message processed successfully!" -ForegroundColor Green
    Write-Host "Response Body:"
    $response.Content
} catch {
    Write-Host "Error sending test message: $($_.Exception.Message)" -ForegroundColor Red
}
