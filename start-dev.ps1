# QuestNav Browser Configuration Tool - Development Server Manager
# PowerShell script to manage both frontend and backend development servers

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs')]
    [string]$Command = 'start'
)

# PID file locations
$PidDir = $env:TEMP
$BackendPidFile = Join-Path $PidDir "questnav-backend.pid"
$FrontendPidFile = Join-Path $PidDir "questnav-frontend.pid"
$BackendLogFile = Join-Path $PidDir "questnav-backend.log"
$FrontendLogFile = Join-Path $PidDir "questnav-frontend.log"
$BackendErrorLogFile = Join-Path $PidDir "questnav-backend-error.log"
$FrontendErrorLogFile = Join-Path $PidDir "questnav-frontend-error.log"

# Helper function to check if process is running
function Test-ProcessRunning {
    param([int]$ProcessId)
    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Helper function to get PID listening on a port
function Get-PortPid {
    param([int]$Port)
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
        return $connection.OwningProcess
    } catch {
        return $null
    }
}

# Start servers
function Start-DevServers {
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "QuestNav Configuration Tool - Starting Dev Servers" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""

    # Check if already running
    if (Test-Path $BackendPidFile) {
        $backendPid = [int](Get-Content $BackendPidFile)
        if (Test-ProcessRunning -ProcessId $backendPid) {
            Write-Host "! Backend server is already running (PID: $backendPid)" -ForegroundColor Yellow
            Write-Host "  Run 'start-dev.ps1 stop' first, or 'start-dev.ps1 restart' to restart" -ForegroundColor Yellow
            Write-Host ""
        }
    }

    if (Test-Path $FrontendPidFile) {
        $frontendPid = [int](Get-Content $FrontendPidFile)
        if (Test-ProcessRunning -ProcessId $frontendPid) {
            Write-Host "! Frontend server is already running (PID: $frontendPid)" -ForegroundColor Yellow
            Write-Host "  Run 'start-dev.ps1 stop' first, or 'start-dev.ps1 restart' to restart" -ForegroundColor Yellow
            Write-Host ""
        }
    }

    # Check if node_modules exist
    if (-not (Test-Path "backend\node_modules")) {
        Write-Host "X Backend dependencies not installed!" -ForegroundColor Red
        Write-Host "Please run setup.bat first" -ForegroundColor Red
        exit 1
    }

    if (-not (Test-Path "frontend\node_modules")) {
        Write-Host "X Frontend dependencies not installed!" -ForegroundColor Red
        Write-Host "Please run setup.bat first" -ForegroundColor Red
        exit 1
    }

    Write-Host "Starting servers in background..." -ForegroundColor White
    Write-Host ""

    # Start backend
    Push-Location backend
    $backendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" `
        -RedirectStandardOutput $BackendLogFile -RedirectStandardError $BackendErrorLogFile `
        -WindowStyle Hidden -PassThru
    Pop-Location
    
    Start-Sleep -Seconds 2
    
    # Get backend PID from port
    $backendPid = Get-PortPid -Port 3000
    if ($backendPid) {
        $backendPid | Out-File -FilePath $BackendPidFile -Encoding ASCII
        Write-Host "+ Backend started: http://localhost:3000 (PID: $backendPid)" -ForegroundColor Green
    } else {
        Write-Host "! Backend started but couldn't get PID" -ForegroundColor Yellow
    }

    # Wait for backend to initialize
    Start-Sleep -Seconds 3

    # Start frontend
    Push-Location frontend
    $frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" `
        -RedirectStandardOutput $FrontendLogFile -RedirectStandardError $FrontendErrorLogFile `
        -WindowStyle Hidden -PassThru
    Pop-Location
    
    Start-Sleep -Seconds 2
    
    # Get frontend PID from port
    $frontendPid = Get-PortPid -Port 5173
    if ($frontendPid) {
        $frontendPid | Out-File -FilePath $FrontendPidFile -Encoding ASCII
        Write-Host "+ Frontend started: http://localhost:5173 (PID: $frontendPid)" -ForegroundColor Green
    } else {
        Write-Host "! Frontend started but couldn't get PID" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "+ Both servers started successfully!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Backend:  http://localhost:3000" -ForegroundColor White
    Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
    Write-Host ""
    Write-Host "Logs:" -ForegroundColor White
    Write-Host "  Backend:  $BackendLogFile" -ForegroundColor Gray
    Write-Host "  Errors:   $BackendErrorLogFile" -ForegroundColor Gray
    Write-Host "  Frontend: $FrontendLogFile" -ForegroundColor Gray
    Write-Host "  Errors:   $FrontendErrorLogFile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To manage servers:" -ForegroundColor White
    Write-Host "  .\start-dev.ps1 stop     - Stop both servers" -ForegroundColor Gray
    Write-Host "  .\start-dev.ps1 restart  - Restart both servers" -ForegroundColor Gray
    Write-Host "  .\start-dev.ps1 status   - Check server status" -ForegroundColor Gray
    Write-Host "  .\start-dev.ps1 logs     - View logs" -ForegroundColor Gray
    Write-Host ""
}

# Stop servers
function Stop-DevServers {
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "QuestNav Configuration Tool - Stopping Dev Servers" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""

    $stoppedAny = $false

    # Stop backend
    if (Test-Path $BackendPidFile) {
        $backendPid = [int](Get-Content $BackendPidFile)
        if (Test-ProcessRunning -ProcessId $backendPid) {
            Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
            Write-Host "+ Backend stopped (PID: $backendPid)" -ForegroundColor Green
            $stoppedAny = $true
        }
        Remove-Item $BackendPidFile -ErrorAction SilentlyContinue
    }

    # Stop frontend
    if (Test-Path $FrontendPidFile) {
        $frontendPid = [int](Get-Content $FrontendPidFile)
        if (Test-ProcessRunning -ProcessId $frontendPid) {
            Stop-Process -Id $frontendPid -Force -ErrorAction SilentlyContinue
            Write-Host "+ Frontend stopped (PID: $frontendPid)" -ForegroundColor Green
            $stoppedAny = $true
        }
        Remove-Item $FrontendPidFile -ErrorAction SilentlyContinue
    }

    # Fallback: Kill by port if PIDs didn't work
    $backendPid = Get-PortPid -Port 3000
    if ($backendPid) {
        Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
        Write-Host "+ Stopped process on port 3000 (PID: $backendPid)" -ForegroundColor Green
        $stoppedAny = $true
    }

    $frontendPid = Get-PortPid -Port 5173
    if ($frontendPid) {
        Stop-Process -Id $frontendPid -Force -ErrorAction SilentlyContinue
        Write-Host "+ Stopped process on port 5173 (PID: $frontendPid)" -ForegroundColor Green
        $stoppedAny = $true
    }

    if ($stoppedAny) {
        Write-Host ""
        Write-Host "Servers stopped" -ForegroundColor White
    } else {
        Write-Host "- No running servers found" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "+ Stop complete" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
}

# Restart servers
function Restart-DevServers {
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "QuestNav Configuration Tool - Restarting Servers" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""

    Stop-DevServers
    Write-Host "Waiting for ports to be released..." -ForegroundColor White
    Start-Sleep -Seconds 3
    Write-Host ""
    Start-DevServers
}

# Check status
function Get-ServerStatus {
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "QuestNav Configuration Tool - Server Status" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""

    $backendRunning = $false
    $frontendRunning = $false

    # Check backend
    if (Test-Path $BackendPidFile) {
        $backendPid = [int](Get-Content $BackendPidFile)
        if (Test-ProcessRunning -ProcessId $backendPid) {
            Write-Host "[RUNNING] Backend  - http://localhost:3000 (PID: $backendPid)" -ForegroundColor Green
            $backendRunning = $true
        } else {
            Write-Host "[STOPPED] Backend (stale PID file)" -ForegroundColor Gray
            Remove-Item $BackendPidFile -ErrorAction SilentlyContinue
        }
    } else {
        $backendPid = Get-PortPid -Port 3000
        if ($backendPid) {
            Write-Host "[RUNNING] Backend  - http://localhost:3000 (PID: $backendPid) - not tracked" -ForegroundColor Yellow
            $backendRunning = $true
        } else {
            Write-Host "[STOPPED] Backend" -ForegroundColor Gray
        }
    }

    # Check frontend
    if (Test-Path $FrontendPidFile) {
        $frontendPid = [int](Get-Content $FrontendPidFile)
        if (Test-ProcessRunning -ProcessId $frontendPid) {
            Write-Host "[RUNNING] Frontend - http://localhost:5173 (PID: $frontendPid)" -ForegroundColor Green
            $frontendRunning = $true
        } else {
            Write-Host "[STOPPED] Frontend (stale PID file)" -ForegroundColor Gray
            Remove-Item $FrontendPidFile -ErrorAction SilentlyContinue
        }
    } else {
        $frontendPid = Get-PortPid -Port 5173
        if ($frontendPid) {
            Write-Host "[RUNNING] Frontend - http://localhost:5173 (PID: $frontendPid) - not tracked" -ForegroundColor Yellow
            $frontendRunning = $true
        } else {
            Write-Host "[STOPPED] Frontend" -ForegroundColor Gray
        }
    }

    Write-Host ""
    if ($backendRunning -and $frontendRunning) {
        Write-Host "Status: Both servers are running" -ForegroundColor Green
    } elseif (-not $backendRunning -and -not $frontendRunning) {
        Write-Host "Status: Both servers are stopped" -ForegroundColor Gray
    } else {
        Write-Host "Status: Only one server is running" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Log files:" -ForegroundColor White
    Write-Host "  Backend:  $BackendLogFile" -ForegroundColor Gray
    Write-Host "  Errors:   $BackendErrorLogFile" -ForegroundColor Gray
    Write-Host "  Frontend: $FrontendLogFile" -ForegroundColor Gray
    Write-Host "  Errors:   $FrontendErrorLogFile" -ForegroundColor Gray
    Write-Host ""
}

# View logs
function Show-Logs {
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "QuestNav Configuration Tool - Server Logs" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Viewing logs (Press Ctrl+C to stop)" -ForegroundColor White
    Write-Host ""
    Write-Host "Backend output: $BackendLogFile" -ForegroundColor Gray
    Write-Host "Backend errors: $BackendErrorLogFile" -ForegroundColor Gray
    Write-Host "Frontend output: $FrontendLogFile" -ForegroundColor Gray
    Write-Host "Frontend errors: $FrontendErrorLogFile" -ForegroundColor Gray
    Write-Host ""
    
    $logFiles = @()
    if (Test-Path $BackendLogFile) { $logFiles += $BackendLogFile }
    if (Test-Path $BackendErrorLogFile) { $logFiles += $BackendErrorLogFile }
    if (Test-Path $FrontendLogFile) { $logFiles += $FrontendLogFile }
    if (Test-Path $FrontendErrorLogFile) { $logFiles += $FrontendErrorLogFile }
    
    if ($logFiles.Count -gt 0) {
        Get-Content $logFiles -Wait
    } else {
        Write-Host "No log files found. Have you started the servers?" -ForegroundColor Yellow
    }
}

# Main command handler
switch ($Command) {
    'start' { Start-DevServers }
    'stop' { Stop-DevServers }
    'restart' { Restart-DevServers }
    'status' { Get-ServerStatus }
    'logs' { Show-Logs }
}

