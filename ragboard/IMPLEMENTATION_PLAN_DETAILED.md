# RAGBOARD Detailed Implementation Plan

## 🎯 Project Overview

RAGBOARD is an AI-powered research and ideation canvas platform that combines:
- Infinite canvas interface (Excalidraw)
- Real-time collaboration (Y.js/PartyKit)
- AI-assisted research (LangChain/RAG)
- Multi-media cards (text, video, images, documents, audio)
- Plugin-friendly architecture

## 📁 Recommended Project Structure

```
ragboard/
├── frontend/                 # Next.js 14+ application
│   ├── app/                 # App Router pages
│   │   ├── (auth)/         # Auth-related pages
│   │   ├── boards/         # Board pages
│   │   ├── api/           # API route handlers
│   │   └── layout.tsx     # Root layout
│   ├── components/         # React components
│   │   ├── canvas/        # Excalidraw integration
│   │   ├── cards/         # Card type components
│   │   ├── toolbar/       # Tool components
│   │   ├── collaboration/ # Real-time features
│   │   └── ui/           # Design system components
│   ├── lib/               # Core utilities
│   │   ├── ai/           # AI integration
│   │   ├── auth/         # Auth utilities
│   │   ├── db/           # Database client
│   │   └── utils/        # Helpers
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand stores
│   └── prompts/          # AI prompt templates
│
├── backend/              # tRPC API server
│   ├── src/
│   │   ├── routers/     # tRPC routers
│   │   ├── services/    # Business logic
│   │   ├── db/          # Prisma client
│   │   └── ai/          # LangChain setup
│   └── prisma/          # Database schema
│
├── packages/            # Shared packages
│   ├── types/          # TypeScript types
│   ├── config/         # Shared configs
│   └── ui/             # UI component library
│
├── partykit/           # Real-time server
│   └── src/            # PartyKit rooms
│
└── plugins/            # Plugin directory
    └── example/        # Example plugin
```

## 📊 Phase-by-Phase Implementation

### Phase 1: Foundation (2-3 weeks)
**Goal:** Authentication, database, basic board CRUD, and Excalidraw integration

#### 1.1 Project Setup
```typescript
// Core dependencies
{
  "dependencies": {
    "next": "^14.0.0",
    "@excalidraw/excalidraw": "^0.17.0",
    "@supabase/supabase-js": "^2.39.0",
    "@trpc/server": "^11.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@prisma/client": "^5.7.0",
    "zustand": "^4.4.0",
    "zod": "^3.22.0"
  }
}
```

#### 1.2 Database Schema (Prisma)
```prisma
// prisma/schema.prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  avatarUrl     String?
  boards        Board[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Board {
  id            String    @id @default(uuid())
  title         String
  description   String?
  thumbnail     String?
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  elements      Json      // Excalidraw elements
  appState      Json      // Excalidraw app state
  collaborators BoardCollaborator[]
  cards         Card[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model BoardCollaborator {
  id        String   @id @default(uuid())
  boardId   String
  board     Board    @relation(fields: [boardId], references: [id])
  userId    String
  role      String   // "viewer" | "editor" | "owner"
  createdAt DateTime @default(now())
}

model Card {
  id        String   @id @default(uuid())
  boardId   String
  board     Board    @relation(fields: [boardId], references: [id])
  type      String   // "text" | "image" | "video" | "document" | "audio"
  content   Json
  position  Json     // { x, y, width, height }
  metadata  Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### 1.3 Authentication Setup
```typescript
// lib/auth/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Row Level Security (RLS) policies
const RLS_POLICIES = `
-- Users can read their own boards
CREATE POLICY "Users can view own boards" ON boards
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create boards
CREATE POLICY "Users can create boards" ON boards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Board collaborators can view boards
CREATE POLICY "Collaborators can view boards" ON boards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_collaborators
      WHERE board_collaborators.board_id = boards.id
      AND board_collaborators.user_id = auth.uid()
    )
  );
`
```

#### 1.4 tRPC Router Setup
```typescript
// backend/src/routers/board.ts
import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

