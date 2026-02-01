#!/bin/bash

# SmartCore Factory Attendance System - Status Check Script
# Author: AI Assistant
# Description: Kiểm tra trạng thái của tất cả các service

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
echo -e "${BLUE}║                  System Status Check                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if PID file exists
if [ -f "$PID_FILE" ]; then
    BACKEND_PID=$(sed -n '1p' "$PID_FILE")
    FRONTEND_PID=$(sed -n '2p' "$PID_FILE")
    echo -e "${BLUE}PID File Found:${NC} $PID_FILE"
    echo -e "  Backend PID:  $BACKEND_PID"
    echo -e "  Frontend PID: $FRONTEND_PID"
else
    echo -e "${YELLOW}⚠️  No PID file found${NC}"
    BACKEND_PID=""
    FRONTEND_PID=""
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check Backend Status
echo -e "${BLUE}Backend Service:${NC}"
if [ -n "$BACKEND_PID" ] && ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo -e "  Status: ${GREEN}● Running${NC} (PID: $BACKEND_PID)"
    
    # Check if port 8000 is listening
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  Port:   ${GREEN}✓ 8000 (listening)${NC}"
    else
        echo -e "  Port:   ${YELLOW}⚠ 8000 (not listening)${NC}"
    fi
    
    # Check if API is responding
    if curl -s http://127.0.0.1:8000/docs > /dev/null 2>&1; then
        echo -e "  Health: ${GREEN}✓ API responding${NC}"
        echo -e "  URL:    http://127.0.0.1:8000"
        echo -e "  Docs:   http://127.0.0.1:8000/docs"
    else
        echo -e "  Health: ${RED}✗ API not responding${NC}"
    fi
else
    echo -e "  Status: ${RED}● Stopped${NC}"
    
    # Check if any Python process is running main.py
    RUNNING_BACKEND=$(pgrep -f "python.*main.py" || true)
    if [ -n "$RUNNING_BACKEND" ]; then
        echo -e "  ${YELLOW}⚠️  Found orphaned backend process(es): $RUNNING_BACKEND${NC}"
    fi
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check Frontend Status
echo -e "${BLUE}Frontend Service:${NC}"
if [ -n "$FRONTEND_PID" ] && ps -p $FRONTEND_PID > /dev/null 2>&1; then
    echo -e "  Status: ${GREEN}● Running${NC} (PID: $FRONTEND_PID)"
    
    # Check if port 3000 is listening
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  Port:   ${GREEN}✓ 3000 (listening)${NC}"
    else
        echo -e "  Port:   ${YELLOW}⚠ 3000 (not listening)${NC}"
    fi
    
    # Check if frontend is responding
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "  Health: ${GREEN}✓ Server responding${NC}"
        echo -e "  URL:    http://localhost:3000"
    else
        echo -e "  Health: ${YELLOW}⚠ Server not responding (may still be starting)${NC}"
    fi
else
    echo -e "  Status: ${RED}● Stopped${NC}"
    
    # Check if any Vite process is running
    RUNNING_FRONTEND=$(pgrep -f "vite.*dev" || true)
    if [ -n "$RUNNING_FRONTEND" ]; then
        echo -e "  ${YELLOW}⚠️  Found orphaned frontend process(es): $RUNNING_FRONTEND${NC}"
    fi
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check Database
echo -e "${BLUE}Database:${NC}"
DB_PATH="$SCRIPT_DIR/backend/data/attendance.db"
if [ -f "$DB_PATH" ]; then
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    echo -e "  Status: ${GREEN}✓ Found${NC}"
    echo -e "  Path:   $DB_PATH"
    echo -e "  Size:   $DB_SIZE"
else
    echo -e "  Status: ${YELLOW}⚠ Not found${NC}"
    echo -e "  ${YELLOW}Database will be created on first backend startup${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check Logs
echo -e "${BLUE}Logs:${NC}"
BACKEND_LOG="$SCRIPT_DIR/logs/backend.log"
FRONTEND_LOG="$SCRIPT_DIR/logs/frontend.log"

if [ -f "$BACKEND_LOG" ]; then
    BACKEND_LOG_SIZE=$(du -h "$BACKEND_LOG" | cut -f1)
    BACKEND_LOG_LINES=$(wc -l < "$BACKEND_LOG")
    echo -e "  Backend:  ${GREEN}✓${NC} $BACKEND_LOG ($BACKEND_LOG_SIZE, $BACKEND_LOG_LINES lines)"
else
    echo -e "  Backend:  ${YELLOW}⚠ No log file${NC}"
fi

if [ -f "$FRONTEND_LOG" ]; then
    FRONTEND_LOG_SIZE=$(du -h "$FRONTEND_LOG" | cut -f1)
    FRONTEND_LOG_LINES=$(wc -l < "$FRONTEND_LOG")
    echo -e "  Frontend: ${GREEN}✓${NC} $FRONTEND_LOG ($FRONTEND_LOG_SIZE, $FRONTEND_LOG_LINES lines)"
else
    echo -e "  Frontend: ${YELLOW}⚠ No log file${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Summary
echo ""
BACKEND_OK=false
FRONTEND_OK=false

if [ -n "$BACKEND_PID" ] && ps -p $BACKEND_PID > /dev/null 2>&1 && curl -s http://127.0.0.1:8000/docs > /dev/null 2>&1; then
    BACKEND_OK=true
fi

if [ -n "$FRONTEND_PID" ] && ps -p $FRONTEND_PID > /dev/null 2>&1; then
    FRONTEND_OK=true
fi

if $BACKEND_OK && $FRONTEND_OK; then
    echo -e "${GREEN}✓ System is running normally${NC}"
    echo -e "${BLUE}  Access the application at: ${YELLOW}http://localhost:3000${NC}"
elif $BACKEND_OK || $FRONTEND_OK; then
    echo -e "${YELLOW}⚠️  System is partially running${NC}"
    if ! $BACKEND_OK; then
        echo -e "${YELLOW}  Backend is not running properly${NC}"
    fi
    if ! $FRONTEND_OK; then
        echo -e "${YELLOW}  Frontend is not running properly${NC}"
    fi
    echo -e "${BLUE}  Try restarting: ${YELLOW}./stop.sh && ./start.sh${NC}"
else
    echo -e "${RED}✗ System is not running${NC}"
    echo -e "${BLUE}  Start the system: ${YELLOW}./start.sh${NC}"
fi

echo ""
