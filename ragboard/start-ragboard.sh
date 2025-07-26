#!/bin/bash

# Simple startup script for RAGBOARD
cd /workspaces/claude-flow/ragboard

echo "Starting RAGBOARD..."

# Start backend
echo "Starting backend..."
cd backend
source venv/bin/activate
python run_local.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend
sleep 5

# Start frontend  
echo "Starting frontend..."
cd ..
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "RAGBOARD is starting up..."
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:8000"
echo "API Docs: http://localhost:8000/api/v1/docs"
echo ""
echo "Press Ctrl+C to stop"

# Wait for interrupt
wait