export const boardRouter = router({
  create: protectedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.board.create({
        data: {
          ...input,
          userId: ctx.user.id,
          elements: [],
          appState: {}
        }
      })
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.board.findMany({
        where: {
          OR: [
            { userId: ctx.user.id },
            {
              collaborators: {
                some: { userId: ctx.user.id }
              }
            }
          ]
        },
        orderBy: { updatedAt: 'desc' }
      })
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check permissions
      const board = await ctx.prisma.board.findFirst({
        where: {
          id: input.id,
          OR: [
            { userId: ctx.user.id },
            {
              collaborators: {
                some: { userId: ctx.user.id }
              }
            }
          ]
        }
      })
      
      if (!board) throw new Error('Board not found')
      return board
    })
})
```

#### 1.5 Excalidraw Integration
```typescript
// components/canvas/BoardCanvas.tsx
import { Excalidraw } from '@excalidraw/excalidraw'
import { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types'

export function BoardCanvas({ boardId }: { boardId: string }) {
  const { data: board } = trpc.board.get.useQuery({ id: boardId })
  const updateBoard = trpc.board.update.useMutation()

  const handleChange = useCallback(
    debounce((elements: ExcalidrawElement[], appState: AppState) => {
      updateBoard.mutate({
        id: boardId,
        elements,
        appState
      })
    }, 1000),
    [boardId]
  )

  return (
    <div className="h-full w-full">
      <Excalidraw
        initialData={{
          elements: board?.elements || [],
          appState: board?.appState || {}
        }}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            export: false, // We'll implement custom export
          }
        }}
      />
    </div>
  )
}
```

### Phase 2: Card System & Canvas Polish (2-3 weeks)
**Goal:** Implement all card types and polish canvas interactions

#### 2.1 Card Type Components
```typescript
// components/cards/TextCard.tsx
import { Lexical } from '@lexical/react/LexicalComposer'

export function TextCard({ card, onUpdate }) {
  return (
    <Card className="min-w-[300px]">
      <LexicalEditor
        initialContent={card.content}
        onChange={(content) => onUpdate({ content })}
        plugins={[
          RichTextPlugin,
          AutoLinkPlugin,
          MentionPlugin,
          AIAssistPlugin // Custom AI integration
        ]}
      />
    </Card>
  )
}

// components/cards/VideoCard.tsx
export function VideoCard({ card, onUpdate }) {
  const [transcript, setTranscript] = useState(card.metadata?.transcript)
  
  const handleTranscribe = async () => {
    const result = await transcribeVideo(card.content.url)
    setTranscript(result)
    onUpdate({ metadata: { transcript: result } })
  }

  return (
    <Card>
      <VideoPlayer url={card.content.url} />
      {!transcript && (
        <Button onClick={handleTranscribe}>Generate Transcript</Button>
      )}
      {transcript && <TranscriptView content={transcript} />}
    </Card>
  )
}
```

#### 2.2 Drag & Drop System
```typescript
// hooks/useCardDragDrop.ts
export function useCardDragDrop(canvasRef: RefObject<HTMLDivElement>) {
  const [draggedCard, setDraggedCard] = useState<Card | null>(null)

  const handleDragStart = (card: Card) => {
    setDraggedCard(card)
  }

  const handleDrop = (e: DragEvent) => {
    if (!draggedCard || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const position = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }

    // Update card position
    updateCard.mutate({
      id: draggedCard.id,
      position
    })
  }

  return { handleDragStart, handleDrop }
}
```

#### 2.3 MinIO Storage Integration
```typescript
// lib/storage/minio.ts
import { Client } from 'minio'

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!
})

export async function uploadFile(file: File, boardId: string) {
  const fileName = `${boardId}/${Date.now()}-${file.name}`
  
  await minioClient.putObject(
    'ragboard-uploads',
    fileName,
    file.stream(),
    file.size,
    { 'Content-Type': file.type }
  )

  return minioClient.presignedGetUrl('GET', 'ragboard-uploads', fileName)
}
```

### Phase 3: AI Integration (3-4 weeks)
**Goal:** LangChain setup, RAG pipeline, Whisper transcription

#### 3.1 LangChain Setup
```typescript
// backend/src/ai/chain.ts
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { ConversationalRetrievalQAChain } from 'langchain/chains'
import { ChromaDB } from 'langchain/vectorstores/chroma'

