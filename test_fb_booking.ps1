# Simulation Test for Facebook Booking

# This script simulates what ElevenLabs sends to Google Apps Script
# when a Facebook AI Agent tool is triggered.

$GAS_URL = "https://script.google.com/macros/s/AKfycbzuu5lo8A60vNV5vSNby36qDJo0Ix8aB8jjuNS1khaQzbTse6tlraPGkgO_G3-kYBUL/exec"

$payload = @{
    action = "createBooking"
    name = "Test FB Patient"
    phone = "+254700000000"
    service = "Teeth Whitening"
    date = "2026-03-30T10:00:00"
    source = "Facebook AI Agent"
} | ConvertTo-Json

Write-Host "Sending simulated tool call to GAS..."
$response = Invoke-RestMethod -Uri $GAS_URL -Method Post -Body $payload -ContentType "application/json"

Write-Host "Response from GAS:"
$response | ConvertTo-Json
