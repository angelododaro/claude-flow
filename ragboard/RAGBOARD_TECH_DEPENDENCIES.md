# 🔧 RAGBOARD Technical Dependencies Analysis

## 📦 Current vs Target Technology Stack

### Frontend Dependencies

#### Currently Installed ✅
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.0.0",
  "vite": "^4.4.5",
  "tailwindcss": "^3.3.0",
  "zustand": "^4.4.0",
  "reactflow": "^11.10.0",
  "@tiptap/react": "^2.0.0",
  "recordrtc": "^5.6.2",
  "video.js": "^8.6.1",
  "html2canvas": "^1.4.1",
  "jspdf": "^2.5.1",
  "@casl/ability": "^6.5.0",
  "@casl/react": "^3.1.0",
  "yjs": "^13.6.0"
}
```

#### Required to Install ❌
```json
{
  "@excalidraw/excalidraw": "^0.17.0",
  "y-websocket": "^1.5.0",
  "y-indexeddb": "^9.0.0",
  "@langchain/core": "^0.3.0",
  "@langchain/community": "^0.3.0",
  "socket.io-client": "^4.8.0",
  "posthog-js": "^1.180.0",
  "@vercel/ai": "^3.0.0",
  "lexical": "^0.12.0",
  "@lexical/react": "^0.12.0",
  "pdf.js": "^3.11.0",
  "wavesurfer.js": "^7.8.0",
  "@supabase/supabase-js": "^2.45.0",
  "@trpc/client": "^11.0.0",
  "@trpc/react-query": "^11.0.0",
  "@tanstack/react-query": "^5.0.0"
}
```

### Backend Dependencies

#### Currently Installed ✅
```python
# requirements.txt
fastapi==0.104.1
sqlalchemy==2.0.23
asyncpg==0.29.0
redis==5.0.1
pydantic==2.5.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
uvicorn==0.24.0
alembic==1.12.1
```

#### Required to Install ❌
```python
# Additional requirements
langchain==0.3.0
langchain-community==0.3.0
chromadb==0.5.0
openai==1.50.0
anthropic==0.35.0
sentence-transformers==3.0.0
unstructured==0.15.0
pdf2image==1.17.0
pytesseract==0.3.10
whisper==1.1.10
minio==7.2.0
supabase==2.7.0
prisma==0.13.0
trpc==0.1.0
partykit==0.1.0
posthog==3.6.0
sentry-sdk==2.0.0
pytest-playwright==0.5.0
```

## 🔄 Integration Dependencies

### Real-time Collaboration Stack
```yaml
Primary:
  - yjs: CRDT framework (installed)
  - y-websocket: WebSocket provider (missing)
  - y-indexeddb: Offline persistence (missing)
  - partykit: Edge runtime for sync (missing)

Supporting:
  - socket.io: Fallback WebSocket (missing)
  - redis: Pub/sub for presence (installed)
```

### AI/RAG Pipeline Stack
```yaml
Vector Database:
  - chromadb: Primary vector store (missing)
  - qdrant-client: Alternative option (missing)

Embeddings:
  - openai: OpenAI embeddings (missing)
  - sentence-transformers: Local embeddings (missing)

LLM Framework:
  - langchain: Orchestration (missing)
  - langchain-community: Integrations (missing)
  - vercel/ai: Streaming responses (missing)

Document Processing:
  - unstructured: Document parsing (missing)
  - pdf2image: PDF rendering (missing)
  - pytesseract: OCR (missing)
  - whisper: Transcription (missing)
```

### Storage & Infrastructure
```yaml
Object Storage:
  - minio: S3-compatible storage (missing)
  - boto3: AWS SDK for S3 (optional)

Database:
  - prisma: ORM for tRPC (missing)
  - supabase: Auth + RLS (missing)

Monitoring:
  - posthog: Analytics (missing)
  - sentry: Error tracking (missing)
  - opentelemetry: Metrics (optional)
```

## 🏗️ Dependency Installation Order

### Phase 1: Security & Auth (Priority: CRITICAL)
```bash
# Frontend
npm install @supabase/supabase-js@^2.45.0

# Backend
pip install supabase==2.7.0

# Already installed: @casl/ability, @casl/react
```

### Phase 2: RAG Pipeline (Priority: HIGH)
```bash
# Frontend
npm install @langchain/core@^0.3.0 @langchain/community@^0.3.0 @vercel/ai@^3.0.0

