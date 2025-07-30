#!/bin/bash

# RAGBOARD Launch Script
# This script starts both frontend and backend servers

echo "🚀 Starting RAGBOARD..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"
fi

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Python found: $(python3 --version)${NC}"
fi

# Check if ports are available
if port_in_use 8000; then
    echo -e "${YELLOW}⚠️  Port 8000 is in use. Killing existing process...${NC}"
    lsof -ti:8000 | xargs kill -9 2>/dev/null
fi

if port_in_use 5173; then
    echo -e "${YELLOW}⚠️  Port 5173 is in use. Killing existing process...${NC}"
    lsof -ti:5173 | xargs kill -9 2>/dev/null
fi

# Navigate to project root
cd /workspaces/claude-flow/ragboard

# Install frontend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Setup backend
echo "🔧 Setting up backend..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "🐍 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install -r requirements.txt --quiet

# Run database migrations
echo "🗄️ Running database migrations..."
alembic upgrade head 2>/dev/null || echo "Database already up to date"

# Check for API keys
echo "🔑 Checking API keys..."
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv()

keys_found = False
if os.getenv('OPENAI_API_KEY'):
    print('✅ OpenAI API key found')
    keys_found = True
else:
    print('⚠️  OpenAI API key not found')

if os.getenv('ANTHROPIC_API_KEY'):
    print('✅ Anthropic API key found')
    keys_found = True
else:
    print('⚠️  Anthropic API key not found')

if not keys_found:
    print('')
    print('💡 To add API keys, edit backend/.env and add:')
    print('   OPENAI_API_KEY=your-key-here')
    print('   ANTHROPIC_API_KEY=your-key-here')
"

# Start backend server
echo -e "\n${GREEN}🚀 Starting backend server...${NC}"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null; then
        echo -e "${GREEN}✅ Backend is running${NC}"
        break
    fi
    sleep 1
done

# Start frontend server
cd ..
echo -e "\n${GREEN}🚀 Starting frontend server...${NC}"
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null; then
        echo -e "${GREEN}✅ Frontend is running${NC}"
        break
    fi
    sleep 1
done

# Display access information
echo -e "\n${GREEN}🎉 RAGBOARD is running!${NC}"
echo -e "\n📱 Access the application at:"
echo -e "   ${GREEN}Frontend: http://localhost:5173${NC}"
echo -e "   ${GREEN}Backend API: http://localhost:8000${NC}"
echo -e "   ${GREEN}API Docs: http://localhost:8000/api/v1/docs${NC}"
echo -e "\n📋 Logs:"
echo -e "   Backend: backend/backend.log"
echo -e "   Frontend: frontend.log"
echo -e "\n🛑 To stop RAGBOARD:"
echo -e "   Press Ctrl+C or run: kill $BACKEND_PID $FRONTEND_PID"

# Keep script running and handle shutdown
trap "echo -e '\n🛑 Shutting down RAGBOARD...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

# Keep the script running
while true; do
    sleep 1
done