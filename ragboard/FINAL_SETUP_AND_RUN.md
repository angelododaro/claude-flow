# 🚀 RAGBOARD - Final Setup & Run Guide

## Quick Start (3 Steps)

### Step 1: Configure API Keys

Since you've added API keys to `.env.local`, run this to copy them to the backend:

```bash
cd /workspaces/claude-flow/ragboard
python3 configure-api-keys.py
```

This will:
- Check your `.env.local` for API keys
- Copy them to the backend `.env` file
- Prompt for any missing keys

### Step 2: Launch RAGBOARD

```bash
./launch.sh
```

This script will:
- Check prerequisites
- Install dependencies
- Set up the database
- Start both frontend and backend
- Show you the URLs to access

### Step 3: Verify Everything Works

```bash
python3 test-ragboard.py
```

This will test:
- Backend health
- Frontend accessibility  
- Database connection
- API endpoints

## 📱 Access RAGBOARD

Once running, access:
- **App**: http://localhost:5173
- **API Docs**: http://localhost:8000/api/v1/docs
- **Health Check**: http://localhost:8000/health

## 🧪 Test Core Features

### 1. Create Your First Board
- Click "New Board" or the + button
- Give it a name (e.g., "My First RAG Board")
- You should see an empty canvas

### 2. Add Content Nodes
Try adding different types:
- **Text Node**: Click text icon, type something
- **URL Node**: Add a website URL
- **Image Node**: Upload an image
- **Document**: Upload a PDF or text file

### 3. Test AI Chat (if API keys configured)
- Add an AI Chat node
- Connect content nodes to it (drag from node to AI chat)
- Ask questions about the connected content

## 🔧 Manual Setup (if launch.sh doesn't work)

### Backend Setup
```bash
cd /workspaces/claude-flow/ragboard/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Add your API keys to backend/.env
echo "OPENAI_API_KEY=your-key-here" >> .env
echo "ANTHROPIC_API_KEY=your-key-here" >> .env

# Run migrations
alembic upgrade head

# Start backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup (new terminal)
```bash
cd /workspaces/claude-flow/ragboard
npm install
npm run dev
```

## 🐛 Common Issues & Solutions

### "No API keys found"
Edit `backend/.env` and add:
```
OPENAI_API_KEY=your-actual-key
ANTHROPIC_API_KEY=your-actual-key
```

### "Cannot connect to backend"
- Check backend is running: `curl http://localhost:8000/health`
- Check no firewall blocking port 8000
- Try restarting: `./launch.sh`

### "Database errors"
```bash
cd backend
alembic upgrade head
```

### "Frontend won't load"
- Clear browser cache
- Check console for errors (F12)
- Ensure npm dependencies installed

## ✨ What's Working

Based on the 85% completion status:
- ✅ Canvas with drag & drop
- ✅ Multiple node types
- ✅ AI chat integration
- ✅ File uploads
- ✅ Export functionality
- ✅ Voice recording
- ✅ Video player
- ✅ Basic authentication

## 🚧 What's Still In Progress

- ⏳ Full RAG pipeline (basic version works)
- ⏳ Real-time collaboration
- ⏳ Advanced permissions
- ⏳ Some file processing features

## 📝 Quick Feature Test Checklist

- [ ] Create a new board
- [ ] Add a text node
- [ ] Drag the node around
- [ ] Add an AI chat node
- [ ] Connect nodes together
- [ ] Upload an image
- [ ] Add a URL
- [ ] Test voice recording
- [ ] Export the board
- [ ] Save and reload

## 🎯 Next Steps

Once RAGBOARD is running:

1. **Configure AI**: Make sure API keys are set in backend/.env
2. **Create Content**: Start building your knowledge boards
3. **Test Features**: Try all the different node types
4. **Report Issues**: Note any bugs or missing features

## 💡 Tips

- **Performance**: For large boards, use folders to organize nodes
- **AI Chat**: Connect multiple nodes for better context
- **Shortcuts**: Press 'S' to quickly add social media content
- **Export**: Use the export button to save your boards as images

---

**Ready to go! 🎉** Run `./launch.sh` and start building your visual knowledge boards!