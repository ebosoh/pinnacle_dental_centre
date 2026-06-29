# Simulation Test for Meta DM (Messenger)
# This script simulates a message being sent from Facebook to your Apps Script bridge.

$GAS_URL = "https://script.google.com/macros/s/AKfycbzuu5lo8A60vNV5vSNby36qDJo0Ix8aB8jjuNS1khaQzbTse6tlraPGkgO_G3-kYBUL/exec"

$payload = @{
    object = "page"
    entry = @(
        @{
            messaging = @(
                @{
                    sender = @{ id = "TEST_USER_123" }
                    message = @{ text = "Hi, do you have any appointments available on Monday?" }
                }
            )
        }
    )
} | ConvertTo-Json -Depth 5

Write-Host "Sending simulated Messenger message to GAS..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri $GAS_URL -Method Post -Body $payload -ContentType "application/json"
    Write-Host "Response Status: " -NoNewline; Write-Host $response.StatusCode -ForegroundColor Green
    Write-Host "Message processed successfully!" -ForegroundColor Green
    Write-Host "Response Body:"
    $response.Content
} catch {
    Write-Host "Error sending test message: $($_.Exception.Message)" -ForegroundColor Red
}
