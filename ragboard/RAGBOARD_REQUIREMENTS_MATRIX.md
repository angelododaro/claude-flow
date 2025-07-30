# 📊 RAGBOARD Requirements Matrix

## 🎯 Project Vision
**Purpose**: Open-source collaborative AI-powered research and ideation canvas platform
**Core Value**: Real-time collaboration with AI-assisted research using visual knowledge mapping

## 🏗️ Architecture Requirements

### Frontend Stack
| Component | Technology | Version | Status | Priority |
|-----------|------------|---------|---------|----------|
| Framework | Next.js | 14+ | ✅ React 18 | HIGH |
| Language | TypeScript | Latest | ✅ Implemented | HIGH |
| Canvas | Excalidraw + Y.js | Latest | ❌ Missing | HIGH |
| State Management | Zustand + Y.js | Latest | ✅ Zustand only | HIGH |
| Styling | Tailwind CSS | Latest | ✅ Implemented | HIGH |
| Build Tool | Vite | Latest | ✅ Implemented | HIGH |

### Backend Stack
| Component | Technology | Version | Status | Priority |
|-----------|------------|---------|---------|----------|
| API Framework | tRPC v11 | 11.x | ❌ FastAPI used | MEDIUM |
| Database | PostgreSQL | Latest | ✅ Implemented | HIGH |
| ORM | Prisma | Latest | ❌ SQLAlchemy used | MEDIUM |
| Auth | Supabase Auth | Latest | ❌ JWT basic | HIGH |
| Realtime | PartyKit | Latest | ❌ Missing | HIGH |
| Storage | MinIO (S3) | Latest | ❌ Missing | MEDIUM |
| Cache | Redis | Latest | ✅ Implemented | MEDIUM |

### AI/ML Stack
| Component | Technology | Purpose | Status | Priority |
|-----------|------------|---------|---------|----------|
| LLM Router | Requesty API | Central LLM routing | ❌ Missing | HIGH |
| AI Framework | LangChain | Chain orchestration | ❌ Missing | HIGH |
| Vector DB | Chroma | RAG storage | ❌ Missing | HIGH |
| Embeddings | OpenAI/Sentence | Text embeddings | ❌ Missing | HIGH |
| Transcription | Whisper API | Audio/video | ❌ Missing | MEDIUM |
| AI SDK | Vercel AI SDK | Streaming responses | ❌ Missing | MEDIUM |

### Infrastructure
| Component | Technology | Purpose | Status | Priority |
|-----------|------------|---------|---------|----------|
| Analytics | PostHog | Usage tracking | ❌ Missing | LOW |
| Metering | OpenMeter | Resource tracking | ❌ Missing | LOW |
| Monitoring | Sentry | Error tracking | ❌ Missing | MEDIUM |
| Testing | Vitest + Playwright | Test suite | ❌ Partial | MEDIUM |

## 🔐 Security Requirements

### Authentication & Authorization
| Feature | Description | Implementation | Status | Priority |
|---------|-------------|----------------|---------|----------|
| OAuth | Social logins | Supabase Auth | ❌ Missing | HIGH |
| Email/Password | Basic auth | Supabase Auth | ✅ JWT basic | HIGH |
| JWT Sessions | Token management | Supabase | ✅ Basic impl | HIGH |
| RLS | Row-level security | PostgreSQL | ❌ Missing | HIGH |
| CASL | Frontend permissions | CASL.js | ❌ Installed only | HIGH |
| Role System | Admin/Editor/Viewer/Guest | Custom | ❌ Missing | HIGH |

### Data Security
| Feature | Description | Status | Priority |
|---------|-------------|---------|----------|
| E2E Encryption | Y.js encryption | ❌ Missing | MEDIUM |
| Virus Scanning | Upload validation | ❌ Missing | MEDIUM |
| API Rate Limiting | Request throttling | ❌ Missing | HIGH |
| CORS Configuration | Cross-origin control | ⚠️ Dev only | HIGH |

## 🎨 Feature Requirements

### 1. Board & Canvas Features
| Feature | Description | Components | Status | Priority |
|---------|-------------|------------|---------|----------|
| Infinite Canvas | Zoomable, pannable | Excalidraw | ❌ ReactFlow only | HIGH |
| Resizable Frames | Container elements | Custom | ✅ Implemented | HIGH |
| Thumbnails | Board previews | Export service | ✅ Implemented | MEDIUM |
| Drag & Drop | Node positioning | ReactFlow | ✅ Implemented | HIGH |

