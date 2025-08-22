@echo off
echo Starting Battleship Game Server and Client...
echo.

echo Starting server on port 3000...
start "Battleship Server" cmd /k "cd /d server && npm start"

timeout /t 3 /nobreak > nul

echo Starting client on port 8080...
start "Battleship Client" cmd /k "cd /d client && npx http-server -p 8080"

timeout /t 2 /nobreak > nul

echo.
echo Battleship Game is starting up!
echo Server: http://localhost:3000
echo Client: http://localhost:8080
echo.
echo Press any key to continue...
pause > nul