export function createRAGChain(boardId: string) {
  const vectorStore = new ChromaDB({
    collectionName: `board-${boardId}`,
    url: process.env.CHROMA_URL
  })

  const model = new ChatOpenAI({
    modelName: 'gpt-4',
    temperature: 0.7
  })

  return ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      qaTemplate: BOARD_QA_PROMPT,
      questionGeneratorTemplate: CONDENSE_PROMPT
    }
  )
}
```

#### 3.2 RAG Indexing Pipeline
```typescript
// backend/src/ai/indexer.ts
export class BoardIndexer {
  async indexBoard(boardId: string) {
    // Get all cards from board
    const cards = await prisma.card.findMany({
      where: { boardId }
    })

    // Process each card type
    for (const card of cards) {
      const content = await this.extractContent(card)
      const chunks = await this.chunkContent(content)
      
      await this.vectorStore.addDocuments(
        chunks.map(chunk => ({
          pageContent: chunk,
          metadata: {
            cardId: card.id,
            cardType: card.type,
            boardId
          }
        }))
      )
    }
  }

  private async extractContent(card: Card): Promise<string> {
    switch (card.type) {
      case 'text':
        return card.content.text
      case 'document':
        return await extractPDF(card.content.url)
      case 'video':
        return card.metadata.transcript || ''
      // ... other types
    }
  }
}
```

#### 3.3 Whisper Integration
```typescript
// backend/src/ai/whisper.ts
import { createReadStream } from 'fs'
import FormData from 'form-data'

export async function transcribeAudio(audioUrl: string) {
  const audioStream = await downloadFile(audioUrl)
  
  const formData = new FormData()
  formData.append('file', audioStream)
  formData.append('model', 'whisper-1')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: formData
  })

  const { text } = await response.json()
  return text
}
```

### Phase 4: Real-time Collaboration (2-3 weeks)
**Goal:** Y.js integration, PartyKit setup, live cursors

#### 4.1 Y.js Document Structure
```typescript
// lib/collaboration/yjs-schema.ts
import * as Y from 'yjs'

export class BoardDocument extends Y.Doc {
  elements: Y.Array<ExcalidrawElement>
  cards: Y.Map<Card>
  presence: Y.Map<UserPresence>

  constructor() {
    super()
    this.elements = this.getArray('elements')
    this.cards = this.getMap('cards')
    this.presence = this.getMap('presence')
  }
}
```

#### 4.2 PartyKit Server
```typescript
// partykit/src/board-room.ts
import type { Party, PartyKitServer } from 'partykit/server'
import { WebSocketProvider } from 'y-websocket'

export default class BoardRoom implements PartyKitServer {
  ydoc: Y.Doc

  constructor(public party: Party) {
    this.ydoc = new Y.Doc()
  }

  async onConnect(conn: WebSocket, ctx: ConnectionContext) {
    // Authenticate user
    const user = await this.authenticateUser(ctx.request)
    if (!user) return conn.close(1008, 'Unauthorized')

    // Check board permissions
    const hasAccess = await this.checkBoardAccess(
      this.party.id,
      user.id
    )
    if (!hasAccess) return conn.close(1008, 'Forbidden')

    // Setup Y.js provider
    const provider = new WebSocketProvider(
      this.party.id,
      this.ydoc,
      { WebSocket: conn }
    )

    // Handle presence
    provider.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name,
      color: user.color,
      cursor: null
    })
  }
}
```

#### 4.3 React Integration
```typescript
// hooks/useYjsCollaboration.ts
export function useYjsCollaboration(boardId: string) {
  const [ydoc] = useState(() => new BoardDocument())
  const [provider, setProvider] = useState<WebSocketProvider>()
  const [awareness, setAwareness] = useState<Awareness>()

  useEffect(() => {
    const provider = new WebSocketProvider(
      `${process.env.NEXT_PUBLIC_PARTYKIT_URL}/board/${boardId}`,
      ydoc
    )

    setProvider(provider)
    setAwareness(provider.awareness)

    return () => {
      provider.destroy()
    }
  }, [boardId])

  // Sync Excalidraw elements
  useEffect(() => {
    if (!provider) return

    const handleChange = () => {
      const elements = ydoc.elements.toArray()
      // Update Excalidraw
    }

    ydoc.elements.observe(handleChange)
    return () => ydoc.elements.unobserve(handleChange)
  }, [provider])

  return { ydoc, awareness, provider }
}
```

### Phase 5: Integrations & Plugin System (2-3 weeks)
**Goal:** External APIs, plugin architecture, SDK

#### 5.1 Plugin Architecture
```typescript
// lib/plugins/plugin-system.ts
export interface RagboardPlugin {
  id: string
  name: string
  version: string
  
