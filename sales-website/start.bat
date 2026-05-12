@echo off
title My Store — Server
color 0A
echo.
echo  =============================================
echo   My Store — Starting server...
echo  =============================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed.
    echo  Download it from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo  [INFO] Installing dependencies (first run)...
    npm install
    echo.
)

:: Check if .env exists
if not exist ".env" (
    echo  [WARNING] No .env file found.
    echo  Copy .env.example to .env and fill in your keys.
    echo  The server will start but admin and payments won't work.
    echo.
)

echo  Store:   http://localhost:3000
echo  Admin:   http://localhost:3000/admin
echo.
echo  Press Ctrl+C to stop the server.
echo  =============================================
echo.

node server.js

pause
