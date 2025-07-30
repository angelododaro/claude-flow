# RAGBOARD: Comprehensive Modular Development Plan

## Executive Summary

RAGBOARD is a visual board-style AI interface that combines mind-mapping with RAG (Retrieval-Augmented Generation) capabilities. This plan outlines a modular approach to rebuild Poppy AI as an open-source platform with real-time collaboration, AI-assisted research, and flexible media card-based ideation boards.

**Project Status**: Greenfield development (replacing existing Poppy AI)  
**Timeline**: 12-16 weeks  
**Team Size**: 2-4 developers recommended  
**Architecture**: Modular monorepo with clean/hexagonal architecture

---

## 🎯 Core Objectives

1. **Visual Knowledge Management**: Infinite canvas for organizing diverse content types
2. **AI-Powered Research**: Connect any content to AI chat for context-aware conversations
3. **Real-time Collaboration**: Multiple users working on same board simultaneously
4. **Extensible Architecture**: Plugin system for community contributions
5. **Open Source First**: MIT licensed with clear contribution guidelines

---

## 🏗️ Architecture Overview

### Design Principles
- **Hexagonal Architecture**: Clear separation between domain, application, and infrastructure
- **Domain-Driven Design**: Rich domain models with business logic
- **Event-Driven**: Loose coupling through domain events
- **Plugin-Based**: Extensible architecture for community contributions

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│   Canvas    │    Nodes    │     AI      │  Collaboration  │
│   Module    │   System    │ Integration │     Module      │
├─────────────┴─────────────┴─────────────┴─────────────────┤
│                    API Layer (tRPC)                         │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│    Auth     │   Storage   │  Analytics  │     Plugin      │
│   Module    │   Module    │   Module    │     System      │
├─────────────┴─────────────┴─────────────┴─────────────────┤
│              Infrastructure (PostgreSQL, Redis)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Core Modules

### 1. Authentication Module
**Purpose**: User authentication and authorization  
**Tech**: Supabase Auth + CASL  
**Features**:
- OAuth providers (Google, GitHub, etc.)
- Email/password authentication
- JWT session management
- Role-based access control
- Board-level permissions

### 2. Canvas Module
**Purpose**: Infinite canvas for visual organization  
**Tech**: Excalidraw + Custom extensions  
**Features**:
- Infinite pan and zoom
- Frame-based organization
- Grid snapping
- Touch gestures
- Export/import

### 3. Node System Module
**Purpose**: Extensible content node framework  
**Tech**: React + TypeScript + Plugin API  
**Node Types**:
- AI Chat Node (Claude, GPT-4, etc.)
- Text Node (Lexical editor)
- Media Node (Images, Videos)
- Document Node (PDF, DOCX)
- Audio Node (Recording + transcription)
- URL Node (Web scraping)
- Folder Node (Grouping)

### 4. AI Integration Module
**Purpose**: Multi-provider AI orchestration  
**Tech**: LangChain + Requesty API Router  
**Features**:
- RAG pipeline with ChromaDB
- Multi-model support
- Prompt management
- Token optimization
- Conversation memory

### 5. Collaboration Module
**Purpose**: Real-time multi-user collaboration  
**Tech**: Y.js + PartyKit  
**Features**:
- Live cursors
- Presence awareness
- Comments/mentions
- Version history
- Conflict resolution

### 6. Storage Module
**Purpose**: File and media management  
**Tech**: MinIO (S3-compatible)  
**Features**:
- File upload/download
- Image optimization
- Video transcoding
- Document parsing
- CDN integration

### 7. API Module
**Purpose**: Backend API and integrations  
**Tech**: tRPC v11 + Prisma  
**Features**:
- Type-safe RPC
- GraphQL gateway
- REST endpoints
- WebSocket support
- Rate limiting

### 8. Analytics Module
**Purpose**: Usage tracking and insights  
**Tech**: PostHog + OpenMeter  
**Features**:
- User analytics
- Feature usage
- Performance metrics
- Custom events
- Privacy-compliant

