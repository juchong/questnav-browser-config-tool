#!/bin/bash

# QuestNav Browser Configuration Tool - Development Server Manager
# This script manages both frontend and backend development servers

# PID file locations
PID_DIR="${TMPDIR:-/tmp}"
BACKEND_PID_FILE="$PID_DIR/questnav-backend.pid"
FRONTEND_PID_FILE="$PID_DIR/questnav-frontend.pid"
BACKEND_LOG_FILE="$PID_DIR/questnav-backend.log"
FRONTEND_LOG_FILE="$PID_DIR/questnav-frontend.log"

# Get command
COMMAND=${1:-start}

# Function to check if process is running
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# Function to start servers
start_servers() {
    echo "================================================"
    echo "QuestNav Configuration Tool - Starting Dev Servers"
    echo "================================================"
    echo ""

    # Check if already running
    if is_running "$BACKEND_PID_FILE"; then
        echo "⚠️  Backend server is already running"
        echo "   Run './start-dev.sh stop' first, or './start-dev.sh restart' to restart"
        echo ""
    fi

    if is_running "$FRONTEND_PID_FILE"; then
        echo "⚠️  Frontend server is already running"
        echo "   Run './start-dev.sh stop' first, or './start-dev.sh restart' to restart"
        echo ""
    fi

    # Check if node_modules exist
    if [ ! -d "backend/node_modules" ]; then
        echo "❌ Backend dependencies not installed!"
        echo "Please run setup.sh first"
        exit 1
    fi

    if [ ! -d "frontend/node_modules" ]; then
        echo "❌ Frontend dependencies not installed!"
        echo "Please run setup.sh first"
        exit 1
    fi

    echo "Starting servers..."
    echo ""

    # Start backend in background
    cd backend
    nohup npm run dev > "$BACKEND_LOG_FILE" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$BACKEND_PID_FILE"
    cd ..
    echo "✅ Backend started: http://localhost:3000 (PID: $BACKEND_PID)"

    # Wait for backend to initialize
    sleep 3

    # Start frontend in background
    cd frontend
    nohup npm run dev > "$FRONTEND_LOG_FILE" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$FRONTEND_PID_FILE"
    cd ..
    echo "✅ Frontend started: http://localhost:5173 (PID: $FRONTEND_PID)"

    echo ""
    echo "================================================"
    echo "✅ Both servers started successfully!"
    echo "================================================"
    echo ""
    echo "Backend:  http://localhost:3000"
    echo "Frontend: http://localhost:5173"
    echo ""
    echo "Logs:"
    echo "  Backend:  tail -f $BACKEND_LOG_FILE"
    echo "  Frontend: tail -f $FRONTEND_LOG_FILE"
    echo ""
    echo "To manage servers:"
    echo "  ./start-dev.sh stop     - Stop both servers"
    echo "  ./start-dev.sh restart  - Restart both servers"
    echo "  ./start-dev.sh status   - Check server status"
    echo "  ./start-dev.sh logs     - View logs"
    echo ""
}

# Function to stop servers
stop_servers() {
    echo "================================================"
    echo "QuestNav Configuration Tool - Stopping Dev Servers"
    echo "================================================"
    echo ""

    # Stop backend
    if is_running "$BACKEND_PID_FILE"; then
        local pid=$(cat "$BACKEND_PID_FILE")
        kill $pid 2>/dev/null
        rm -f "$BACKEND_PID_FILE"
        echo "✅ Backend stopped"
    else
        echo "➖ Backend was not running"
    fi

    # Stop frontend
    if is_running "$FRONTEND_PID_FILE"; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        kill $pid 2>/dev/null
        rm -f "$FRONTEND_PID_FILE"
        echo "✅ Frontend stopped"
    else
        echo "➖ Frontend was not running"
    fi

    echo ""
    echo "================================================"
    echo "✅ Servers stopped"
    echo "================================================"
    echo ""
}

# Function to restart servers
restart_servers() {
    echo "================================================"
    echo "QuestNav Configuration Tool - Restarting Servers"
    echo "================================================"
    echo ""

    stop_servers
    sleep 2
    start_servers
}

# Function to check status
check_status() {
    echo "================================================"
    echo "QuestNav Configuration Tool - Server Status"
    echo "================================================"
    echo ""

    local backend_running=0
    local frontend_running=0

    # Check backend
    if is_running "$BACKEND_PID_FILE"; then
        local pid=$(cat "$BACKEND_PID_FILE")
        echo "[RUNNING] Backend  - http://localhost:3000 (PID: $pid)"
        backend_running=1
    else
        echo "[STOPPED] Backend"
    fi

    # Check frontend
    if is_running "$FRONTEND_PID_FILE"; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        echo "[RUNNING] Frontend - http://localhost:5173 (PID: $pid)"
        frontend_running=1
    else
        echo "[STOPPED] Frontend"
    fi

    echo ""
    if [ $backend_running -eq 1 ] && [ $frontend_running -eq 1 ]; then
        echo "Status: ✅ Both servers are running"
    elif [ $backend_running -eq 0 ] && [ $frontend_running -eq 0 ]; then
        echo "Status: ⭕ Both servers are stopped"
    else
        echo "Status: ⚠️  Only one server is running"
    fi
    echo ""
}

# Function to view logs
view_logs() {
    echo "================================================"
    echo "QuestNav Configuration Tool - Server Logs"
    echo "================================================"
    echo ""
    echo "Viewing logs (Press Ctrl+C to stop)"
    echo ""
    echo "Backend log:  $BACKEND_LOG_FILE"
    echo "Frontend log: $FRONTEND_LOG_FILE"
    echo ""
    
    if [ -f "$BACKEND_LOG_FILE" ] && [ -f "$FRONTEND_LOG_FILE" ]; then
        tail -f "$BACKEND_LOG_FILE" "$FRONTEND_LOG_FILE"
    elif [ -f "$BACKEND_LOG_FILE" ]; then
        tail -f "$BACKEND_LOG_FILE"
    elif [ -f "$FRONTEND_LOG_FILE" ]; then
        tail -f "$FRONTEND_LOG_FILE"
    else
        echo "No log files found. Have you started the servers?"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: ./start-dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start    - Start both development servers (default)"
    echo "  stop     - Stop both development servers"
    echo "  restart  - Restart both development servers"
    echo "  status   - Check if servers are running"
    echo "  logs     - View server logs"
    echo ""
    echo "Examples:"
    echo "  ./start-dev.sh           Start servers"
    echo "  ./start-dev.sh stop      Stop servers"
    echo "  ./start-dev.sh restart   Restart servers"
    echo "  ./start-dev.sh logs      View logs"
    echo ""
}

# Main command handler
case "$COMMAND" in
    start)
        start_servers
        ;;
    stop)
        stop_servers
        ;;
    restart)
        restart_servers
        ;;
    status)
        check_status
        ;;
    logs)
        view_logs
        ;;
    *)
        show_usage
        exit 1
        ;;
esac

