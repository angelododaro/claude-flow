# RAGBOARD Module Implementation Roadmap

## Overview

This roadmap provides a detailed implementation plan for the RAGBOARD modular architecture, with clear milestones, dependencies, and success criteria for each module.

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

#### 1.1 Project Setup
- [ ] Initialize monorepo with Lerna/Nx
- [ ] Configure TypeScript with strict settings
- [ ] Set up ESLint and Prettier
- [ ] Configure Jest and testing infrastructure
- [ ] Set up CI/CD pipeline

```bash
# Monorepo structure
ragboard/
├── packages/
│   ├── core/              # Core domain logic
│   ├── auth/              # Authentication module
│   ├── board/             # Board module
│   ├── node-system/       # Node system module
│   ├── ai-integration/    # AI module
│   ├── collaboration/     # Real-time module
│   ├── storage/           # Storage module
│   ├── api/               # API layer
│   └── web/               # React frontend
├── apps/
│   ├── backend/           # Express backend
│   └── frontend/          # Next.js frontend
└── tools/                 # Build tools
```

#### 1.2 Core Domain Implementation

**Location:** `packages/core/`

```typescript
// packages/core/src/domain/entities/base.entity.ts
export abstract class Entity<T> {
  protected readonly _id: T;
  
  constructor(id: T) {
    this._id = id;
  }
  
  get id(): T {
    return this._id;
  }
  
  equals(entity: Entity<T>): boolean {
    return entity.id === this._id;
  }
}

// packages/core/src/domain/value-objects/id.value-object.ts
export class Id {
  constructor(private value: string) {
    if (!this.isValid(value)) {
      throw new Error('Invalid ID format');
    }
  }
  
  private isValid(value: string): boolean {
    return /^[a-zA-Z0-9-_]+$/.test(value);
  }
  
  toString(): string {
    return this.value;
  }
}
```

#### 1.3 Event Bus Infrastructure

```typescript
// packages/core/src/infrastructure/event-bus.ts
export interface DomainEvent {
  aggregateId: string;
  eventType: string;
  eventData: any;
  occurredOn: Date;
}

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  
  subscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }
  
  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];
    await Promise.all(handlers.map(h => h(event)));
  }
}
```

### Phase 2: Authentication Module (Week 3)

#### 2.1 Domain Layer

**Location:** `packages/auth/src/domain/`

```typescript
// entities/user.entity.ts
export class User extends Entity<UserId> {
  private _email: Email;
  private _profile: UserProfile;
  private _permissions: Set<Permission>;
  
  constructor(
    id: UserId,
    email: Email,
    profile: UserProfile,
    permissions: Permission[] = []
  ) {
    super(id);
    this._email = email;
    this._profile = profile;
    this._permissions = new Set(permissions);
  }
  
  hasPermission(permission: Permission): boolean {
    return this._permissions.has(permission);
  }
  
  updateProfile(profile: Partial<UserProfile>): void {
    this._profile = { ...this._profile, ...profile };
  }
}
```

#### 2.2 Application Layer

```typescript
// use-cases/login.use-case.ts
export class LoginUseCase {
  constructor(
    private authService: AuthenticationService,
    private userRepo: UserRepository,
    private sessionRepo: SessionRepository,
    private eventBus: EventBus
  ) {}
  
  async execute(request: LoginRequest): Promise<LoginResponse> {
    const email = new Email(request.email);
    const password = new Password(request.password);
    
    const user = await this.authService.authenticate(email, password);
    const session = await this.authService.createSession(user);
    
    await this.sessionRepo.save(session);
    
    await this.eventBus.publish({
      aggregateId: user.id.toString(),
      eventType: 'UserLoggedIn',
      eventData: { userId: user.id, sessionId: session.id },
      occurredOn: new Date()
    });
    
    return {
      token: session.token.value,
      user: UserMapper.toDTO(user)
    };
  }
}
```

#### 2.3 Infrastructure Layer

```typescript
// adapters/supabase-auth.adapter.ts
export class SupabaseAuthAdapter implements AuthenticationService {
  constructor(private supabase: SupabaseClient) {}
  
  async authenticate(email: Email, password: Password): Promise<User> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    });
    
    if (error) throw new AuthenticationError(error.message);
    
    return this.mapToUser(data.user);
  }
}
```

