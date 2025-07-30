# RAGBOARD Module Dependency Diagram

## Module Structure and Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RAGBOARD Modules                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     │
│  │ Authentication  │     │  Board/Canvas   │     │   Node System   │     │
│  │    Module       │     │    Module       │     │     Module      │     │
│  │                 │     │                 │     │                 │     │
│  │ • User Entity   │     │ • Board Entity  │     │ • Node Types    │     │
│  │ • Session Mgmt  │     │ • Viewport      │     │ • Resource Node │     │
│  │ • JWT Tokens    │     │ • Pan/Zoom      │     │ • AI Chat Node  │     │
│  │ • Permissions   │     │ • Grid Snap     │     │ • Folder Node   │     │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘     │
│           │                       │                       │              │
│           │                       │                       │              │
│  ┌────────▼─────────────────────▼─────────────────────▼────────┐       │
│  │                     Core Domain Services                      │       │
│  │  • Entity Management  • Business Rules  • Domain Events      │       │
│  └────────┬─────────────────────┬─────────────────────┬────────┘       │
│           │                     │                     │                │
│  ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐       │
│  │  AI Integration │  │  Collaboration  │  │Storage/Media    │       │
│  │     Module      │  │     Module      │  │    Module       │       │
│  │                 │  │                 │  │                 │       │
│  │ • RAG Context   │  │ • WebSocket     │  │ • S3 Storage    │       │
│  │ • Multi-Model   │  │ • Y.js CRDT     │  │ • Processors    │       │
│  │ • Embeddings    │  │ • Presence      │  │ • Thumbnails    │       │
│  │ • Vector Search │  │ • Cursors       │  │ • Text Extract  │       │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Detailed Module Dependencies

### 1. Authentication Module

```
Authentication Module
├── Depends On:
│   └── None (Core module)
├── Used By:
│   ├── Board/Canvas Module (permission checks)
│   ├── Node System Module (ownership)
│   ├── AI Integration Module (user context)
│   ├── Collaboration Module (participant identity)
│   └── API Layer (request authentication)
└── External Dependencies:
    ├── Supabase Auth
    ├── JWT Libraries
    └── Bcrypt
```

### 2. Board/Canvas Module

```
Board/Canvas Module
├── Depends On:
│   ├── Authentication Module (ownership, permissions)
│   └── Core Domain Services
├── Used By:
│   ├── Node System Module (node placement)
│   ├── Collaboration Module (shared viewport)
│   └── API Layer (board endpoints)
├── Components:
│   ├── BoardCanvas
│   ├── ViewportControls
│   ├── GridBackground
│   └── MiniMap
└── External Dependencies:
    ├── React Flow / D3.js
    └── Canvas rendering libraries
```

### 3. Node System Module

```
Node System Module
├── Depends On:
│   ├── Board/Canvas Module (placement context)
│   ├── Authentication Module (permissions)
│   └── Core Domain Services
├── Used By:
│   ├── AI Integration Module (chat nodes)
│   ├── Storage/Media Module (resource nodes)
│   ├── Collaboration Module (node updates)
│   └── API Layer (node CRUD)
├── Node Types:
│   ├── ResourceNode
│   ├── AIChatNode
│   ├── FolderNode
│   ├── TextNode
│   └── URLNode
└── Plugin System:
    └── Custom node type registration
```

### 4. AI Integration Module

```
AI Integration Module
├── Depends On:
│   ├── Node System Module (AI chat nodes)
│   ├── Authentication Module (user context)
│   ├── Storage/Media Module (resource content)
│   └── Core Domain Services
├── Used By:
│   ├── API Layer (chat endpoints)
│   └── Real-time updates (streaming)
├── Components:
│   ├── RAG Context Builder
│   ├── Embedding Service
│   ├── Vector Search
│   └── Multi-Model Support
└── External Dependencies:
    ├── Claude API
    ├── OpenAI API
    ├── LangChain
    └── Chroma/Pinecone
```

### 5. Collaboration Module