### 2. Card/Node Types
| Type | Features | Editor/Tech | Status | Priority |
|------|----------|-------------|---------|----------|
| Text | Rich formatting, AI assist | Lexical/TipTap | ✅ TipTap | HIGH |
| Video | Embed, transcripts | Video.js + Whisper | ✅ Video.js only | HIGH |
| Image | Upload, AI generate | MinIO + Replicate | ⚠️ Local only | MEDIUM |
| Document | PDF viewing, parsing | pdf.js + Unstructured | ❌ Missing | HIGH |
| Audio | Record, playback | RecordRTC + WaveSurfer | ✅ RecordRTC | MEDIUM |
| Voice Note | Quick audio notes | MediaRecorder | ✅ Implemented | MEDIUM |
| AI Chat | LLM interactions | Custom | ✅ Basic | HIGH |
| Folder | Organization | Custom | ✅ Implemented | MEDIUM |
| URL | Link preview | Custom | ✅ Implemented | LOW |
| Annotation | Comments | Custom | ✅ Implemented | LOW |

### 3. Collaboration Features
| Feature | Description | Technology | Status | Priority |
|---------|-------------|------------|---------|----------|
| Real-time Sync | Live updates | Y.js + PartyKit | ❌ Missing | HIGH |
| Live Cursors | User presence | Y.js | ❌ Missing | MEDIUM |
| Comments | Inline feedback | Custom | ✅ Basic | MEDIUM |
| Mentions | User tagging | Custom | ❌ Missing | LOW |
| Typing Indicators | Activity status | WebSocket | ❌ Missing | LOW |
| Conflict Resolution | CRDT merge | Y.js | ❌ Missing | HIGH |
| Offline Support | Local changes | Y.js | ❌ Missing | MEDIUM |

