#!/bin/bash
"""
Startup script for RAGBOARD backend services.
Starts both the FastAPI server and Celery worker.
"""

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting RAGBOARD Backend Services${NC}"

# Check if Redis is running
echo -e "${YELLOW}📋 Checking Redis connection...${NC}"
if ! redis-cli ping > /dev/null 2>&1; then
    echo -e "${RED}❌ Redis is not running. Please start Redis first:${NC}"
    echo -e "${YELLOW}   docker run -d -p 6379:6379 redis:alpine${NC}"
    echo -e "${YELLOW}   # OR#"
    echo -e "${YELLOW}   sudo systemctl start redis${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Redis is running${NC}"

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Creating virtual environment...${NC}"
    python3 -m venv venv
fi

echo -e "${YELLOW}📦 Activating virtual environment...${NC}"
source venv/bin/activate

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pip install -r requirements.txt

# Create necessary directories
mkdir -p ./uploads
mkdir -p ./chroma_db
mkdir -p ./logs

# Function to cleanup on exit
cleanup() {
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    kill $CELERY_PID $API_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# Start Celery worker in background
echo -e "${YELLOW}🔄 Starting Celery worker...${NC}"
celery -A celery_worker worker --loglevel=info --concurrency=4 &
CELERY_PID=$!
echo -e "${GREEN}✅ Celery worker started (PID: $CELERY_PID)${NC}"

# Wait a moment for Celery to start
sleep 2

# Start FastAPI server in background
echo -e "${YELLOW}🌐 Starting FastAPI server...${NC}"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
API_PID=$!
echo -e "${GREEN}✅ FastAPI server started (PID: $API_PID)${NC}"

echo -e "${GREEN}🎉 All services started successfully!${NC}"
echo -e "${BLUE}📊 Service Status:${NC}"
echo -e "   🌐 API Server: http://localhost:8000"
echo -e "   📚 API Docs: http://localhost:8000/docs"
echo -e "   🔄 Celery Worker: Running (PID: $CELERY_PID)"
echo -e "   📊 Redis: Running"

echo -e "${YELLOW}💡 Use Ctrl+C to stop all services${NC}"

# Wait for both processes
wait $CELERY_PID $API_PID