### 9. Plugin Module
**Purpose**: Third-party extensibility  
**Tech**: Custom plugin SDK  
**Features**:
- Plugin registry
- Sandboxed execution
- UI extension points
- API hooks
- Marketplace ready

---

## 📋 Development Phases

### Phase 1: Foundation (Weeks 1-3)
**Goal**: Core infrastructure and basic board functionality

**Deliverables**:
- [ ] Project setup (Next.js, TypeScript, Tailwind)
- [ ] Database schema (Prisma + PostgreSQL)
- [ ] Authentication (Supabase Auth)
- [ ] Basic board CRUD operations
- [ ] Excalidraw integration
- [ ] Basic Canvas navigation

**Key Files**:
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── boards/
│       ├── [id]/page.tsx
│       └── new/page.tsx
├── lib/
│   ├── db.ts
│   ├── auth.ts
│   └── canvas/
│       └── excalidraw-wrapper.tsx
```

### Phase 2: Node System (Weeks 4-6)
**Goal**: Implement all content node types

**Deliverables**:
- [ ] Node framework architecture
- [ ] Text node (Lexical editor)
- [ ] Media nodes (Image/Video)
- [ ] Document node (PDF support)
- [ ] Audio node (Recording)
- [ ] URL node (Web scraping)
- [ ] Drag & drop system
- [ ] Node connections

**Key Components**:
```typescript
// Node base interface
interface INode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data: Record<string, any>;
  connections: string[];
}

// Node registry
class NodeRegistry {
  register(type: string, component: React.FC<NodeProps>)
  create(type: string, data: any): INode
  serialize(node: INode): string
  deserialize(data: string): INode
}
```

### Phase 3: AI Integration (Weeks 7-10)
**Goal**: Complete AI/RAG implementation

**Deliverables**:
- [ ] LangChain integration
- [ ] Requesty API router
- [ ] ChromaDB vector store
- [ ] RAG indexing pipeline
- [ ] AI chat interface
- [ ] Whisper transcription
- [ ] Context management
- [ ] Prompt templates

**Architecture**:
```typescript
// AI Pipeline
class AIOrchestrator {
  private langchain: LangChain
  private vectorStore: ChromaDB
  private requesty: RequestyRouter
  
  async processQuery(
    query: string,
    context: NodeContext[]
  ): Promise<AIResponse>
  
  async indexContent(
    nodeId: string,
    content: any
  ): Promise<void>
}
```

### Phase 4: Collaboration (Weeks 11-13)
**Goal**: Real-time collaboration features

**Deliverables**:
- [ ] Y.js integration
- [ ] PartyKit setup
- [ ] Live cursors
- [ ] Presence indicators
- [ ] Comments system
- [ ] @mentions
- [ ] Activity feed
- [ ] Conflict resolution

### Phase 5: Polish & Plugins (Weeks 14-15)
**Goal**: Production readiness and extensibility

**Deliverables**:
- [ ] Plugin SDK
- [ ] Performance optimization
- [ ] Error boundaries
- [ ] Loading states
- [ ] Accessibility (ARIA)
- [ ] Mobile responsiveness
- [ ] Export/Import
- [ ] API documentation

### Phase 6: Testing & Launch (Week 16)
**Goal**: Quality assurance and deployment

**Deliverables**:
- [ ] Unit tests (80% coverage)
- [ ] E2E tests (critical paths)
- [ ] Performance tests
- [ ] Security audit
- [ ] Documentation
- [ ] CI/CD pipeline
- [ ] Production deployment

---

## 🗂️ Project Structure

```
ragboard/
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # tRPC backend
├── packages/
│   ├── ui/                  # Shared UI components
│   ├── canvas/              # Canvas module
│   ├── nodes/               # Node system
│   ├── ai/                  # AI integration
│   ├── collaboration/       # Y.js collaboration
│   ├── storage/             # Storage abstraction
│   └── plugins/             # Plugin SDK
├── prisma/
│   └── schema.prisma        # Database schema
├── docs/                    # Documentation
└── tests/                   # Test suites
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **UI**: Tailwind CSS + Radix UI
- **State**: Zustand + Y.js
- **Canvas**: Excalidraw
- **Editor**: Lexical
- **Types**: TypeScript