### 4. AI Tooling Features
| Feature | Endpoint | Function | Status | Priority |
|---------|----------|----------|---------|----------|
| Chat Interface | /chat | Conversational AI | ✅ Basic | HIGH |
| RAG Pipeline | /rag/* | Context retrieval | ❌ Missing | HIGH |
| Content Generation | /generate-copy | AI writing | ❌ Missing | MEDIUM |
| Summarization | /summarize | Text summary | ❌ Missing | MEDIUM |
| Embeddings | /embed | Vector generation | ❌ Missing | HIGH |
| Semantic Search | /search | Context search | ❌ Missing | HIGH |

### 5. File Processing
| Type | Processing | Output | Status | Priority |
|------|------------|--------|---------|----------|
| PDF | Text extraction | Searchable text | ❌ Missing | HIGH |
| Images | OCR | Extracted text | ❌ Missing | MEDIUM |
| Audio | Transcription | Text + timestamps | ❌ Missing | MEDIUM |
| Video | Analysis | Transcript + frames | ❌ Missing | LOW |

### 6. Toolbar & Tools
| Tool | Function | Implementation | Status | Priority |
|------|----------|----------------|---------|----------|
| Comments | Feedback system | Sidebar panel | ✅ Basic | MEDIUM |
| Media Import | File upload | Modal dialog | ✅ Basic | HIGH |
| Explore | Trend discovery | Search interface | ❌ Missing | LOW |
| File Upload | Bulk import | Drag & drop | ✅ Basic | HIGH |
| Voice Recorder | Audio capture | RecordRTC | ✅ Implemented | MEDIUM |
| AI Assistant | Chat interface | Sidebar | ✅ Basic | HIGH |

## 📊 Data Models

### Core Entities
| Entity | Fields | Relationships | Status |
|--------|--------|---------------|---------|
| User | id, email, role, settings | boards, comments | ✅ Basic |
| Board | id, title, thumbnail, metadata | owner, nodes, collaborators | ✅ Implemented |
| Node | id, type, position, content | board, connections | ✅ Implemented |
| Connection | id, source, target, metadata | nodes | ✅ Implemented |
| Comment | id, text, author, timestamp | node, board, user | ✅ Basic |
| Embedding | id, vector, metadata | node, collection | ❌ Missing |

## 🔄 Development Phases (Original Plan)

### Phase 1: Foundation
| Task | Description | Status | Effort |
|------|-------------|---------|--------|
| Auth Setup | Supabase integration | ❌ JWT only | 2 days |
| Database | Schema + migrations | ✅ Complete | 1 day |
| Board CRUD | Basic operations | ✅ Complete | 2 days |
| Excalidraw | Canvas integration | ❌ Missing | 3 days |

### Phase 2: Canvas Polish
| Task | Description | Status | Effort |
|------|-------------|---------|--------|
| Card Types | All node implementations | ✅ 80% done | 3 days |
| Rich Text | Lexical editor | ✅ TipTap used | 1 day |
| Media Handling | Upload/preview | ⚠️ Basic only | 2 days |

### Phase 3: AI Integration
| Task | Description | Status | Effort |
|------|-------------|---------|--------|
| LangChain | Setup chains | ❌ Missing | 3 days |
| Whisper | Transcription | ❌ Missing | 2 days |
| RAG Pipeline | Vector indexing | ❌ Missing | 4 days |
| Embeddings | Generation + storage | ❌ Missing | 2 days |

### Phase 4: Real-time Collaboration
| Task | Description | Status | Effort |
|------|-------------|---------|--------|
| Y.js Setup | CRDT integration | ❌ Missing | 3 days |
| PartyKit | WebSocket server | ❌ Missing | 2 days |
| Presence | Cursors + indicators | ❌ Missing | 2 days |
| Sync Logic | Conflict resolution | ❌ Missing | 3 days |

### Phase 5: Integrations & APIs
| Task | Description | Status | Effort |
|------|-------------|---------|--------|
| Plugin System | Registry + SDK | ❌ Missing | 3 days |
| External APIs | Third-party | ❌ Missing | 2 days |
| Webhooks | Event system | ❌ Missing | 2 days |

### Phase 6: Testing & Performance
| Task | Description | Status | Effort |
|------|-------------|---------|--------|
| Unit Tests | Component testing | ⚠️ Minimal | 3 days |
| E2E Tests | Playwright | ❌ Missing | 3 days |
| Performance | Optimization | ❌ Missing | 2 days |
| Documentation | API + guides | ⚠️ Basic | 2 days |

## 🚀 Deployment Requirements

### Infrastructure
| Component | Solution | Configuration | Status |
|-----------|----------|---------------|---------|
| Frontend | Vercel/Coolify | Next.js app | ❌ Local only |
| Backend | Fly.io/Railway | FastAPI | ❌ Local only |
| Database | PostgreSQL | Managed instance | ✅ Docker |
| Vector DB | Chroma/Qdrant | Self-hosted | ❌ Missing |
| Storage | MinIO | S3-compatible | ❌ Missing |
| Cache | Redis | Managed | ✅ Docker |

### Environment Variables
```env
# Required
NEXT_PUBLIC_MODEL_PROVIDER=claude
NEXT_PUBLIC_RAG_INDEX=chroma
NEXT_PUBLIC_ANALYTICS=posthog
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

# Optional
REPLICATE_API_KEY=...
WHISPER_API_KEY=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
SENTRY_DSN=...
POSTHOG_API_KEY=...
```

## 📈 Success Metrics

### Technical KPIs
| Metric | Target | Current | Priority |
|--------|--------|---------|----------|
| Auth Coverage | 100% | ~20% | HIGH |
| RAG Accuracy | >90% | 0% | HIGH |
| RT Latency | <100ms | N/A | MEDIUM |
| File Processing | <5s | N/A | MEDIUM |
| Test Coverage | >80% | <10% | MEDIUM |

### User Experience KPIs
| Metric | Target | Description |
|--------|--------|-------------|
| Time to First Interaction | <3s | Page load to usable |
| Collaboration Sessions | >30min | Average duration |
| Content Connections | >5/board | Linked nodes |
| AI Engagement | >50% | Chat usage rate |

## 🎯 MVP Definition

### Core MVP Features (4 weeks)
1. **Secure Authentication** - Supabase with roles
2. **Canvas with All Node Types** - Complete implementation
3. **Basic RAG Pipeline** - Text extraction + search
4. **Real-time Updates** - WebSocket notifications
5. **File Upload & Processing** - PDF + images
6. **AI Chat with Context** - RAG-powered responses

### Post-MVP Enhancements
- Full Y.js collaboration
- Excalidraw whiteboard mode
- Advanced AI chains
- Plugin system
- Analytics dashboard
- Mobile optimization

## 📋 Implementation Priority Matrix

### 🔴 Critical (Week 1)
- CASL authorization system
- Complete RAG pipeline
- WebSocket real-time
- Supabase authentication

### 🟡 High (Week 2)
- Y.js collaboration
- File processing (PDF/OCR)
- LangChain integration
- MinIO storage

### 🟢 Medium (Week 3)
- Excalidraw integration
- Advanced AI features
- Performance optimization
- Testing suite

### 🔵 Low (Week 4)
- PostHog analytics
- Plugin system
- Trend discovery
- Mobile support

---

*This requirements matrix provides a comprehensive overview of all RAGBOARD features, their current status, and implementation priorities for modular development.*