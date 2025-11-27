# Test Webhook Script
# Simulates a GitHub release webhook to test the automatic APK detection

param(
    [string]$Tag = "v1.0.0-test",
    [string]$ApkUrl = "https://github.com/QuestNav/QuestNav/releases/download/v2025-1.0.0-beta/Android.apk",
    [string]$ApkName = "Android.apk",
    [string]$BackendUrl = "http://localhost:3000"
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Test Webhook for APK Release Detection" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Testing with:" -ForegroundColor White
Write-Host "  Tag:      $Tag" -ForegroundColor Gray
Write-Host "  APK Name: $ApkName" -ForegroundColor Gray
Write-Host "  APK URL:  $ApkUrl" -ForegroundColor Gray
Write-Host "  Backend:  $BackendUrl" -ForegroundColor Gray
Write-Host ""

# Create test payload
$payload = @{
    tag_name = $Tag
    apk_url = $ApkUrl
    apk_name = $ApkName
} | ConvertTo-Json

Write-Host "Sending test webhook..." -ForegroundColor White

try {
    $response = Invoke-RestMethod `
        -Uri "$BackendUrl/api/webhooks/github/test" `
        -Method Post `
        -ContentType "application/json" `
        -Body $payload
    
    Write-Host ""
    Write-Host "✓ Success!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor White
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Gray
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Next Steps:" -ForegroundColor White
    Write-Host "  1. Open the admin panel at http://localhost:5173" -ForegroundColor Gray
    Write-Host "  2. Navigate to 'QuestNav APK Releases' section" -ForegroundColor Gray
    Write-Host "  3. You should see the new release with status 'downloading' or 'completed'" -ForegroundColor Gray
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "✗ Failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Details:" -ForegroundColor White
        Write-Host $_.ErrorDetails.Message -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "Troubleshooting:" -ForegroundColor White
    Write-Host "  1. Make sure the backend is running (npm run dev in backend/)" -ForegroundColor Gray
    Write-Host "  2. Check that NODE_ENV is set to 'development' (not production)" -ForegroundColor Gray
    Write-Host "  3. Verify the backend URL is correct: $BackendUrl" -ForegroundColor Gray
    Write-Host "  4. Try: .\test-webhook.ps1 -BackendUrl 'http://localhost:3000'" -ForegroundColor Gray
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

