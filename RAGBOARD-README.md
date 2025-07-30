# RAGBOARD: AI Research & Ideation Canvas (Build Blueprint)

## 🚀 Project Purpose
Rebuild Poppy AI as an open-source-first platform with real-time collaboration, AI-assisted research, and flexible media card-based ideation boards.

NOTE: Reference /Screenshots and RAGBOARD-SCREENSHOT-EXAMPLES.md for visual references for many of the proposed features.

---

## 🧱 Core Tech Stack

| Layer               | Tool/Framework             |
|--------------------|----------------------------|
| Frontend           | Next.js 14+, Tailwind CSS, TypeScript |
| Infinite Canvas    | [Excalidraw](https://github.com/excalidraw/excalidraw) w/ Y.js |
| State Mgmt         | Zustand (local) + Y.js (collab) |
| Backend API        | tRPC v11, Prisma           |
| DB                 | PostgreSQL                 |
| Auth               | Supabase Auth              |
| Realtime Infra     | PartyKit (for custom sync) |
| Storage            | MinIO (S3-compatible)      |
| AI Interface       | LangChain + Vercel AI SDK via Requesty |
| Vector Store       | Chroma (default, pluggable)|
| Analytics          | PostHog + OpenMeter        |
| Error Monitoring   | Sentry                     |
| Testing            | Vitest + Playwright        |

---

## 🧠 AI Architecture

- **Requesty API**: Central router for LLM calls (Claude, GPT-4, etc.)
- **LangChain**:
  - `ConversationalRetrievalQAChain` for chat-based RAG
  - Vector store: Chroma (default)
  - Prompt templates stored in `/prompts/` folder
- **Whisper API**: Audio/video transcription
- **RAG Context**: Board content indexed into vector DB

---

## 🧩 Feature Modules

### 1. Authentication
- Supabase Auth (OAuth + email/password)
- JWT-based sessions
- RLS for board access control

### 2. Board & Canvas
- Excalidraw canvas: infinite, zoomable, resizable frames
- Board metadata stored in Postgres
- Thumbnails generated via Excalidraw export

### 3. Card Types
- **Text**: Lexical editor w/ formatting + AI assist
- **Video**: Embed + transcript via Whisper
- **Image**: Upload via MinIO, generate via Replicate
- **Document**: pdf.js + Unstructured parser
- **Audio**: MediaRecorder + WaveSurfer.js

### 4. Collaboration
- Real-time Y.js + PartyKit presence
- Comments, mentions, live cursors

### 5. AI Tooling
- `/chat` endpoint → LangChain pipeline
- `/generate-copy`, `/summarize` endpoints for single-shot AI
- RAG indexing jobs queue

### 6. Toolbar & Tools
- Sidebar tool selector w/:
  - Comments
  - Media import
  - Explore (trend discovery)
  - File upload
  - Voice recorder
  - AI assistant

---

## 🧪 Testing Setup

- `Vitest` for unit tests
- `Playwright` for E2E tests
- `axe-core` for accessibility checks

---

## 📦 Folder Structure

```
src/
├── app/              # Next.js App Router
│   ├── boards/       # Board pages
│   └── api/          # tRPC endpoints
├── components/       # Canvas, toolbar, card UIs
├── lib/              # db (Prisma), ai (LangChain), collab (PartyKit)
├── prompts/          # Prompt templates
├── hooks/            # Custom React hooks
```

---

## 📤 Deployment

- Frontend: Vercel or self-host via Coolify
- Backend: Fly.io or Railway
- Vector DB: Local Chroma, optional upgrade to Qdrant
- Storage: MinIO (local or S3-compatible remote)

---

## 🧩 Plugin-Friendly Design

- Each tool in toolbar is modular
- Plugins registered via `toolRegistry.ts`
- Plugins follow:
  - UI Component
  - Zustand local state
  - tRPC backend integration
  - Optional real-time hook

---

## 🔄 Dev Milestones

| Phase | Focus                         |
|-------|-------------------------------|
| 1     | Auth, DB, board CRUD, Excalidraw init |
| 2     | Canvas polish, cards (text/image/doc) |
| 3     | AI: LangChain + Whisper + RAG |
| 4     | Realtime collab via Y.js/PartyKit |
| 5     | Integrations, APIs, plugin SDK |
| 6     | Testing, performance, docs     |

---

## 🛡️ Security

- Supabase RLS policies
- Upload virus scanning
- E2E encryption (Y.js)
- API rate limiting, JWT auth

---

## 📥 Migration Plan (from Poppy AI)
- Scraper/browser extension to export board data
- Import CLI with error logging + progress tracker
- Manual import override UI

---

## 📘 Docs & API

- Dev guide: `/docs/dev.md`
- Prompt templates: `/prompts/`
- Vector indexers: `/lib/ai/indexer.ts`
- LLM routing: `/lib/ai/router.ts`

---

## ✅ Setup

```bash
git clone https://github.com/your-org/ragboard.git
cd ragboard
pnpm install
pnpm dev
```

---

## 🧠 Default Dev Flags

```ts
NEXT_PUBLIC_MODEL_PROVIDER = "claude"
NEXT_PUBLIC_RAG_INDEX = "chroma"
NEXT_PUBLIC_ANALYTICS = "posthog"
```