### Phase 3: Board & Canvas Module (Week 4)

#### 3.1 Board Entity

```typescript
// packages/board/src/domain/entities/board.entity.ts
export class Board extends AggregateRoot<BoardId> {
  private _name: string;
  private _description?: string;
  private _ownerId: UserId;
  private _viewport: Viewport;
  private _settings: BoardSettings;
  private _nodes: Map<NodeId, Node>;
  private _connections: Map<ConnectionId, Connection>;
  
  constructor(props: BoardProps) {
    super(props.id);
    this._name = props.name;
    this._ownerId = props.ownerId;
    this._viewport = props.viewport || new Viewport(0, 0, 1);
    this._settings = props.settings || BoardSettings.default();
    this._nodes = new Map();
    this._connections = new Map();
  }
  
  addNode(node: Node): void {
    if (this._nodes.has(node.id)) {
      throw new NodeAlreadyExistsError(node.id);
    }
    
    this._nodes.set(node.id, node);
    
    this.addDomainEvent({
      eventType: 'NodeAddedToBoard',
      aggregateId: this.id.toString(),
      eventData: { boardId: this.id, nodeId: node.id },
      occurredOn: new Date()
    });
  }
  
  connectNodes(from: NodeId, to: NodeId, type: ConnectionType): Connection {
    const fromNode = this._nodes.get(from);
    const toNode = this._nodes.get(to);
    
    if (!fromNode || !toNode) {
      throw new NodeNotFoundError();
    }
    
    const connection = new Connection(
      new ConnectionId(uuid()),
      from,
      to,
      type
    );
    
    this._connections.set(connection.id, connection);
    
    this.addDomainEvent({
      eventType: 'NodesConnected',
      aggregateId: this.id.toString(),
      eventData: { connection },
      occurredOn: new Date()
    });
    
    return connection;
  }
}
```

#### 3.2 Canvas UI Component

```typescript
// packages/web/src/modules/board/components/BoardCanvas.tsx
export const BoardCanvas: React.FC<BoardCanvasProps> = ({
  boardId,
  onNodeSelect,
  onNodeCreate
}) => {
  const { nodes, connections, viewport } = useBoardStore(boardId);
  const { user } = useAuth();
  
  const handleDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const nodeType = event.dataTransfer?.getData('node-type');
    
    if (nodeType) {
      const position = screenToCanvas(
        { x: event.clientX, y: event.clientY },
        viewport
      );
      
      onNodeCreate({
        type: nodeType as NodeType,
        position,
        boardId
      });
    }
  }, [viewport, boardId, onNodeCreate]);
  
  return (
    <div 
      className="board-canvas"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <SVGCanvas viewport={viewport}>
        <GridBackground />
        
        {connections.map(connection => (
          <ConnectionRenderer
            key={connection.id}
            connection={connection}
            fromNode={nodes.get(connection.from)}
            toNode={nodes.get(connection.to)}
          />
        ))}
        
        {Array.from(nodes.values()).map(node => (
          <NodeRenderer
            key={node.id}
            node={node}
            selected={selectedNodes.has(node.id)}
            onSelect={() => onNodeSelect(node.id)}
          />
        ))}
        
        <SelectionBox />
        <CursorTracker userId={user.id} />
      </SVGCanvas>
      
      <ViewportControls viewport={viewport} />
      <MiniMap nodes={nodes} viewport={viewport} />
    </div>
  );
};
```

### Phase 4: Node System Module (Week 5)

#### 4.1 Node Type Registry

```typescript
// packages/node-system/src/domain/services/node-registry.ts
export class NodeTypeRegistry {
  private static instance: NodeTypeRegistry;
  private nodeTypes = new Map<string, NodeTypeDefinition>();
  
  static getInstance(): NodeTypeRegistry {
    if (!this.instance) {
      this.instance = new NodeTypeRegistry();
    }
    return this.instance;
  }
  
  register(definition: NodeTypeDefinition): void {
    if (this.nodeTypes.has(definition.type)) {
      throw new Error(`Node type ${definition.type} already registered`);
    }
    
    this.nodeTypes.set(definition.type, definition);
  }
  
  getDefinition(type: string): NodeTypeDefinition | null {
    return this.nodeTypes.get(type) || null;
  }
  
  createNode(type: string, data: any): Node {
    const definition = this.getDefinition(type);
    if (!definition) {
      throw new UnknownNodeTypeError(type);
    }
    
    return definition.factory(data);
  }
}
```

