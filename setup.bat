@echo off
REM QuestNav Browser Configuration Tool - Setup Script
REM This script sets up the development environment on Windows

echo ================================================
echo QuestNav Configuration Tool - Development Setup
echo ================================================
echo.

REM Check Node.js
echo Checking Node.js version...
node -v >nul 2>&1
if errorlevel 1 (
    echo X Node.js is not installed!
    echo.
    echo Would you like to download Node.js 20 LTS installer?
    echo.
    choice /C YN /M "Open Node.js 20 LTS download page in browser"
    if errorlevel 2 (
        echo.
        echo Please install Node.js 20 LTS manually from https://nodejs.org/
        exit /b 1
    )
    echo.
    echo Opening Node.js 20 LTS download page...
    start https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi
    echo.
    echo After installing Node.js 20 LTS:
    echo 1. Close this window
    echo 2. Open a new terminal
    echo 3. Run setup.bat again
    echo.
    pause
    exit /b 0
)

for /f "tokens=1" %%i in ('node -v') do set NODE_VERSION=%%i
echo + Node.js %NODE_VERSION% detected

REM Extract major version (e.g., v20.1.0 -> 20)
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION:v=%") do set NODE_MAJOR=%%a

if %NODE_MAJOR% LSS 20 (
    echo X Node.js version must be 20 or higher ^(found %NODE_VERSION%^)
    echo.
    echo Would you like to download Node.js 20 LTS installer?
    echo.
    choice /C YN /M "Open Node.js 20 LTS download page in browser"
    if errorlevel 2 (
        echo.
        echo Please upgrade Node.js manually from https://nodejs.org/
        exit /b 1
    )
    echo.
    echo Opening Node.js 20 LTS download page...
    start https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi
    echo.
    echo After installing Node.js 20 LTS:
    echo 1. Close this window
    echo 2. Open a new terminal
    echo 3. Run setup.bat again
    echo.
    pause
    exit /b 0
)

if %NODE_MAJOR% GTR 22 (
    echo ! WARNING: You are using Node.js %NODE_VERSION%
    echo ! This project is tested with Node.js 20 LTS.
    echo ! Native modules like better-sqlite3 may fail to compile.
    echo.
    echo We recommend Node.js 20 LTS for best compatibility.
    echo.
    echo Options:
    echo   1. Continue with Node.js %NODE_VERSION% ^(may fail^)
    echo   2. Download Node.js 20 LTS installer
    echo   3. Cancel setup
    echo.
    choice /C 123 /M "Choose an option"
    if errorlevel 3 exit /b 0
    if errorlevel 2 (
        echo.
        echo Opening Node.js 20 LTS download page...
        start https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi
        echo.
        echo After installing Node.js 20 LTS:
        echo 1. Close this window
        echo 2. Open a new terminal
        echo 3. Run setup.bat again
        echo.
        echo TIP: You can use nvm-windows to manage multiple Node.js versions:
        echo      https://github.com/coreybutler/nvm-windows
        echo.
        pause
        exit /b 0
    )
    echo.
    echo Continuing with Node.js %NODE_VERSION%...
)
echo.

REM Install backend dependencies
echo Installing backend dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo X Failed to install backend dependencies
    exit /b 1
)
echo + Backend dependencies installed
cd ..
echo.

REM Install frontend dependencies
echo Installing frontend dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo X Failed to install frontend dependencies
    exit /b 1
)
echo + Frontend dependencies installed
cd ..
echo.

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file...
    copy .env.example .env
    echo + .env file created
) else (
    echo i .env file already exists
)
echo.

REM Create data directory
echo Creating data directory...
if not exist data mkdir data
echo + Data directory created
echo.

echo ================================================
echo + Setup complete!
echo ================================================
echo.
echo To start the development servers:
echo.
echo Terminal 1 (Backend):
echo   cd backend
echo   npm run dev
echo.
echo Terminal 2 (Frontend):
echo   cd frontend
echo   npm run dev
echo.
echo Then open http://localhost:5173 in your browser
echo.
echo For production deployment, see DEPLOYMENT.md
echo ================================================

