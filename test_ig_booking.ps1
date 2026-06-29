# Simulation Test for Instagram Booking

$GAS_URL = "https://script.google.com/macros/s/AKfycbzuu5lo8A60vNV5vSNby36qDJo0Ix8aB8jjuNS1khaQzbTse6tlraPGkgO_G3-kYBUL/exec"

$payload = @{
    action = "createBooking"
    name = "Test IG Patient"
    phone = "+254700000001"
    service = "Dental Check-ups"
    date = "2026-04-01T14:00:00"
    source = "Instagram AI Agent"
} | ConvertTo-Json

Write-Host "Sending simulated Instagram tool call to GAS..."
$response = Invoke-RestMethod -Uri $GAS_URL -Method Post -Body $payload -ContentType "application/json"

Write-Host "Response from GAS:"
$response | ConvertTo-Json