```
Collaboration Module
├── Depends On:
│   ├── Authentication Module (user identity)
│   ├── Board/Canvas Module (shared state)
│   ├── Node System Module (collaborative editing)
│   └── Core Domain Services
├── Used By:
│   ├── API Layer (WebSocket endpoints)
│   └── UI Components (presence indicators)
├── Features:
│   ├── Real-time cursors
│   ├── Live updates
│   ├── Conflict resolution
│   └── Presence tracking
└── External Dependencies:
    ├── Socket.io
    ├── Y.js (CRDT)
    └── Redis (pub/sub)
```

### 6. Storage/Media Module

```
Storage/Media Module
├── Depends On:
│   ├── Authentication Module (access control)
│   └── Core Domain Services
├── Used By:
│   ├── Node System Module (resource nodes)
│   ├── AI Integration Module (content extraction)
│   └── API Layer (upload endpoints)
├── Processors:
│   ├── ImageProcessor
│   ├── VideoProcessor
│   ├── AudioProcessor
│   ├── DocumentProcessor
│   └── URLProcessor
└── External Dependencies:
    ├── AWS S3 / MinIO
    ├── Sharp (images)
    ├── FFmpeg (video)
    └── Tesseract (OCR)
```

## Cross-Module Interactions

### User Creates AI-Powered Board

```
User Action: Create board with AI chat
    │
    ▼
1. Authentication Module
   - Verify user identity
   - Check permissions
    │
    ▼
2. Board/Canvas Module
   - Create board entity
   - Initialize viewport
    │
    ▼
3. Node System Module
   - Create AI chat node
   - Position on canvas
    │
    ▼
4. AI Integration Module
   - Initialize chat session
   - Prepare RAG context
    │
    ▼
5. Collaboration Module
   - Create collaboration session
   - Enable real-time updates
```

### Resource Upload and Processing

```
User Action: Upload document
    │
    ▼
1. Authentication Module
   - Verify upload permission
    │
    ▼
2. Storage/Media Module
   - Process file
   - Extract text
   - Generate thumbnail
    │
    ▼
3. Node System Module
   - Create resource node
   - Add to board
    │
    ▼
4. AI Integration Module
   - Generate embeddings
   - Index for search
    │
    ▼
5. Collaboration Module
   - Broadcast update
   - Sync with participants
```

## Module Communication Patterns

### Event-Driven Communication

```typescript
// Domain Events
interface DomainEvent {
  aggregateId: string
  eventType: string
  timestamp: DateTime
  payload: any
}

// Event Bus
class EventBus {
  private handlers = new Map<string, EventHandler[]>()
  
  subscribe(eventType: string, handler: EventHandler) {
    const handlers = this.handlers.get(eventType) || []
    handlers.push(handler)
    this.handlers.set(eventType, handlers)
  }
  
  async publish(event: DomainEvent) {
    const handlers = this.handlers.get(event.eventType) || []
    await Promise.all(handlers.map(h => h(event)))
  }
}

// Module Integration via Events
// Authentication Module publishes:
eventBus.publish(new UserLoggedInEvent(userId))

// Board Module subscribes:
eventBus.subscribe('UserLoggedIn', async (event) => {
  await this.loadUserBoards(event.userId)
})
```

### Service Integration Pattern

```typescript
// Dependency Injection Container
class Container {
  private services = new Map<string, any>()
  
  register<T>(token: string, factory: () => T) {
    this.services.set(token, factory())
  }
  
  get<T>(token: string): T {
    return this.services.get(token)
  }
}

// Module Registration
container.register('AuthService', () => new AuthenticationService())
container.register('BoardService', () => new BoardService(
  container.get('AuthService')
))
container.register('NodeService', () => new NodeService(
  container.get('BoardService'),
  container.get('AuthService')
))
```

## Module Boundaries and Interfaces

### Clean Interface Example

```typescript
// Public module interface
export interface AuthenticationModule {
  // Commands
  login(email: string, password: string): Promise<AuthResult>
  logout(sessionId: string): Promise<void>
  refreshToken(refreshToken: string): Promise<AuthResult>
  
  // Queries
  getCurrentUser(): Promise<User | null>
  validateToken(token: string): Promise<boolean>
  getUserPermissions(userId: string): Promise<Permission[]>
  
  // Events
  onUserLoggedIn: EventEmitter<User>
  onUserLoggedOut: EventEmitter<string>
  onSessionExpired: EventEmitter<string>
}

// Internal implementation details are hidden
class AuthenticationModuleImpl implements AuthenticationModule {
  private userRepo: UserRepository
  private sessionRepo: SessionRepository
  private tokenService: TokenService
  
  // Implementation...
}
```