### Backend
- **API**: tRPC v11
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Cache**: Redis
- **Queue**: BullMQ
- **Auth**: Supabase

### AI/ML
- **Orchestration**: LangChain
- **Router**: Requesty
- **Vector DB**: ChromaDB
- **Models**: Claude, GPT-4, Whisper
- **Embeddings**: OpenAI

### Infrastructure
- **Storage**: MinIO (S3-compatible)
- **CDN**: CloudFront
- **Monitoring**: Sentry
- **Analytics**: PostHog
- **CI/CD**: GitHub Actions

---

## 👥 Team Structure

### Recommended Team (3-4 developers)

1. **Tech Lead/Full Stack**
   - Architecture decisions
   - Code reviews
   - Critical integrations

2. **Frontend Developer**
   - Canvas implementation
   - Node system
   - UI/UX polish

3. **Backend Developer**
   - API development
   - AI integration
   - Database design

4. **DevOps/QA (optional)**
   - CI/CD setup
   - Testing strategy
   - Deployment

---

## 📊 Success Metrics

### Technical Metrics
- Page load time < 2s
- API response time < 200ms (p95)
- 80%+ test coverage
- Zero critical vulnerabilities
- 99.9% uptime

### User Metrics
- Time to first board < 30s
- Collaboration latency < 100ms
- AI response time < 3s
- Mobile responsiveness
- Accessibility score > 90

### Business Metrics
- User retention > 60%
- Feature adoption > 40%
- Plugin submissions > 10/month
- Community PRs > 5/month

---

## 🚀 Quick Start Path

### Week 1: Setup & Foundation
```bash
# Clone and setup
git clone https://github.com/your-org/ragboard
cd ragboard
pnpm install

# Database setup
docker-compose up -d postgres
pnpm prisma migrate dev

# Start development
pnpm dev
```

### Week 2: Core Features
- Implement basic board CRUD
- Integrate Excalidraw
- Add authentication

### Week 3: First Node Type
- Create text node
- Implement drag & drop
- Add basic connections

### Ongoing: Iterate & Expand
- Add remaining node types
- Integrate AI features
- Enable collaboration

---

## 🎯 Minimum Viable Product (MVP)

### Core Features for MVP
1. ✅ User authentication
2. ✅ Board creation/management
3. ✅ Canvas with pan/zoom
4. ✅ 3 node types (AI Chat, Text, Image)
5. ✅ Basic AI chat integration
6. ✅ Node connections
7. ✅ Save/load boards

### Post-MVP Priorities
1. Real-time collaboration
2. Additional node types
3. RAG implementation
4. Plugin system
5. Mobile app

---

## 📝 Risk Mitigation

### Technical Risks
- **Excalidraw Integration**: Use official React bindings
- **Real-time Sync**: Y.js proven at scale
- **AI Costs**: Implement token limits and caching
- **Performance**: Virtualization for large boards

### Business Risks
- **Adoption**: Strong documentation and examples
- **Competition**: Focus on open-source advantage
- **Complexity**: Phased rollout approach
- **Support**: Community-driven model

---

## 🔗 Next Steps

1. **Approve plan and timeline**
2. **Assemble development team**
3. **Set up development environment**
4. **Create GitHub repository**
5. **Begin Phase 1 implementation**
6. **Establish weekly sync meetings**
7. **Set up project tracking (Linear/Jira)**

---

## 📚 Additional Resources

- [Architecture Decisions](./docs/architecture-decisions.md)
- [API Contracts](./docs/api-contracts.md)
- [Plugin Development Guide](./docs/plugin-guide.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)

---

*This plan is a living document and will be updated as the project evolves.*