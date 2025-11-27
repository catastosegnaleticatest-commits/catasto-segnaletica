# Script per testare lo stato del server
Write-Host "Verifica stato server Render..." -ForegroundColor Cyan
Write-Host ""

$apiUrl = "https://catasto-segnaletica.onrender.com"

# Test 1: Endpoint status
Write-Host "1. Test endpoint /api/status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$apiUrl/api/status" -Method GET -UseBasicParsing -TimeoutSec 10
    Write-Host "   Server online! Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   Total Signs: $($data.totalSigns)" -ForegroundColor Green
    Write-Host "   Total Interventions: $($data.totalInterventions)" -ForegroundColor Green
} catch {
    Write-Host "   Errore: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 2: Endpoint reset-admin
Write-Host "2. Test endpoint /api/auth/reset-admin..." -ForegroundColor Yellow
$body = @{
    secret = "reset-admin-2024"
    password = "admin123"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$apiUrl/api/auth/reset-admin" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
    Write-Host "   Endpoint disponibile! Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   $($data.message)" -ForegroundColor Green
    Write-Host "   Username: $($data.username)" -ForegroundColor Green
    Write-Host "   Password: $($data.password)" -ForegroundColor Green
} catch {
    Write-Host "   Errore: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
            
            if ($responseBody -match "<!DOCTYPE" -or $responseBody -match "<html") {
                Write-Host "   Il server ha restituito HTML invece di JSON" -ForegroundColor Yellow
                Write-Host "   Il deploy potrebbe non essere completato" -ForegroundColor Yellow
            } else {
                Write-Host "   Response: $responseBody" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   (Impossibile leggere la risposta)" -ForegroundColor Yellow
        }
    }
}
Write-Host ""
Write-Host "Test completato!" -ForegroundColor Cyan