## Module Testing Strategy

### Unit Testing Within Modules

```typescript
describe('NodeService', () => {
  let nodeService: NodeService
  let mockBoardService: MockBoardService
  let mockAuthService: MockAuthService
  
  beforeEach(() => {
    mockBoardService = new MockBoardService()
    mockAuthService = new MockAuthService()
    nodeService = new NodeService(mockBoardService, mockAuthService)
  })
  
  it('should create node with proper permissions', async () => {
    mockAuthService.hasPermission.mockResolvedValue(true)
    mockBoardService.exists.mockResolvedValue(true)
    
    const node = await nodeService.createNode({
      boardId: 'board-1',
      type: 'resource',
      data: { title: 'Test' }
    })
    
    expect(node).toBeDefined()
    expect(mockAuthService.hasPermission).toHaveBeenCalledWith(
      'board-1', 'node.create'
    )
  })
})
```

### Integration Testing Between Modules

```typescript
describe('Board and Node Integration', () => {
  let app: TestApplication
  
  beforeAll(async () => {
    app = await createTestApplication({
      modules: [
        AuthenticationModule,
        BoardModule,
        NodeModule
      ]
    })
  })
  
  it('should create node on board', async () => {
    // Create board
    const board = await app.boardService.create({
      name: 'Test Board'
    })
    
    // Add node to board
    const node = await app.nodeService.addToBoard(board.id, {
      type: 'resource',
      position: { x: 100, y: 100 }
    })
    
    // Verify integration
    const boardWithNodes = await app.boardService.getWithNodes(board.id)
    expect(boardWithNodes.nodes).toContainEqual(node)
  })
})
```

## Module Configuration

### Environment-Based Configuration

```typescript
// Module configuration interface
interface ModuleConfig {
  auth: {
    jwtSecret: string
    tokenExpiry: number
    refreshTokenExpiry: number
  }
  storage: {
    s3Bucket: string
    cdnUrl: string
    maxFileSize: number
  }
  ai: {
    claudeApiKey: string
    openaiApiKey: string
    defaultModel: string
    maxTokens: number
  }
  collaboration: {
    websocketUrl: string
    maxParticipants: number
    presenceTimeout: number
  }
}

// Configuration loader
class ConfigLoader {
  static load(): ModuleConfig {
    return {
      auth: {
        jwtSecret: process.env.JWT_SECRET!,
        tokenExpiry: parseInt(process.env.TOKEN_EXPIRY || '3600'),
        refreshTokenExpiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY || '604800')
      },
      storage: {
        s3Bucket: process.env.S3_BUCKET!,
        cdnUrl: process.env.CDN_URL!,
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600')
      },
      // ... other modules
    }
  }
}
```

## Module Deployment

### Microservice-Ready Architecture

```yaml
# Each module can be deployed independently
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-module
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: auth
        image: ragboard/auth-module:latest
        env:
        - name: SERVICE_NAME
          value: auth-module
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: board-module
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: board
        image: ragboard/board-module:latest
        env:
        - name: SERVICE_NAME
          value: board-module
        - name: AUTH_SERVICE_URL
          value: http://auth-module:80
```

## Module Metrics and Monitoring

### Module Health Checks

```typescript
interface ModuleHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: HealthCheck[]
  timestamp: DateTime
}

class ModuleHealthMonitor {
  async checkHealth(module: Module): Promise<ModuleHealth> {
    const checks = await Promise.all([
      this.checkDependencies(module),
      this.checkDatabase(module),
      this.checkExternalServices(module),
      this.checkPerformance(module)
    ])
    
    const status = this.calculateOverallStatus(checks)
    
    return {
      status,
      checks,
      timestamp: DateTime.now()
    }
  }
}
```

This modular architecture ensures:
- **Clear boundaries** between modules
- **Minimal coupling** through well-defined interfaces
- **Maximum cohesion** within each module
- **Easy testing** at module and integration levels
- **Flexible deployment** options
- **Scalable architecture** that grows with requirements