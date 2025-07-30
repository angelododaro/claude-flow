# RAGBOARD Technical Integration Points

## 🔌 Module Integration Architecture

### Core Integration Layers

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
├─────────────────────────────────────────────────────────────┤
│  Canvas Layer  │  UI Layer  │  State Layer  │  Service Layer │
├────────────────┼─────────────┼───────────────┼───────────────┤
│  Excalidraw    │  Components │    Zustand    │    tRPC       │
│  Y.js Doc      │  Cards      │    Y.js       │    APIs       │
│  Custom Tools  │  Toolbar    │    Context    │    WebSocket  │
└────────────────┴─────────────┴───────────────┴───────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   API Gateway      │
                    │    (tRPC)          │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────┴─────────────────────────────────┐
│                        Backend Services                        │
├───────────────┬─────────────┬─────────────┬──────────────────┤
│  Auth Service │ Board Service│ AI Service  │ Collab Service   │
│  (Supabase)   │ (Prisma)    │ (LangChain) │ (PartyKit)       │
└───────────────┴─────────────┴─────────────┴──────────────────┘
```

## 🔗 Critical Integration Points

### 1. Canvas ↔ State Integration

```typescript
// Integration Contract: Canvas State Manager
interface CanvasStateManager {
  // Excalidraw → Zustand
  syncExcalidrawToStore: (elements: ExcalidrawElement[]) => void
  
  // Zustand → Excalidraw
  syncStoreToExcalidraw: () => ExcalidrawElement[]
  
  // Y.js → Excalidraw
  syncYjsToCanvas: (ydoc: Y.Doc) => void
  
  // Excalidraw → Y.js
  syncCanvasToYjs: (elements: ExcalidrawElement[]) => void
}

// Implementation
class CanvasSync implements CanvasStateManager {
  constructor(
    private store: BoardStore,
    private ydoc: Y.Doc,
    private excalidrawAPI: ExcalidrawAPI
  ) {}

  syncExcalidrawToStore(elements: ExcalidrawElement[]) {
    // Debounced sync to prevent excessive updates
    this.store.setElements(elements)
    
    // Also sync to Y.js for collaboration
    const yElements = this.ydoc.getArray('elements')
    yElements.delete(0, yElements.length)
    yElements.insert(0, elements)
  }
}
```

### 2. Card System ↔ Canvas Integration

```typescript
// Integration Contract: Card-Canvas Bridge
interface CardCanvasBridge {
  // Card → Canvas
  addCardToCanvas: (card: Card, position: Point) => void
  updateCardInCanvas: (cardId: string, updates: Partial<Card>) => void
  removeCardFromCanvas: (cardId: string) => void
  
  // Canvas → Card
  getCardAtPosition: (position: Point) => Card | null
  getSelectedCards: () => Card[]
  
  // Drag & Drop
  handleCardDrop: (card: Card, canvasPosition: Point) => void
}

// Card Registry for Type Safety
const CardTypeRegistry = {
  text: TextCard,
  image: ImageCard,
  video: VideoCard,
  document: DocumentCard,
  audio: AudioCard,
} as const

type CardType = keyof typeof CardTypeRegistry
```

### 3. AI ↔ Content Integration

```typescript
// Integration Contract: AI Content Processor
interface AIContentProcessor {
  // Content → AI
  indexContent: (boardId: string, content: BoardContent) => Promise<void>
  queryContent: (query: string, boardId: string) => Promise<AIResponse>
  
  // AI → Content
  generateContent: (prompt: string, context: BoardContext) => Promise<GeneratedContent>
  enhanceContent: (content: string, enhancement: Enhancement) => Promise<string>
  
  // Streaming
  streamResponse: (query: string, onChunk: (chunk: string) => void) => Promise<void>
}

// Content Types for AI Processing
interface BoardContent {
  cards: Array<{
    id: string
    type: CardType
    content: any
    metadata: Record<string, any>
  }>
  canvasElements: ExcalidrawElement[]
  collaborators: User[]
}
```

### 4. Real-time Collaboration Integration

```typescript
// Integration Contract: Collaboration Manager
interface CollaborationManager {
  // Connection Management
  connect: (boardId: string, userId: string) => Promise<void>
  disconnect: () => void
  
  // Presence
  updatePresence: (presence: UserPresence) => void
  getActiveUsers: () => UserPresence[]
  
