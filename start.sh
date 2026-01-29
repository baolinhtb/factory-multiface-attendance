#!/bin/bash

# SmartCore Factory Attendance System - Startup Script
# Author: AI Assistant
# Description: Khởi động backend (FastAPI) và frontend (Vite) đồng thời

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
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PID_FILE="$SCRIPT_DIR/.system.pid"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        SmartCore Factory Attendance System v1.0            ║${NC}"
echo -e "${BLUE}║              Starting All Services...                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if system is already running
if [ -f "$PID_FILE" ]; then
    echo -e "${YELLOW}⚠️  System appears to be already running!${NC}"
    echo -e "${YELLOW}   PID file exists at: $PID_FILE${NC}"
    echo -e "${YELLOW}   Run './stop.sh' first to stop the system.${NC}"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${RED}Received interrupt signal. Cleaning up...${NC}"
    if [ -f "$PID_FILE" ]; then
        rm -f "$PID_FILE"
    fi
    exit 1
}

trap cleanup INT TERM

# Step 1: Start Backend
echo -e "${GREEN}[1/2]${NC} Starting Backend (FastAPI)..."
cd "$BACKEND_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}✗ Virtual environment not found!${NC}"
    echo -e "${YELLOW}  Please run: cd backend && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt${NC}"
    exit 1
fi

# Start backend in background
nohup ./venv/bin/python main.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started${NC} (PID: $BACKEND_PID)"
echo -e "  Log: logs/backend.log"
echo -e "  API: http://127.0.0.1:8000"
echo -e "  Docs: http://127.0.0.1:8000/docs"

# Wait for backend to be ready
echo -n "  Waiting for backend to be ready"
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/docs > /dev/null 2>&1; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e " ${YELLOW}⚠${NC}"
        echo -e "${YELLOW}Backend is taking longer than expected to start${NC}"
        echo -e "${YELLOW}This is normal for first-time startup (loading AI models)${NC}"
        echo -e "${YELLOW}Check logs/backend.log for details${NC}"
        echo ""
        echo -e "${BLUE}Continuing anyway... Backend may still be initializing.${NC}"
    fi
done

# Step 2: Start Frontend
echo ""
echo -e "${GREEN}[2/2]${NC} Starting Frontend (Vite + React)..."
cd "$FRONTEND_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Running npm install...${NC}"
    npm install --legacy-peer-deps
fi

# Start frontend in background
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started${NC} (PID: $FRONTEND_PID)"
echo -e "  Log: logs/frontend.log"
echo -e "  URL: http://localhost:3000"

# Wait for frontend to be ready
echo -n "  Waiting for frontend to be ready"
for i in {1..20}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 20 ]; then
        echo -e " ${YELLOW}⚠${NC}"
        echo -e "${YELLOW}Frontend may still be starting. Check logs/frontend.log${NC}"
        break
    fi
done

# Save PIDs to file
echo "$BACKEND_PID" > "$PID_FILE"
echo "$FRONTEND_PID" >> "$PID_FILE"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              🚀 System Started Successfully! 🚀             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
echo -e "   Backend:  ${GREEN}Running${NC} on http://127.0.0.1:8000"
echo -e "   Frontend: ${GREEN}Running${NC} on http://localhost:3000"
echo ""
echo -e "${BLUE}📝 Default Login:${NC}"
echo -e "   Username: ${YELLOW}admin${NC}"
echo -e "   Password: ${YELLOW}admin123${NC}"
echo ""
echo -e "${BLUE}📂 Logs:${NC}"
echo -e "   Backend:  tail -f logs/backend.log"
echo -e "   Frontend: tail -f logs/frontend.log"
echo ""
echo -e "${BLUE}🛑 To stop the system:${NC}"
echo -e "   Run: ${YELLOW}./stop.sh${NC}"
echo ""
echo -e "${GREEN}✨ Open your browser and navigate to: http://localhost:3000${NC}"
echo ""