  // UI Components
  toolbarComponent?: React.ComponentType
  cardComponent?: React.ComponentType<CardComponentProps>
  
  // Hooks
  onBoardLoad?: (board: Board) => void
  onCardCreate?: (card: Card) => void
  
  // API Extensions
  apiRoutes?: TRPCRouter
  
  // State management
  createStore?: () => StoreApi
}

export class PluginRegistry {
  private plugins = new Map<string, RagboardPlugin>()

  register(plugin: RagboardPlugin) {
    this.plugins.set(plugin.id, plugin)
    
    // Register API routes
    if (plugin.apiRoutes) {
      this.registerAPIRoutes(plugin.id, plugin.apiRoutes)
    }
    
    // Register store
    if (plugin.createStore) {
      this.registerStore(plugin.id, plugin.createStore())
    }
  }
}
```

#### 5.2 Example Plugin
```typescript
// plugins/social-media/index.ts
export const socialMediaPlugin: RagboardPlugin = {
  id: 'social-media',
  name: 'Social Media Integration',
  version: '1.0.0',

  toolbarComponent: SocialMediaTool,
  
  cardComponent: ({ card, onUpdate }) => {
    if (card.type === 'social-post') {
      return <SocialPostCard card={card} onUpdate={onUpdate} />
    }
  },

  apiRoutes: router({
    fetchInstagramPost: publicProcedure
      .input(z.object({ url: z.string() }))
      .query(async ({ input }) => {
        return fetchInstagramData(input.url)
      })
  }),

  createStore: () => create((set) => ({
    connectedAccounts: [],
    connectAccount: async (platform: string) => {
      // OAuth flow
    }
  }))
}
```

### Phase 6: Testing & Optimization (2-3 weeks)
**Goal:** Comprehensive testing, performance optimization, documentation

#### 6.1 Testing Strategy
```typescript
// Testing stack configuration
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@playwright/test": "^1.40.0",
    "msw": "^2.0.0"
  }
}

// Unit test example
// components/cards/TextCard.test.tsx
describe('TextCard', () => {
  it('should render and handle edits', async () => {
    const onUpdate = vi.fn()
    const { getByRole } = render(
      <TextCard 
        card={mockTextCard} 
        onUpdate={onUpdate} 
      />
    )
    
    const editor = getByRole('textbox')
    await userEvent.type(editor, 'New content')
    
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        content: expect.stringContaining('New content')
      })
    })
  })
})

