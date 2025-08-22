# Start Battleship Game (PowerShell script)

Write-Host "Starting Battleship Game Server and Client..." -ForegroundColor Green
Write-Host ""

Write-Host "Starting server on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'server'; npm start" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "Starting client on port 8080..." -ForegroundColor Yellow  
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'client'; npx http-server -p 8080" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Battleship Game is starting up!" -ForegroundColor Green
Write-Host "Server: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Client: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor White
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