# Backend
pip install langchain==0.3.0 langchain-community==0.3.0 chromadb==0.5.0
pip install openai==1.50.0 anthropic==0.35.0 sentence-transformers==3.0.0
```

### Phase 3: Real-time Collaboration (Priority: HIGH)
```bash
# Frontend
npm install y-websocket@^1.5.0 y-indexeddb@^9.0.0 socket.io-client@^4.8.0

# Backend
pip install partykit==0.1.0  # or custom WebSocket implementation
```

### Phase 4: File Processing (Priority: MEDIUM)
```bash
# Frontend
npm install pdfjs-dist@^3.11.0 wavesurfer.js@^7.8.0

# Backend
pip install unstructured==0.15.0 pdf2image==1.17.0 pytesseract==0.3.10
pip install whisper==1.1.10 minio==7.2.0
```

### Phase 5: Canvas Enhancement (Priority: MEDIUM)
```bash
# Frontend
npm install @excalidraw/excalidraw@^0.17.0
npm install lexical@^0.12.0 @lexical/react@^0.12.0  # If switching from TipTap
```

### Phase 6: Infrastructure (Priority: LOW)
```bash
# Frontend
npm install posthog-js@^1.180.0
npm install @trpc/client@^11.0.0 @trpc/react-query@^11.0.0 @tanstack/react-query@^5.0.0

# Backend
pip install prisma==0.13.0 trpc==0.1.0
pip install posthog==3.6.0 sentry-sdk==2.0.0
```

## 🔌 System Dependencies

### Required System Packages
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-eng \
  poppler-utils \
  ffmpeg \
  libmagic1

# macOS
brew install tesseract poppler ffmpeg libmagic

# Docker services
docker run -d -p 5432:5432 postgres:15
docker run -d -p 6379:6379 redis:7
docker run -d -p 9000:9000 minio/minio
docker run -d -p 8000:8000 chromadb/chroma
```

## 🔐 API Keys & Environment Setup

### Required API Keys
```env
# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
REPLICATE_API_KEY=r8_...
HUGGINGFACE_API_KEY=hf_...

# Infrastructure
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Vector Database
CHROMA_SERVER_URL=http://localhost:8000
CHROMA_SERVER_API_KEY=optional-key

# Analytics & Monitoring
POSTHOG_API_KEY=phc_...
SENTRY_DSN=https://...@sentry.io/...

# Optional Services
PARTYKIT_API_KEY=pk_...
WHISPER_API_KEY=...
```

## 📊 Dependency Conflict Resolution

### Known Conflicts
1. **FastAPI vs tRPC**: Current backend uses FastAPI, target uses tRPC
   - Solution: Gradual migration or API adapter layer

2. **SQLAlchemy vs Prisma**: Different ORMs
   - Solution: Keep SQLAlchemy, skip Prisma migration

3. **TipTap vs Lexical**: Rich text editors
   - Solution: Keep TipTap (already working well)

4. **ReactFlow vs Excalidraw**: Canvas implementations
   - Solution: Use both - ReactFlow for nodes, Excalidraw for whiteboard mode

## 🚀 Quick Start Commands

### Development Setup
```bash
# Clone and setup
git clone <repo>
cd ragboard

# Install frontend deps
cd frontend
npm install
npm install <missing-deps-from-phase-1>

# Install backend deps
cd ../backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
pip install <missing-deps-from-phase-1>

# Start services
docker-compose up -d  # PostgreSQL, Redis, MinIO, Chroma

# Run migrations
alembic upgrade head

# Start dev servers
npm run dev  # Frontend
uvicorn app.main:app --reload  # Backend
```

## 📈 Bundle Size Considerations

### Heavy Dependencies
- `@excalidraw/excalidraw`: ~2MB
- `pdfjs-dist`: ~1.5MB
- `@langchain/core`: ~500KB
- `lexical`: ~400KB

### Optimization Strategies
1. Dynamic imports for heavy components
2. Code splitting by route
3. Tree shaking unused features
4. CDN for large libraries
5. Lazy loading for optional features

---

*This dependency analysis provides a complete overview of current vs required technologies, installation order, and integration considerations for RAGBOARD development.*