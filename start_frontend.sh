#!/bin/bash

# SmartCore Factory Attendance System - Frontend Startup Script
# Description: Starts only the frontend service (Vite + React)

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Function to keep window open on exit
pause_on_exit() {
    echo ""
    echo -e "${YELLOW}Process ended. Press Enter to close this window...${NC}"
    read
}

trap pause_on_exit EXIT

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        SmartCore Factory Attendance System                 ║${NC}"
echo -e "${BLUE}║              Starting Frontend Only...                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use!${NC}"
    echo -e "${YELLOW}   It seems the frontend is already running.${NC}"
    echo -e "${YELLOW}   Please stop it first or run ./stop.sh${NC}"
    exit 1
fi

# Step 1: Start Frontend
echo -e "${GREEN}[1/1]${NC} Starting Frontend (Vite + React)..."
cd "$FRONTEND_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Running npm install...${NC}"
    npm install --legacy-peer-deps
fi

echo -e "${GREEN}✓ Ready to start${NC}"
echo -e "${BLUE}Starting Vite server...${NC}"
echo -e "  URL: http://localhost:3000"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Run npm run dev
npm run dev