#### 4.2 Built-in Node Types

```typescript
// packages/node-system/src/nodes/resource-node.ts
export class ResourceNode extends Node {
  static readonly TYPE = 'resource';
  
  constructor(
    id: NodeId,
    position: Position,
    public readonly resourceType: ResourceType,
    public readonly title: string,
    public readonly content: ResourceContent
  ) {
    super(id, position, ResourceNode.TYPE);
  }
  
  static register(): void {
    NodeTypeRegistry.getInstance().register({
      type: ResourceNode.TYPE,
      displayName: 'Resource',
      category: NodeCategory.Content,
      component: ResourceNodeComponent,
      factory: (data) => new ResourceNode(
        new NodeId(uuid()),
        data.position,
        data.resourceType,
        data.title,
        data.content
      ),
      ports: {
        outputs: [
          { id: 'content', type: PortType.Data }
        ]
      }
    });
  }
}
```

### Phase 5: AI Integration Module (Weeks 6-7)

#### 5.1 AI Service Abstraction

```typescript
// packages/ai-integration/src/domain/services/ai.service.ts
export interface AIService {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  streamComplete(
    request: CompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<void>;
  generateEmbedding(text: string): Promise<Embedding>;
}

export class MultiProviderAIService implements AIService {
  private providers = new Map<AIModel, AIProvider>();
  
  registerProvider(model: AIModel, provider: AIProvider): void {
    this.providers.set(model, provider);
  }
  
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const provider = this.providers.get(request.model);
    if (!provider) {
      throw new UnsupportedModelError(request.model);
    }
    
    return provider.complete(request);
  }
}
```

#### 5.2 RAG Context Builder

```typescript
// packages/ai-integration/src/services/context-builder.ts
export class RAGContextBuilder {
  constructor(
    private nodeRepo: NodeRepository,
    private connectionRepo: ConnectionRepository,
    private vectorSearch: VectorSearchService,
    private embeddingService: EmbeddingService
  ) {}
  
  async buildContext(chatNodeId: NodeId): Promise<RAGContext> {
    // Get connected nodes
    const connections = await this.connectionRepo.findByNode(chatNodeId);
    const connectedNodes = await Promise.all(
      connections.map(c => this.nodeRepo.findById(c.targetId))
    );
    
    // Extract content
    const contents = connectedNodes
      .filter(n => n instanceof ResourceNode)
      .map(n => n.extractContent());
    
    // Generate embeddings
    const embeddings = await Promise.all(
      contents.map(c => this.embeddingService.generate(c))
    );
    
    // Find similar content
    const query = contents.join('\n').substring(0, 1000);
    const queryEmbedding = await this.embeddingService.generate(query);
    const similar = await this.vectorSearch.search(queryEmbedding, {
      limit: 10,
      threshold: 0.7
    });
    
    return {
      directResources: connectedNodes,
      similarContent: similar,
      systemPrompt: this.buildSystemPrompt(connectedNodes, similar),
      totalTokens: this.estimateTokens(contents)
    };
  }
}
```

### Phase 6: Collaboration Module (Week 8)

#### 6.1 WebSocket Server

```typescript
// packages/collaboration/src/infrastructure/websocket-server.ts
export class CollaborationWebSocketServer {
  private io: Server;
  private sessions = new Map<string, CollaborationSession>();
  
  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: process.env.CLIENT_URL }
    });
    
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    this.io.on('connection', (socket) => {
      socket.on('join-board', async (data) => {
        const { boardId, token } = data;
        
        // Authenticate
        const user = await this.authenticateUser(token);
        if (!user) {
          socket.disconnect();
          return;
        }
        
        // Join board room
        socket.join(`board:${boardId}`);
        
        // Create/join session
        let session = this.sessions.get(boardId);
        if (!session) {
          session = new CollaborationSession(boardId);
          this.sessions.set(boardId, session);
        }
        
        session.addParticipant(user.id, socket.id);
        
        // Notify others
        socket.to(`board:${boardId}`).emit('user-joined', {
          userId: user.id,
          name: user.name,
          timestamp: Date.now()
        });
      });
      
      socket.on('cursor-move', (data) => {
        const session = this.getSessionForSocket(socket.id);
        if (!session) return;
        
        session.updateCursor(socket.id, data.position);
        
        socket.to(`board:${session.boardId}`).emit('cursor-moved', {
          userId: session.getUserId(socket.id),
          position: data.position
        });
      });
    });
  }
}
```

