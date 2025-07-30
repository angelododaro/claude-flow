# 🚀 Launch RAGBOARD - Complete Setup Guide

## Prerequisites Check

Before launching, ensure you have:
- ✅ Node.js 18+ and npm installed
- ✅ Python 3.8+ installed
- ✅ API keys added to the appropriate .env file

## 🔧 Configuration Setup

### 1. Backend API Keys Configuration

Since you've added API keys to `.env.local`, we need to ensure the backend can access them. 

**Option A: Copy keys to backend .env**
```bash
cd /workspaces/claude-flow/ragboard/backend

# Edit the .env file and add your keys
nano .env

# Add these lines (replace with your actual keys):
OPENAI_API_KEY=your-actual-openai-key
ANTHROPIC_API_KEY=your-actual-anthropic-key
LANGCHAIN_API_KEY=your-actual-langchain-key
REQUESTY_API_KEY=your-actual-requesty-key
```

**Option B: Use environment variables**
```bash
# Export keys for current session
export OPENAI_API_KEY="your-actual-openai-key"
export ANTHROPIC_API_KEY="your-actual-anthropic-key"
```

## 🚀 Launch Instructions

### Step 1: Install Dependencies

```bash
# Frontend dependencies
cd /workspaces/claude-flow/ragboard
npm install

# Backend dependencies
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Database Setup

```bash
# Make sure you're in the backend directory
cd /workspaces/claude-flow/ragboard/backend

# Run database migrations
alembic upgrade head

# Create initial admin user (optional)
python -c "from app.db.init_db import init_db; init_db()"
```

### Step 3: Start the Servers

**Terminal 1 - Backend:**
```bash
cd /workspaces/claude-flow/ragboard/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd /workspaces/claude-flow/ragboard
npm run dev
```

### Step 4: Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/api/v1/docs

## 🧪 Quick Test Checklist

### 1. Backend Health Check
```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy","app":"RAGBOARD","version":"1.0.0"}
```

### 2. API Documentation
- Open http://localhost:8000/api/v1/docs
- You should see the Swagger UI with all endpoints

### 3. Frontend Loading
- Open http://localhost:5173
- The RAGBOARD interface should load
- Check browser console for any errors (F12)

### 4. Test Core Features

**Create a Board:**
1. Click "New Board" or similar button
2. Give it a name
3. The canvas should appear

**Add a Node:**
1. Use the sidebar to add different node types
2. Try adding a text node first
3. Drag it around the canvas

**Test AI Chat (if API keys are configured):**
1. Add an AI Chat node
2. Connect some content nodes to it
3. Try asking a question

## 🐛 Troubleshooting

### Backend Won't Start

**Error: "No module named 'app'"**
```bash
# Make sure you're in the backend directory
cd /workspaces/claude-flow/ragboard/backend
export PYTHONPATH=$PYTHONPATH:$(pwd)
```

**Error: "API key not found"**
- Check that your API keys are in the backend .env file
- Ensure no quotes around the keys in .env
- Keys should be on separate lines

### Frontend Won't Connect

**Error: "Failed to fetch"**
- Check backend is running on port 8000
- Check CORS settings in backend
- Try: `VITE_API_BASE_URL=http://localhost:8000/api/v1`

### Database Errors

**Error: "No such table"**
```bash
cd backend
alembic upgrade head
```

## 📊 Verify Everything is Working

Run this verification script:

```bash
#!/bin/bash
echo "🔍 Checking RAGBOARD status..."

# Check if backend is running
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not running"
fi

# Check if frontend is running
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend is running"
else
    echo "❌ Frontend is not running"
fi

# Check API keys (backend)
echo "🔑 Checking API keys configuration..."
cd /workspaces/claude-flow/ragboard/backend
python -c "
from app.core.config import settings
print('OpenAI:', 'Configured' if settings.openai_api_key else 'Missing')
print('Anthropic:', 'Configured' if settings.anthropic_api_key else 'Missing')
"
```

## 🎯 Next Steps

Once everything is running:

1. **Test Basic Features**
   - Create boards
   - Add various node types
   - Test drag and drop
   - Save and load boards

2. **Test AI Features** (if keys configured)
   - AI chat functionality
   - Content analysis
   - Smart suggestions

3. **Test Collaboration**
   - Open in multiple browsers
   - Test real-time updates

## 📱 Quick Access Links

- **App**: http://localhost:5173
- **API Docs**: http://localhost:8000/api/v1/docs
- **Health Check**: http://localhost:8000/health

## 🆘 Need Help?

If you encounter issues:
1. Check the logs in both terminal windows
2. Look for error messages in browser console
3. Verify all dependencies are installed
4. Ensure API keys are properly configured
5. Check that ports 5173 and 8000 are not in use

---

**Ready to launch! 🚀** Follow the steps above and RAGBOARD should be up and running.