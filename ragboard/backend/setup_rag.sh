#!/bin/bash
# Setup script for RAG pipeline dependencies

echo "🚀 Setting up RAG Pipeline dependencies..."

# Install Python dependencies
echo "📦 Installing Python packages..."
pip install -r requirements.txt

# Install system dependencies for OCR (if needed)
if ! command -v tesseract &> /dev/null; then
    echo "📦 Installing Tesseract OCR..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update
        sudo apt-get install -y tesseract-ocr tesseract-ocr-eng
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install tesseract
    else
        echo "⚠️  Please install Tesseract OCR manually for your OS"
    fi
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads
mkdir -p chroma_db
mkdir -p logs

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# RAGBOARD Configuration

# Application
APP_NAME=RAGBOARD
DEBUG=True
ENVIRONMENT=development

# Database
DATABASE_URL=sqlite+aiosqlite:///./ragboard.db

# AI Providers (add your API keys here)
OPENAI_API_KEY=your-openai-api-key-here
# ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Vector Database
CHROMA_PERSIST_DIRECTORY=./chroma_db
CHROMA_COLLECTION_NAME=ragboard_vectors

# File Upload
MAX_UPLOAD_SIZE=104857600
UPLOAD_DIR=./uploads

# OCR Settings
OCR_LANGUAGES=eng

# Logging
LOG_LEVEL=INFO
EOF
    echo "⚠️  Please update .env file with your API keys!"
fi

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update .env file with your OpenAI API key"
echo "2. Run the test script: python test_rag_pipeline.py"
echo "3. Start the backend server: uvicorn app.main:app --reload"