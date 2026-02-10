#!/bin/bash

# SmartCore Factory Attendance System - Backend Startup Script
# Description: Starts the backend service in background (persistent) and tails the log

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"
LOG_FILE="$SCRIPT_DIR/logs/backend.log"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        SmartCore Factory Attendance System                 ║${NC}"
echo -e "${BLUE}║              Starting Backend Service                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if port 8000 is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Port 8000 is already in use!${NC}"
    echo -e "${YELLOW}   It seems the backend is already running.${NC}"
    echo -e "${YELLOW}   Tail of logs/backend.log:${NC}"
    tail -n 10 "$LOG_FILE"
    echo ""
    echo -e "${BLUE}To stop it, run ./stop.sh or find the PID.${NC}"
    exit 0
fi

# Step 1: Start Backend
echo -e "${GREEN}[1/1]${NC} Starting Backend (FastAPI) in background..."
cd "$BACKEND_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}✗ Virtual environment not found!${NC}"
    echo -e "${YELLOW}  Running setup...${NC}"
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to setup environment.${NC}"
        exit 1
    fi
fi

# Start using nohup
# We use the python from the venv directly
echo -e "${BLUE}Launching process...${NC}"
nohup ./venv/bin/python main.py > "$LOG_FILE" 2>&1 &
BACKEND_PID=$!

echo -e "${GREEN}✓ Backend started with PID: $BACKEND_PID${NC}"
echo -e "${GREEN}✓ Service will continue running even if you close this terminal.${NC}"
echo ""
echo -e "${BLUE}Waiting for service to initialize...${NC}"

# Wait for startup
sleep 2

# Check if it died immediately
if ! ps -p $BACKEND_PID > /dev/null; then
    echo -e "${RED}✗ Backend failed to start!${NC}"
    echo -e "${YELLOW}Check the logs below:${NC}"
    cat "$LOG_FILE"
    exit 1
fi

echo -e "${GREEN}✓ Service is running!${NC}"
echo -e "  API: http://127.0.0.1:8000"
echo -e "  Docs: http://127.0.0.1:8000/docs"
echo ""
echo -e "${YELLOW}Now following log output. Press Ctrl+C to stop watching logs (Service will KEEP RUNNING).${NC}"
echo -e "${YELLOW}To stop the service later, run: ./stop.sh${NC}"
echo "--------------------------------------------------------"

# Tail the log file
tail -f "$LOG_FILE"