  // Sync
  broadcastChange: (change: Change) => void
  handleRemoteChange: (change: Change) => void
  
  // Conflict Resolution
  resolveConflict: (local: Change, remote: Change) => Change
}

// Y.js Document Structure
class BoardYDoc extends Y.Doc {
  elements: Y.Array<ExcalidrawElement>
  cards: Y.Map<Card>
  presence: Y.Map<UserPresence>
  comments: Y.Array<Comment>
  
  constructor() {
    super()
    this.elements = this.getArray('elements')
    this.cards = this.getMap('cards')
    this.presence = this.getMap('presence')
    this.comments = this.getArray('comments')
  }
}
```

### 5. Storage ↔ Services Integration

```typescript
// Integration Contract: Storage Service
interface StorageService {
  // File Operations
  uploadFile: (file: File, boardId: string) => Promise<UploadResult>
  getFileUrl: (fileId: string) => Promise<string>
  deleteFile: (fileId: string) => Promise<void>
  
  // Optimization
  generateThumbnail: (fileId: string, size: ThumbnailSize) => Promise<string>
  optimizeImage: (fileId: string, quality: number) => Promise<string>
  
  // Batch Operations
  uploadBatch: (files: File[], boardId: string) => Promise<UploadResult[]>
}

// Storage Integration Points
const StorageIntegrations = {
  cards: {
    image: ['upload', 'thumbnail', 'optimize'],
    video: ['upload', 'thumbnail', 'transcode'],
    document: ['upload', 'preview', 'extract'],
    audio: ['upload', 'waveform', 'transcode'],
  },
  export: {
    board: ['package', 'compress', 'download'],
    selection: ['extract', 'package', 'download'],
  },
}
```

## 🔄 Data Flow Patterns

### 1. User Action → UI Update → State → Backend

```typescript
// Example: Creating a new card
const createCardFlow = {
  1: 'User clicks "Add Text Card" in toolbar',
  2: 'UI shows card creation modal',
  3: 'User enters content and confirms',
  4: 'Local state updates optimistically',
  5: 'tRPC mutation sent to backend',
  6: 'Backend validates and stores in DB',
  7: 'Y.js broadcasts to other users',
  8: 'Canvas re-renders with new card',
}
```

### 2. AI Processing Pipeline

```typescript
// Example: RAG Query Flow
const ragQueryFlow = {
  1: 'User types question in AI chat',
  2: 'Query sent to AI service',
  3: 'Vector search in Chroma DB',
  4: 'Context assembly from results',
  5: 'LLM prompt construction',
  6: 'Streaming response begins',
  7: 'UI updates with chunks',
  8: 'Citations linked to cards',
}
```

### 3. Real-time Sync Flow

```typescript
// Example: Collaborative Editing
const collaborationFlow = {
  1: 'User A moves a card',
  2: 'Y.js captures the change',
  3: 'Change sent via WebSocket',
  4: 'PartyKit broadcasts to room',
  5: 'User B receives update',
  6: 'Y.js applies remote change',
  7: 'Canvas re-renders for User B',
  8: 'Presence cursor updates',
}
```

## 🔐 Security Integration Points

### 1. Authentication Flow
```typescript
// Auth integration across services
const authIntegration = {
  frontend: {
    context: 'React Context for auth state',
    headers: 'Bearer token in API calls',
    routing: 'Protected route components',
  },
  api: {
    middleware: 'tRPC auth middleware',
    validation: 'JWT verification',
    context: 'User ID in request context',
  },
  realtime: {
    handshake: 'Auth during WebSocket connect',
    rooms: 'Permission check for board access',
    presence: 'User identity in presence data',
  },
  storage: {
    policies: 'Bucket access policies',
    signing: 'Presigned URLs for uploads',
    quotas: 'User storage limits',
  },
}
```

### 2. Permission Checks
```typescript
// Permission integration points
interface PermissionGates {
  // Board Level
  canViewBoard: (userId: string, boardId: string) => Promise<boolean>
  canEditBoard: (userId: string, boardId: string) => Promise<boolean>
  canDeleteBoard: (userId: string, boardId: string) => Promise<boolean>
  
  // Card Level
  canCreateCard: (userId: string, boardId: string) => Promise<boolean>
  canEditCard: (userId: string, cardId: string) => Promise<boolean>
  canDeleteCard: (userId: string, cardId: string) => Promise<boolean>
  