#### 6.2 Y.js Integration

```typescript
// packages/collaboration/src/services/yjs-provider.ts
export class YjsCollaborationProvider {
  private docs = new Map<string, Y.Doc>();
  
  async getDocument(boardId: string): Promise<Y.Doc> {
    let doc = this.docs.get(boardId);
    
    if (!doc) {
      doc = new Y.Doc();
      
      // Load from persistence
      const snapshot = await this.loadSnapshot(boardId);
      if (snapshot) {
        Y.applyUpdate(doc, snapshot);
      }
      
      // Setup persistence
      doc.on('update', (update) => {
        this.persistUpdate(boardId, update);
      });
      
      this.docs.set(boardId, doc);
    }
    
    return doc;
  }
  
  setupBoardSync(boardId: string, doc: Y.Doc): void {
    const nodesMap = doc.getMap('nodes');
    const connectionsMap = doc.getMap('connections');
    
    // Sync nodes
    nodesMap.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add') {
          this.handleNodeAdded(boardId, key, nodesMap.get(key));
        } else if (change.action === 'update') {
          this.handleNodeUpdated(boardId, key, nodesMap.get(key));
        } else if (change.action === 'delete') {
          this.handleNodeDeleted(boardId, key);
        }
      });
    });
  }
}
```

### Phase 7: Storage Module (Week 9)

#### 7.1 Storage Abstraction

```typescript
// packages/storage/src/domain/services/storage.service.ts
export interface StorageService {
  upload(file: File, options: UploadOptions): Promise<FileReference>;
  download(reference: FileReference): Promise<File>;
  delete(reference: FileReference): Promise<void>;
  generateUrl(reference: FileReference, expires?: number): Promise<string>;
}

export class StorageServiceFactory {
  private static providers = new Map<string, StorageProvider>();
  
  static register(name: string, provider: StorageProvider): void {
    this.providers.set(name, provider);
  }
  
  static create(type: string = 'default'): StorageService {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Unknown storage provider: ${type}`);
    }
    return provider;
  }
}
```

#### 7.2 Media Processing Pipeline

```typescript
// packages/storage/src/services/media-processor.ts
export class MediaProcessingPipeline {
  private processors = new Map<string, MediaProcessor>();
  
  constructor() {
    this.registerBuiltinProcessors();
  }
  
  async process(file: File): Promise<ProcessedMedia> {
    const processor = this.getProcessor(file.type);
    if (!processor) {
      throw new UnsupportedFileTypeError(file.type);
    }
    
    // Process file
    const processed = await processor.process(file);
    
    // Generate embeddings for searchable content
    if (processed.extractedText) {
      processed.embeddings = await this.generateEmbeddings(
        processed.extractedText
      );
    }
    
    return processed;
  }
  
  private registerBuiltinProcessors(): void {
    this.processors.set('image', new ImageProcessor());
    this.processors.set('video', new VideoProcessor());
    this.processors.set('audio', new AudioProcessor());
    this.processors.set('document', new DocumentProcessor());
  }
}
```

### Phase 8: API Layer (Week 10)

#### 8.1 REST API Setup

```typescript
// apps/backend/src/api/routes/board.routes.ts
export class BoardRoutes {
  constructor(
    private boardController: BoardController,
    private authMiddleware: AuthMiddleware
  ) {}
  
