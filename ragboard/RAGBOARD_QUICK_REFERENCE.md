# 🚀 RAGBOARD Quick Reference Guide

## 📊 Project Status Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│                    RAGBOARD Status: 85% Complete             │
├─────────────────────────────────────────────────────────────┤
│ ✅ Core Features      │ 🔧 In Progress     │ ❌ Not Started  │
├─────────────────────────────────────────────────────────────┤
│ • React Canvas       │ • Authorization    │ • LangChain     │
│ • Drag & Drop        │ • RAG Pipeline     │ • Analytics     │
│ • Basic Nodes        │ • WebSockets       │ • Excalidraw    │
│ • Export Feature     │ • Collaboration    │ • Advanced AI   │
│ • Voice Recording    │                    │                 │
│ • Video Player       │                    │                 │
└─────────────────────────────────────────────────────────────┘
```

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
├────────────────┬────────────────┬────────────────────────────┤
│  UI Components │ State (Zustand) │    Collaboration (Yjs)    │
├────────────────┴────────────────┴────────────────────────────┤
│                    WebSocket Connection                       │
├──────────────────────────────────────────────────────────────┤
│                    Backend (FastAPI)                          │
├─────────┬──────────┬───────────┬──────────┬─────────────────┤
│   Auth  │   RAG    │ Processing│ Real-time│    AI/LLM       │
├─────────┴──────────┴───────────┴──────────┴─────────────────┤
│              Database Layer (PostgreSQL + Redis)              │
├──────────────────────────────────────────────────────────────┤
│            Vector Database (ChromaDB/Pinecone)                │
└──────────────────────────────────────────────────────────────┘
```

## 📁 Module Structure

```
ragboard/
├── src/modules/           # Frontend modules
│   ├── authorization/     # CASL permissions
│   ├── collaboration/     # Yjs real-time
│   ├── rag-pipeline/     # Search & AI
│   ├── file-processing/  # Upload handling
│   └── analytics/        # PostHog tracking
│
├── backend/modules/      # Backend modules
│   ├── auth/            # Auth & permissions
│   ├── rag/             # Embeddings & search
│   ├── processing/      # File processors
│   ├── realtime/        # WebSocket handlers
│   └── ai/              # LangChain integration
│
└── shared/              # Shared types & utils
```

## 🚦 Quick Commands

### Development
```bash
# Start frontend
cd ragboard && npm run dev

# Start backend
cd backend && uvicorn app.main:app --reload

# Run tests
npm test                    # Frontend
pytest                      # Backend

# Type checking
npm run typecheck          # Frontend
mypy app                   # Backend
```

### Docker
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Reset database
docker-compose down -v
docker-compose up -d
```

## 🔑 Key Components Reference

### Frontend Components

| Component | Purpose | Location |
|-----------|---------|----------|
| BoardCanvas | Main canvas with ReactFlow | src/components/BoardCanvas.tsx |
| ResourceNode | Generic node wrapper | src/components/ResourceNode.tsx |
| AIChatNode | AI chat interface | src/components/AIChatNode.tsx |
| YjsProvider | Real-time collaboration | src/modules/collaboration/providers/YjsProvider.tsx |
| PermissionGate | Authorization wrapper | src/modules/authorization/components/PermissionGate.tsx |

### Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/boards | GET/POST | Board CRUD |
| /api/boards/{id}/process | POST | Trigger RAG processing |
| /api/boards/{id}/search | POST | Semantic search |
| /api/resources | POST | Upload resources |
| /ws/board/{id} | WS | Real-time updates |

## 🎯 Implementation Checklist

### Phase 1: Authorization (Week 1)
- [ ] Setup CASL abilities
- [ ] Add PermissionGate components
- [ ] Secure API endpoints
- [ ] Add role management UI
- [ ] Test permission flows

### Phase 2: RAG Pipeline (Week 2)
- [ ] ChromaDB integration
- [ ] Content extractors
- [ ] Embedding generation
- [ ] Semantic search API
- [ ] WebSocket setup

### Phase 3: Collaboration (Week 3)
- [ ] Yjs document structure
- [ ] Presence indicators
- [ ] Cursor tracking
- [ ] Conflict resolution
- [ ] Offline support

### Phase 4: Enhancements (Week 4)
- [ ] LangChain agents
- [ ] PDF/OCR processing
- [ ] PostHog analytics
- [ ] Excalidraw whiteboard
- [ ] Performance monitoring

## 🔧 Configuration Files

### Environment Variables
```env
# Frontend (.env)
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:1234
VITE_POSTHOG_KEY=your_key

# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost/ragboard
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```

### TypeScript Config
```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@modules/*": ["src/modules/*"]
    }
  }
}
```

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| CORS errors | Check backend CORS middleware configuration |
| WebSocket disconnects | Verify WS_URL in frontend config |
| Permission denied | Check user roles and CASL abilities |
| Slow RAG search | Optimize embedding chunk size |
| Memory leaks | Clean up Yjs observers on unmount |

## 📈 Performance Targets

- **Page Load**: < 2s
- **Search Response**: < 500ms
- **Real-time Sync**: < 100ms
- **File Processing**: < 5s for PDFs
- **Concurrent Users**: 50+ per board

## 🔗 Useful Resources

- [ReactFlow Docs](https://reactflow.dev/)
- [CASL Guide](https://casl.js.org/v6/en/guide/intro)
- [Yjs Documentation](https://docs.yjs.dev/)
- [LangChain Docs](https://docs.langchain.com/)
- [ChromaDB Guide](https://docs.trychroma.com/)

## 🚀 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Redis cache configured
- [ ] File storage (S3) setup
- [ ] SSL certificates installed
- [ ] Monitoring dashboards created
- [ ] Backup strategy implemented
- [ ] Rate limiting configured
- [ ] Security headers added
- [ ] Performance testing completed

---

**Remember**: This is a living document. Update it as the project evolves!