  // Collaboration
  canInviteUsers: (userId: string, boardId: string) => Promise<boolean>
  canChangePermissions: (userId: string, boardId: string) => Promise<boolean>
}
```

## 🔧 Plugin Integration Points

### 1. Plugin Hook System
```typescript
// Plugin integration contract
interface PluginHooks {
  // Lifecycle
  onInstall: (context: PluginContext) => Promise<void>
  onUninstall: () => Promise<void>
  
  // Board Events
  onBoardOpen: (board: Board) => void
  onBoardSave: (board: Board) => void
  
  // Card Events
  onCardCreate: (card: Card) => void
  onCardUpdate: (card: Card, changes: Partial<Card>) => void
  onCardDelete: (cardId: string) => void
  
  // UI Extensions
  registerToolbarItem: (item: ToolbarItem) => void
  registerCardType: (type: string, component: CardComponent) => void
  registerCommand: (command: Command) => void
}
```

### 2. Plugin API Access
```typescript
// Plugin API sandbox
interface PluginAPI {
  // Read Operations
  getBoard: () => Board
  getCards: () => Card[]
  getSelection: () => Selection
  
  // Write Operations (with permissions)
  createCard: (card: Omit<Card, 'id'>) => Promise<Card>
  updateCard: (cardId: string, updates: Partial<Card>) => Promise<void>
  
  // UI Operations
  showModal: (content: ReactNode) => void
  showNotification: (message: string, type: NotificationType) => void
  
  // Storage
  store: {
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
  }
}
```

## 🎯 Performance Integration Considerations

### 1. Lazy Loading Strategy
```typescript
const lazyLoadingIntegrations = {
  cards: {
    strategy: 'Intersection Observer for viewport detection',
    preload: 'Cards within 200px of viewport',
    unload: 'Cards 500px outside viewport',
  },
  assets: {
    images: 'Progressive loading with blur placeholders',
    videos: 'Thumbnail until interaction',
    documents: 'First page preview only',
  },
  ai: {
    models: 'Load on first AI interaction',
    embeddings: 'Cache in IndexedDB',
    history: 'Paginated loading',
  },
}
```

### 2. Caching Layers
```typescript
const cachingStrategy = {
  frontend: {
    tanstack: 'API response caching',
    indexedDB: 'Offline content storage',
    serviceWorker: 'Asset caching',
  },
  api: {
    redis: 'Session and frequent queries',
    cdn: 'Static assets and exports',
    database: 'Query result caching',
  },
  ai: {
    vectors: 'Embedding cache in Chroma',
    responses: 'LRU cache for common queries',
    context: 'Board context preprocessing',
  },
}
```

## 📊 Monitoring Integration Points

### 1. Analytics Events
```typescript
const analyticsIntegration = {
  user: [
    'signup', 'login', 'logout',
    'boardCreate', 'boardOpen', 'boardShare',
  ],
  feature: [
    'cardCreate', 'aiQuery', 'collaborate',
    'export', 'import', 'pluginInstall',
  ],
  performance: [
    'pageLoad', 'canvasRender', 'aiResponse',
    'syncLatency', 'errorRate',
  ],
}
```

### 2. Error Tracking
```typescript
const errorIntegration = {
  frontend: {
    boundary: 'React Error Boundary → Sentry',
    network: 'API errors → Custom handler → Sentry',
    validation: 'Form errors → User feedback',
  },
  backend: {
    api: 'tRPC error formatter → Sentry',
    database: 'Prisma errors → Logging → Alerts',
    external: 'Third-party API errors → Retry → Fallback',
  },
}
```

## 🚀 Deployment Integration

### 1. Build Pipeline Integration
```typescript
const buildIntegration = {
  frontend: {
    build: 'Next.js build with env injection',
    optimize: 'Image optimization, code splitting',
    preview: 'Vercel preview deployments',
  },
  backend: {
    build: 'TypeScript compilation, Prisma generate',
    migrate: 'Database migration in CI/CD',
    package: 'Docker container with deps',
  },
  services: {
    partykit: 'Separate deployment pipeline',
    storage: 'MinIO cluster setup',
    ai: 'Model serving infrastructure',
  },
}
```

This document serves as the technical blueprint for how all RAGBOARD modules integrate and communicate with each other.