  register(app: Express): void {
    const router = Router();
    
    // Apply auth to all routes
    router.use(this.authMiddleware.authenticate);
    
    // Board CRUD
    router.get('/', this.boardController.list);
    router.post('/', validate(CreateBoardSchema), this.boardController.create);
    router.get('/:id', this.boardController.get);
    router.patch('/:id', validate(UpdateBoardSchema), this.boardController.update);
    router.delete('/:id', this.boardController.delete);
    
    // Node operations
    router.post('/:id/nodes', validate(CreateNodeSchema), this.boardController.addNode);
    router.delete('/:id/nodes/:nodeId', this.boardController.removeNode);
    
    // Share
    router.post('/:id/share', this.boardController.share);
    
    app.use('/api/boards', router);
  }
}
```

#### 8.2 GraphQL Schema

```typescript
// apps/backend/src/api/graphql/schema.ts
export const typeDefs = gql`
  type Board {
    id: ID!
    name: String!
    description: String
    owner: User!
    nodes: [Node!]!
    connections: [Connection!]!
    viewport: Viewport!
    settings: BoardSettings!
    createdAt: DateTime!
    updatedAt: DateTime!
  }
  
  interface Node {
    id: ID!
    type: NodeType!
    position: Position!
    size: Size!
    boardId: ID!
  }
  
  type ResourceNode implements Node {
    id: ID!
    type: NodeType!
    position: Position!
    size: Size!
    boardId: ID!
    resourceType: ResourceType!
    title: String!
    content: ResourceContent!
  }
  
  type Query {
    board(id: ID!): Board
    boards(page: Int, limit: Int): BoardConnection!
    searchNodes(query: String!, boardId: ID): [Node!]!
  }
  
  type Mutation {
    createBoard(input: CreateBoardInput!): Board!
    updateBoard(id: ID!, input: UpdateBoardInput!): Board!
    deleteBoard(id: ID!): Boolean!
    
    addNode(boardId: ID!, input: AddNodeInput!): Node!
    updateNode(id: ID!, input: UpdateNodeInput!): Node!
    deleteNode(id: ID!): Boolean!
    
    connectNodes(from: ID!, to: ID!, type: ConnectionType): Connection!
    disconnectNodes(connectionId: ID!): Boolean!
  }
  
  type Subscription {
    boardUpdated(boardId: ID!): BoardUpdateEvent!
    nodeUpdated(boardId: ID!): NodeUpdateEvent!
    cursorMoved(boardId: ID!): CursorMovedEvent!
  }
`;
```

### Phase 9: Testing & Quality Assurance (Week 11)

#### 9.1 Unit Test Examples

```typescript
// packages/board/src/domain/entities/__tests__/board.test.ts
describe('Board Entity', () => {
  let board: Board;
  
  beforeEach(() => {
    board = new Board({
      id: new BoardId('test-board'),
      name: 'Test Board',
      ownerId: new UserId('user-123'),
      viewport: new Viewport(0, 0, 1),
      settings: BoardSettings.default()
    });
  });
  
  describe('addNode', () => {
    it('should add node to board', () => {
      const node = new ResourceNode(
        new NodeId('node-1'),
        new Position(100, 100),
        ResourceType.Image,
        'Test Image',
        new ResourceContent({ url: 'test.jpg' })
      );
      
      board.addNode(node);
      
      expect(board.getNodes()).toContain(node);
      expect(board.getUncommittedEvents()).toContainEqual(
        expect.objectContaining({
          eventType: 'NodeAddedToBoard'
        })
      );
    });
    
    it('should throw if node already exists', () => {
      const node = createTestNode('node-1');
      board.addNode(node);
      
      expect(() => board.addNode(node)).toThrow(NodeAlreadyExistsError);
    });
  });
});
```

#### 9.2 Integration Test Examples

```typescript
// apps/backend/src/__tests__/board-api.integration.test.ts
describe('Board API Integration', () => {
  let app: Application;
  let authToken: string;
  let testUser: User;
  
  beforeAll(async () => {
    app = await createTestApp();
    testUser = await createTestUser();
    authToken = await getAuthToken(testUser);
  });
  
  describe('POST /api/boards', () => {
    it('should create board with valid data', async () => {
      const response = await request(app)
        .post('/api/boards')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Board',
          description: 'A test board'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        board: {
          name: 'Test Board',
          description: 'A test board',
          ownerId: testUser.id
        }
      });
    });
  });
});
```

#### 9.3 E2E Test Examples

```typescript
// apps/frontend/e2e/board-creation.spec.ts
describe('Board Creation Flow', () => {
  beforeEach(async () => {
    await page.goto('/');
    await login(page, testUser);
  });
  
  it('should create and navigate to new board', async () => {
    // Click create board button
    await page.click('[data-testid="create-board-btn"]');
    
    // Fill form
    await page.fill('[name="name"]', 'My New Board');
    await page.fill('[name="description"]', 'Test description');
    
    // Submit
    await page.click('[type="submit"]');
    
    // Should navigate to new board
    await page.waitForURL(/\/board\/[a-z0-9-]+/);
    
    // Should show board name
    expect(await page.textContent('h1')).toBe('My New Board');
    
    // Should show empty state
    expect(await page.isVisible('[data-testid="empty-board"]')).toBe(true);
  });
});
```

### Phase 10: Deployment & DevOps (Week 12)

#### 10.1 Docker Configuration

```dockerfile
# Base image for all services
FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

