#!/usr/bin/env python3
"""
Simple backend startup script that bypasses ChromaDB initialization
"""
import os
import sys
import uvicorn

# Set environment to bypass ChromaDB initialization
os.environ["SKIP_CHROMADB_INIT"] = "true"

# Add the backend directory to Python path
sys.path.insert(0, "/workspaces/claude-flow/ragboard/backend")

# Change to backend directory
os.chdir("/workspaces/claude-flow/ragboard/backend")

if __name__ == "__main__":
    print("🚀 Starting RAGBOARD backend (simplified mode)...")
    print("📝 ChromaDB initialization disabled for quick start")
    print("🔑 API keys configured from .env file")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )