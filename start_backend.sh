#!/bin/bash

# SmartCore Factory Attendance System - Backend Startup Script
# Description: Starts only the backend service (FastAPI)

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

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        SmartCore Factory Attendance System                 ║${NC}"
echo -e "${BLUE}║              Starting Backend Only...                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if port 8000 is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  Port 8000 is already in use!${NC}"
    echo -e "${YELLOW}   It seems the backend is already running.${NC}"
    echo -e "${YELLOW}   Please stop it first or run ./stop.sh${NC}"
    exit 1
fi

# Step 1: Start Backend
echo -e "${GREEN}[1/1]${NC} Starting Backend (FastAPI)..."
cd "$BACKEND_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}✗ Virtual environment not found!${NC}"
    echo -e "${YELLOW}  Please run: cd backend && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt${NC}"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# check python
if ! command -v python &> /dev/null; then
     echo -e "${RED}Python could not be found via venv!${NC}"
     exit 1
fi

echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo -e "${BLUE}Starting uvicorn server...${NC}"
echo -e "  API: http://127.0.0.1:8000"
echo -e "  Docs: http://127.0.0.1:8000/docs"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Run in foreground
exec python main.py