# Dependencies
FROM base AS deps
COPY package*.json ./
COPY lerna.json ./
COPY packages/*/package*.json ./packages/
RUN npm ci

# Builder
FROM deps AS builder
COPY . .
RUN npm run build

# Backend runner
FROM base AS backend
COPY --from=builder /app/dist/apps/backend ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "main.js"]

# Frontend runner
FROM nginx:alpine AS frontend
COPY --from=builder /app/dist/apps/frontend /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

#### 10.2 Kubernetes Deployment

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ragboard-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ragboard-backend
  template:
    metadata:
      labels:
        app: ragboard-backend
    spec:
      containers:
      - name: backend
        image: ragboard/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ragboard-secrets
              key: database-url
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
```

#### 10.3 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: 18
    - run: npm ci
    - run: npm run test
    - run: npm run lint
    - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Build images
      run: |
        docker build -t ragboard/backend:${{ github.sha }} --target backend .
        docker build -t ragboard/frontend:${{ github.sha }} --target frontend .
    
    - name: Push to registry
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push ragboard/backend:${{ github.sha }}
        docker push ragboard/frontend:${{ github.sha }}
    
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/ragboard-backend backend=ragboard/backend:${{ github.sha }}
        kubectl set image deployment/ragboard-frontend frontend=ragboard/frontend:${{ github.sha }}
```

## Success Criteria

### Module-Level Criteria

1. **Authentication Module**
   - [ ] JWT-based authentication working
   - [ ] Session management implemented
   - [ ] Permission system functional
   - [ ] OAuth integration complete

2. **Board Module**
   - [ ] CRUD operations working
   - [ ] Viewport controls functional
   - [ ] Grid snapping implemented
   - [ ] Minimap working

3. **Node System**
   - [ ] All node types implemented
   - [ ] Drag & drop working
   - [ ] Resize functionality complete
   - [ ] Connection system functional

4. **AI Integration**
   - [ ] Multi-model support working
   - [ ] RAG context building functional
   - [ ] Streaming responses implemented
   - [ ] Vector search working

5. **Collaboration**
   - [ ] Real-time cursor tracking
   - [ ] Live updates working
   - [ ] Conflict resolution implemented
   - [ ] Y.js integration complete

6. **Storage**
   - [ ] File upload working
   - [ ] Media processing functional
   - [ ] CDN integration complete
   - [ ] Thumbnail generation working

### System-Level Criteria

- [ ] All modules integrated successfully
- [ ] API endpoints documented and tested
- [ ] Frontend responsive and performant
- [ ] WebSocket connections stable
- [ ] Deployment pipeline functional
- [ ] Monitoring and logging in place
- [ ] Security audit passed
- [ ] Performance benchmarks met

## Risk Mitigation

1. **Technical Risks**
   - Complex Y.js integration → Prototype early
   - AI model costs → Implement caching
   - WebSocket scaling → Use Redis adapter

2. **Schedule Risks**
   - Dependencies between modules → Parallel development where possible
   - Third-party API limits → Mock services for development

3. **Resource Risks**
   - Limited AI API quota → Local model fallback
   - Storage costs → Implement quotas early

This roadmap provides a structured approach to implementing the RAGBOARD modular architecture with clear milestones and success criteria for each phase.