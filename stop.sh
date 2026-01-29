#!/bin/bash

# SmartCore Factory Attendance System - Shutdown Script
# Author: AI Assistant
# Description: Dừng tất cả các service (backend và frontend)

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="$SCRIPT_DIR/.system.pid"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        SmartCore Factory Attendance System v1.0            ║${NC}"
echo -e "${BLUE}║              Stopping All Services...                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if PID file exists
if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}⚠️  No PID file found at: $PID_FILE${NC}"
    echo -e "${YELLOW}   System may not be running or was started manually.${NC}"
    echo ""
    echo -e "${BLUE}Attempting to find and kill processes anyway...${NC}"
    
    # Try to find and kill processes by name
    BACKEND_PIDS=$(pgrep -f "python.*main.py" || true)
    FRONTEND_PIDS=$(pgrep -f "vite.*dev" || true)
    
    if [ -n "$BACKEND_PIDS" ]; then
        echo -e "${YELLOW}Found backend processes: $BACKEND_PIDS${NC}"
        kill $BACKEND_PIDS 2>/dev/null || true
        sleep 2
        kill -9 $BACKEND_PIDS 2>/dev/null || true
        echo -e "${GREEN}✓ Backend processes terminated${NC}"
    else
        echo -e "${BLUE}No backend processes found${NC}"
    fi
    
    if [ -n "$FRONTEND_PIDS" ]; then
        echo -e "${YELLOW}Found frontend processes: $FRONTEND_PIDS${NC}"
        kill $FRONTEND_PIDS 2>/dev/null || true
        sleep 2
        kill -9 $FRONTEND_PIDS 2>/dev/null || true
        echo -e "${GREEN}✓ Frontend processes terminated${NC}"
    else
        echo -e "${BLUE}No frontend processes found${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✓ Cleanup complete${NC}"
    exit 0
fi

# Read PIDs from file
BACKEND_PID=$(sed -n '1p' "$PID_FILE")
FRONTEND_PID=$(sed -n '2p' "$PID_FILE")

echo -e "${BLUE}Found PIDs:${NC}"
echo -e "  Backend:  $BACKEND_PID"
echo -e "  Frontend: $FRONTEND_PID"
echo ""

# Function to gracefully stop a process
stop_process() {
    local PID=$1
    local NAME=$2
    
    if [ -z "$PID" ]; then
        echo -e "${YELLOW}⚠️  No PID for $NAME${NC}"
        return
    fi
    
    # Check if process is running
    if ! ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  $NAME (PID: $PID) is not running${NC}"
        return
    fi
    
    echo -e "${BLUE}Stopping $NAME (PID: $PID)...${NC}"
    
    # Try graceful shutdown first
    kill $PID 2>/dev/null || true
    
    # Wait up to 5 seconds for graceful shutdown
    for i in {1..5}; do
        if ! ps -p $PID > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $NAME stopped gracefully${NC}"
            return
        fi
        sleep 1
    done
    
    # Force kill if still running
    echo -e "${YELLOW}  Forcing shutdown...${NC}"
    kill -9 $PID 2>/dev/null || true
    sleep 1
    
    if ! ps -p $PID > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $NAME stopped (forced)${NC}"
    else
        echo -e "${RED}✗ Failed to stop $NAME${NC}"
    fi
}

# Stop services
stop_process "$FRONTEND_PID" "Frontend"
stop_process "$BACKEND_PID" "Backend"

# Also kill any orphaned processes
echo ""
echo -e "${BLUE}Cleaning up any orphaned processes...${NC}"

# Kill any remaining Python processes running main.py
ORPHAN_BACKEND=$(pgrep -f "python.*main.py" || true)
if [ -n "$ORPHAN_BACKEND" ]; then
    echo -e "${YELLOW}Found orphaned backend processes: $ORPHAN_BACKEND${NC}"
    kill -9 $ORPHAN_BACKEND 2>/dev/null || true
fi

# Kill any remaining Vite dev server processes
ORPHAN_FRONTEND=$(pgrep -f "vite.*dev" || true)
if [ -n "$ORPHAN_FRONTEND" ]; then
    echo -e "${YELLOW}Found orphaned frontend processes: $ORPHAN_FRONTEND${NC}"
    kill -9 $ORPHAN_FRONTEND 2>/dev/null || true
fi

# Kill any remaining npm processes related to our project
ORPHAN_NPM=$(pgrep -f "npm.*run.*dev" || true)
if [ -n "$ORPHAN_NPM" ]; then
    echo -e "${YELLOW}Found orphaned npm processes: $ORPHAN_NPM${NC}"
    kill -9 $ORPHAN_NPM 2>/dev/null || true
fi

# Remove PID file
rm -f "$PID_FILE"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✓ System Stopped Successfully! ✓              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}All services have been terminated.${NC}"
echo -e "${BLUE}To start the system again, run: ${YELLOW}./start.sh${NC}"
echo ""