// E2E test example
// e2e/board-collaboration.spec.ts
test('multiple users can collaborate', async ({ page, context }) => {
  // User 1 creates board
  await page.goto('/boards/new')
  await page.fill('[name="title"]', 'Collaborative Board')
  await page.click('button[type="submit"]')
  
  const boardUrl = page.url()
  
  // User 2 joins
  const page2 = await context.newPage()
  await page2.goto(boardUrl)
  
  // User 1 adds element
  await page.click('[data-testid="rectangle-tool"]')
  await page.mouse.click(300, 300)
  
  // User 2 should see it
  await expect(page2.locator('[data-testid="canvas-element"]')).toBeVisible()
})
```

#### 6.2 Performance Optimization
```typescript
// Performance optimizations
const optimizations = {
  // 1. Canvas virtualization
  canvasVirtualization: {
    implement: 'react-window for off-screen elements',
    benefit: 'Handle 1000+ elements smoothly'
  },
  
  // 2. Image optimization
  imageOptimization: {
    implement: 'next/image with blur placeholders',
    benefit: '60% faster image loading'
  },
  
  // 3. Bundle splitting
  bundleSplitting: {
    implement: 'Dynamic imports for card types',
    benefit: '40% smaller initial bundle'
  },
  
  // 4. WebSocket optimization
  websocketOptimization: {
    implement: 'Message batching and compression',
    benefit: '70% less bandwidth usage'
  },
  
  // 5. Database queries
  databaseOptimization: {
    implement: 'Prisma query optimization and caching',
    benefit: '50% faster API responses'
  }
}
```

## 📋 Task Breakdown by Module

### Authentication Module
- [ ] Supabase client setup
- [ ] Auth context provider
- [ ] Login/signup pages
- [ ] OAuth integration (Google, GitHub)
- [ ] Protected route wrapper
- [ ] User profile management
- [ ] RLS policies implementation

### Canvas Module
- [ ] Excalidraw integration
- [ ] Custom toolbar
- [ ] Canvas state management
- [ ] Auto-save functionality
- [ ] Export functionality
- [ ] Zoom controls
- [ ] Canvas frames/sections

### Card System
- [ ] Base card component
- [ ] Text card with Lexical
- [ ] Image card with upload
- [ ] Video card with player
- [ ] Document card with preview
- [ ] Audio card with recorder
- [ ] Card drag & drop
- [ ] Card resize handles

### AI Module
- [ ] LangChain setup
- [ ] Chroma vector store
- [ ] RAG pipeline
- [ ] Whisper integration
- [ ] AI chat interface
- [ ] Prompt templates
- [ ] Context window management

### Collaboration Module
- [ ] Y.js document setup
- [ ] PartyKit server
- [ ] Live cursors
- [ ] Presence indicators
- [ ] Conflict resolution
- [ ] Offline support
- [ ] Activity feed

### Storage Module
- [ ] MinIO setup
- [ ] File upload service
- [ ] Image optimization
- [ ] Video processing
- [ ] Document parsing
- [ ] CDN integration
- [ ] Quota management

## 🔧 Development Workflow

### Git Branch Strategy
```
main
├── develop
│   ├── feature/phase-1-auth
│   ├── feature/phase-2-canvas
│   ├── feature/phase-3-ai
│   ├── feature/phase-4-collab
│   ├── feature/phase-5-plugins
│   └── feature/phase-6-testing
└── release/v1.0.0
```

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: pnpm install
      - name: Run tests
        run: pnpm test
      - name: Run E2E tests
        run: pnpm test:e2e
      
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build application
        run: pnpm build
      - name: Deploy to staging
        if: github.ref == 'refs/heads/develop'
        run: pnpm deploy:staging
```

## 📊 Success Metrics

### Technical Metrics
- Page load time < 2s
- Time to interactive < 3s
- WebSocket latency < 100ms
- API response time < 200ms
- 95%+ test coverage

### User Experience Metrics
- Canvas frame rate > 30fps with 100+ elements
- Real-time sync delay < 500ms
- AI response time < 2s
- File upload speed > 5MB/s

## 🚀 Launch Checklist

### Pre-launch
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Cross-browser testing
- [ ] Mobile responsiveness
- [ ] Documentation complete
- [ ] API rate limiting configured
- [ ] Monitoring setup (Sentry, PostHog)

### Launch Day
- [ ] Database migrations run
- [ ] Environment variables set
- [ ] SSL certificates configured
- [ ] CDN cache warmed
- [ ] Health checks passing
- [ ] Rollback plan ready

### Post-launch
- [ ] User feedback collection
- [ ] Performance monitoring
- [ ] Error tracking
- [ ] Usage analytics
- [ ] Iterate based on feedback

## 🔗 Integration Points

### External Services
1. **Supabase**: Auth, RLS, database
2. **MinIO**: File storage
3. **PartyKit**: WebSocket infrastructure
4. **OpenAI**: GPT-4, Whisper
5. **Chroma**: Vector database
6. **PostHog**: Analytics
7. **Sentry**: Error tracking
8. **Vercel/Railway**: Deployment

### API Endpoints
- `/api/trpc/*` - tRPC endpoints
- `/api/upload` - File upload
- `/api/export` - Board export
- `/api/webhooks/*` - External webhooks
- `/party/*` - PartyKit WebSocket

This implementation plan provides a clear roadmap for building RAGBOARD with modern architecture, scalable infrastructure, and excellent developer experience.