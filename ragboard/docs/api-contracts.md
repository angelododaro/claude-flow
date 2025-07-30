# RAGBOARD API Contracts

## Overview

This document defines the API contracts between RAGBOARD modules, ensuring clear communication interfaces and enabling independent module development.

## Table of Contents

1. [Authentication Module APIs](#authentication-module-apis)
2. [Board/Canvas Module APIs](#boardcanvas-module-apis)
3. [Node System Module APIs](#node-system-module-apis)
4. [AI Integration Module APIs](#ai-integration-module-apis)
5. [Collaboration Module APIs](#collaboration-module-apis)
6. [Storage/Media Module APIs](#storagemedia-module-apis)
7. [WebSocket Events](#websocket-events)
8. [Error Contracts](#error-contracts)

## Authentication Module APIs

### REST Endpoints

#### POST /api/auth/register
Register a new user account.

**Request:**
```typescript
{
  email: string         // Valid email address
  password: string      // Min 8 chars, 1 uppercase, 1 number
  name?: string        // Display name
}
```

**Response:**
```typescript
{
  user: {
    id: string
    email: string
    name: string | null
    createdAt: string  // ISO 8601
  }
  tokens: {
    accessToken: string
    refreshToken: string
    expiresIn: number  // seconds
  }
}
```

#### POST /api/auth/login
Authenticate user and receive tokens.

**Request:**
```typescript
{
  email: string
  password: string
  remember?: boolean  // Extended session
}
```

**Response:**
```typescript
{
  user: {
    id: string
    email: string
    name: string | null
    avatar: string | null
    permissions: string[]
  }
  tokens: {
    accessToken: string
    refreshToken: string
    expiresIn: number
  }
}
```

#### POST /api/auth/refresh
Refresh access token using refresh token.

**Request:**
```typescript
{
  refreshToken: string
}
```

**Response:**
```typescript
{
  tokens: {
    accessToken: string
    refreshToken: string  // New refresh token
    expiresIn: number
  }
}
```

#### GET /api/auth/me
Get current authenticated user.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```typescript
{
  user: {
    id: string
    email: string
    name: string | null
    avatar: string | null
    permissions: string[]
    settings: {
      theme: 'light' | 'dark'
      language: string
      notifications: boolean
    }
  }
}
```

### Internal Service APIs

```typescript
interface AuthenticationService {
  // Validate JWT token and return user
  validateToken(token: string): Promise<{
    valid: boolean
    user?: User
    error?: string
  }>
  
  // Check if user has specific permission
  hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean>
  
  // Get all permissions for a user
  getUserPermissions(userId: string): Promise<Permission[]>
  
  // Invalidate all sessions for a user
  invalidateUserSessions(userId: string): Promise<void>
}
```

## Board/Canvas Module APIs

### REST Endpoints

#### GET /api/boards
List user's boards with pagination.

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 20, max: 100)
sort: 'created' | 'updated' | 'name' (default: 'updated')
order: 'asc' | 'desc' (default: 'desc')
search?: string
```

**Response:**
```typescript
{
  boards: Array<{
    id: string
    name: string
    description: string | null
    thumbnail: string | null
    nodeCount: number
    lastModified: string
    permissions: {
      canEdit: boolean
      canDelete: boolean
      canShare: boolean
    }
  }>
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}
```

#### POST /api/boards
Create a new board.

**Request:**
```typescript
{
  name: string           // Required, max 255 chars
  description?: string   // Max 1000 chars
  settings?: {
    gridEnabled: boolean
    snapToGrid: boolean
    gridSize: number
    theme: 'light' | 'dark'
  }
}
```

**Response:**
```typescript
{
  board: {
    id: string
    name: string
    description: string | null
    ownerId: string
    settings: BoardSettings
    createdAt: string
    updatedAt: string
  }
}
```

#### GET /api/boards/:id
Get board details with nodes and connections.

**Response:**
```typescript
{
  board: {
    id: string
    name: string
    description: string | null
    ownerId: string
    settings: BoardSettings
    viewport: {
      x: number
      y: number
      zoom: number
    }
    createdAt: string
    updatedAt: string
  }
  nodes: Array<Node>         // All node types
  connections: Array<{
    id: string
    source: string
    target: string
    type: 'data' | 'reference'
    metadata: object
  }>
  collaborators: Array<{
    userId: string
    name: string
    avatar: string | null
    role: 'viewer' | 'editor' | 'owner'
  }>
}
```

#### PATCH /api/boards/:id
Update board properties.

**Request:**
```typescript
{
  name?: string
  description?: string
  settings?: Partial<BoardSettings>
  viewport?: {
    x?: number
    y?: number
    zoom?: number
  }
}
```

#### DELETE /api/boards/:id
Delete a board and all its contents.

**Response:**
```typescript
{
  success: boolean
  deletedItems: {
    nodes: number
    connections: number
    files: number
  }
}
```

#### POST /api/boards/:id/share
Create a share link for the board.

**Request:**
```typescript
{
  permissions: {
    canView: boolean
    canEdit: boolean
    canComment: boolean
  }
  expiresIn?: number      // Hours, null for permanent
  password?: string       // Optional password protection
}
```

**Response:**
```typescript
{
  shareLink: {
    id: string
    url: string
    permissions: SharePermissions
    expiresAt: string | null
    hasPassword: boolean
  }
}
```

### Internal Service APIs

```typescript
interface BoardService {
  // Get board with access check
  getBoard(boardId: string, userId: string): Promise<Board>
  
  // Update board viewport (for real-time sync)
  updateViewport(
    boardId: string,
    viewport: Viewport
  ): Promise<void>
  
  // Get all nodes for a board
  getBoardNodes(boardId: string): Promise<Node[]>
  
  // Check if user can access board
  canAccessBoard(
    userId: string,
    boardId: string,
    action: 'view' | 'edit' | 'delete'
  ): Promise<boolean>
}
```

## Node System Module APIs

### REST Endpoints

#### POST /api/boards/:boardId/nodes
Add a new node to the board.

**Request:**
```typescript
{
  type: 'resource' | 'chat' | 'folder' | 'text' | 'url'
  position: {
    x: number
    y: number
  }
  size?: {
    width: number
    height: number
  }
  data: object  // Type-specific data
}
```

**Response:**
```typescript
{
  node: {
    id: string
    boardId: string
    type: string
    position: Position
    size: Size
    data: object
    createdAt: string
    updatedAt: string
  }
}
```

#### PATCH /api/nodes/:id
Update node properties.

**Request:**
```typescript
{
  position?: Position
  size?: Size
  data?: Partial<NodeData>
}
```

#### DELETE /api/nodes/:id
Delete a node and its connections.

**Response:**
```typescript
{
  success: boolean
  deletedConnections: number
}
```

#### POST /api/nodes/:id/process
Process node content (e.g., extract text, generate embeddings).

**Response:**
```typescript
{
  status: 'processing' | 'completed' | 'failed'
  processedData?: {
    extractedText?: string
    embeddings?: {
      id: string
      dimensions: number
    }
    metadata?: object
  }
  error?: string
}
```

### Node Type Contracts

#### Resource Node
```typescript
interface ResourceNodeData {
  resourceType: 'image' | 'video' | 'audio' | 'document' | 'text'
  title: string
  description?: string
  fileReference?: {
    id: string
    url: string
    size: number
    mimeType: string
  }
  content?: string        // For text resources
  extractedText?: string  // From processing
  metadata?: {
    width?: number        // Images/videos
    height?: number
    duration?: number     // Audio/video
    pageCount?: number    // Documents
  }
}
```

#### AI Chat Node
```typescript
interface AIChatNodeData {
  model: 'claude-3' | 'gpt-4' | 'gemini-pro'
  systemPrompt?: string
  temperature: number     // 0-2
  maxTokens: number      // Model-specific limits
  settings: {
    streamResponses: boolean
    includeContext: boolean
    contextDepth: number  // How many connected nodes to include
  }
}
```

#### Folder Node
```typescript
interface FolderNodeData {
  name: string
  color?: string         // Hex color
  expanded: boolean
  childNodes: string[]   // Node IDs
}
```

### Internal Service APIs

```typescript
interface NodeService {
  // Create node with validation
  createNode(
    boardId: string,
    type: NodeType,
    data: NodeData,
    userId: string
  ): Promise<Node>
  
  // Get nodes connected to a specific node
  getConnectedNodes(nodeId: string): Promise<Node[]>
  
  // Move multiple nodes (for group operations)
  moveNodes(
    nodeIds: string[],
    delta: { x: number, y: number }
  ): Promise<void>
  
  // Get nodes within viewport (for optimization)
  getNodesInViewport(
    boardId: string,
    viewport: Viewport
  ): Promise<Node[]>
}
```

## AI Integration Module APIs

### REST Endpoints

#### POST /api/chat/sessions
Start a new chat session.

**Request:**
```typescript
{
  nodeId: string          // AI chat node ID
  initialContext?: {
    includeConnectedNodes: boolean
    additionalContext?: string
  }
}
```

**Response:**
```typescript
{
  session: {
    id: string
    nodeId: string
    model: string
    context: {
      connectedResources: Array<{
        id: string
        type: string
        title: string
        summary: string
      }>
      totalTokens: number
    }
    createdAt: string
  }
}
```

#### POST /api/chat/:sessionId/messages
Send a message in the chat session.

**Request:**
```typescript
{
  message: string
  stream?: boolean        // Stream response
}
```

**Response (non-streaming):**
```typescript
{
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    tokens: {
      prompt: number
      completion: number
    }
  }
}
```

**Response (streaming):**
```
data: {"chunk": "Hello", "id": "msg-123"}
data: {"chunk": " there", "id": "msg-123"}
data: {"done": true, "id": "msg-123", "tokens": {"prompt": 10, "completion": 5}}
```

#### GET /api/chat/:sessionId/history
Get chat history with pagination.

**Query Parameters:**
```
limit: number (default: 50)
before?: string (message ID)
```

**Response:**
```typescript
{
  messages: Array<Message>
  hasMore: boolean
  session: {
    id: string
    model: string
    startedAt: string
    endedAt?: string
  }
}
```

#### POST /api/ai/embeddings
Generate embeddings for text.

**Request:**
```typescript
{
  text: string
  model?: 'text-embedding-ada-002' | 'voyage-01'
}
```

**Response:**
```typescript
{
  embedding: {
    id: string
    vector: number[]
    dimensions: number
    model: string
  }
}
```

#### POST /api/ai/search
Semantic search across board content.

**Request:**
```typescript
{
  query: string
  boardId?: string        // Limit to specific board
  limit?: number         // Default: 10
  threshold?: number     // Similarity threshold 0-1
  filters?: {
    nodeTypes?: string[]
    dateRange?: {
      from: string
      to: string
    }
  }
}
```

**Response:**
```typescript
{
  results: Array<{
    nodeId: string
    boardId: string
    title: string
    excerpt: string
    type: string
    score: number       // Similarity score
    highlights: Array<{
      text: string
      positions: Array<[number, number]>
    }>
  }>
  totalCount: number
  searchId: string      // For analytics
}
```

### Internal Service APIs

```typescript
interface AIService {
  // Build RAG context from connected nodes
  buildRAGContext(
    chatNodeId: string,
    options: ContextOptions
  ): Promise<RAGContext>
  
  // Stream chat completion
  streamCompletion(
    sessionId: string,
    message: string,
    onChunk: (chunk: string) => void
  ): Promise<CompletionResult>
  
  // Analyze image content
  analyzeImage(
    imageUrl: string
  ): Promise<{
    description: string
    objects: string[]
    text?: string
    confidence: number
  }>
  
  // Transcribe audio
  transcribeAudio(
    audioUrl: string,
    language?: string
  ): Promise<{
    text: string
    segments: TranscriptSegment[]
    language: string
  }>
}
```

## Collaboration Module APIs

### WebSocket Events

#### Connection Events

**Client → Server: join-board**
```typescript
{
  boardId: string
  token: string          // Auth token
}
```

**Server → Client: board-joined**
```typescript
{
  boardId: string
  participants: Array<{
    userId: string
    name: string
    avatar?: string
    cursor?: CursorPosition
    color: string       // Assigned color
  }>
}
```

**Server → Client: participant-joined**
```typescript
{
  userId: string
  name: string
  avatar?: string
  color: string
  timestamp: string
}
```

#### Cursor Events

**Client → Server: cursor-move**
```typescript
{
  position: {
    x: number
    y: number
    viewportX: number
    viewportY: number
  }
}
```

**Server → Client: cursor-moved**
```typescript
{
  userId: string
  position: CursorPosition
}
```

#### Node Events

**Client → Server: node-update**
```typescript
{
  nodeId: string
  changes: Partial<Node>
  version: number       // For conflict resolution
}
```

**Server → Client: node-updated**
```typescript
{
  nodeId: string
  changes: Partial<Node>
  userId: string
  version: number
  timestamp: string
}
```

#### Selection Events

**Client → Server: selection-change**
```typescript
{
  selected: string[]    // Node IDs
}
```

**Server → Client: selection-changed**
```typescript
{
  userId: string
  selected: string[]
}
```

### Internal Service APIs

```typescript
interface CollaborationService {
  // Track user presence
  updatePresence(
    userId: string,
    boardId: string,
    presence: PresenceData
  ): Promise<void>
  
  // Get active participants
  getActiveParticipants(
    boardId: string
  ): Promise<Participant[]>
  
  // Handle Y.js document sync
  syncDocument(
    boardId: string,
    update: Uint8Array
  ): Promise<void>
  
  // Resolve conflicts
  resolveConflict(
    localChange: Change,
    remoteChange: Change
  ): Promise<Resolution>
}
```

## Storage/Media Module APIs

### REST Endpoints

#### POST /api/upload
Upload a file.

**Request:** Multipart form data
```
file: File
boardId: string
nodeId?: string         // Attach to existing node
```

**Response:**
```typescript
{
  file: {
    id: string
    url: string
    thumbnailUrl?: string
    size: number
    mimeType: string
    metadata: {
      width?: number
      height?: number
      duration?: number
      pageCount?: number
    }
  }
  processing: {
    status: 'pending' | 'processing' | 'completed'
    extractedText?: string
  }
}
```

#### GET /api/media/:id
Get media file details.

**Response:**
```typescript
{
  media: {
    id: string
    url: string
    thumbnailUrl?: string
    size: number
    mimeType: string
    uploadedBy: string
    uploadedAt: string
    metadata: MediaMetadata
    processing: {
      status: string
      extractedText?: string
      error?: string
    }
  }
}
```

#### POST /api/media/:id/process
Trigger reprocessing of media.

**Request:**
```typescript
{
  operations: Array<'thumbnail' | 'text' | 'metadata' | 'embeddings'>
}
```

**Response:**
```typescript
{
  jobId: string
  status: 'queued'
  estimatedTime: number  // seconds
}
```

### Internal Service APIs

```typescript
interface StorageService {
  // Upload with processing
  uploadAndProcess(
    file: File,
    options: UploadOptions
  ): Promise<ProcessedFile>
  
  // Generate presigned URL
  getPresignedUrl(
    fileId: string,
    expiresIn: number
  ): Promise<string>
  
  // Delete file and cleanup
  deleteFile(
    fileId: string
  ): Promise<void>
  
  // Get storage usage
  getUsage(
    userId: string
  ): Promise<{
    totalBytes: number
    fileCount: number
    byType: Record<string, number>
  }>
}
```

## WebSocket Events

### Event Format

All WebSocket events follow this format:

```typescript
interface SocketEvent {
  type: string           // Event type
  payload: any          // Event-specific data
  timestamp: string     // ISO 8601
  version?: number      // For ordering
}
```

### Board Events

```typescript
// Board updated
{
  type: 'board.updated',
  payload: {
    boardId: string
    changes: Partial<Board>
    userId: string
  }
}

// Node created
{
  type: 'node.created',
  payload: {
    boardId: string
    node: Node
    userId: string
  }
}

// Node deleted
{
  type: 'node.deleted',
  payload: {
    boardId: string
    nodeId: string
    userId: string
  }
}

// Connection created
{
  type: 'connection.created',
  payload: {
    boardId: string
    connection: Connection
    userId: string
  }
}
```

### Collaboration Events

```typescript
// Typing indicator
{
  type: 'user.typing',
  payload: {
    userId: string
    nodeId: string
    isTyping: boolean
  }
}

// Comment added
{
  type: 'comment.added',
  payload: {
    boardId: string
    nodeId?: string
    comment: Comment
  }
}
```

## Error Contracts

### Error Response Format

All API errors follow this format:

```typescript
interface ErrorResponse {
  error: {
    code: string         // Machine-readable code
    message: string      // Human-readable message
    details?: any       // Additional error details
    timestamp: string
    requestId: string   // For debugging
  }
}
```

### Common Error Codes

```typescript
enum ErrorCode {
  // Authentication errors (401)
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_FIELD = 'MISSING_FIELD',
  
  // Resource errors (404)
  NOT_FOUND = 'NOT_FOUND',
  BOARD_NOT_FOUND = 'BOARD_NOT_FOUND',
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  
  // Conflict errors (409)
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  VERSION_CONFLICT = 'VERSION_CONFLICT',
  
  // Rate limiting (429)
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}
```

### Error Examples

**401 Unauthorized:**
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your session has expired. Please log in again.",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-123abc"
  }
}
```

**400 Bad Request:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "fields": {
        "name": "Name is required",
        "email": "Invalid email format"
      }
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-456def"
  }
}
```

**429 Rate Limited:**
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": {
      "retryAfter": 60,
      "limit": 100,
      "window": "1h"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-789ghi"
  }
}
```

## Versioning Strategy

### API Version Header

All requests should include:
```
X-API-Version: 1.0
```

### Backward Compatibility

- New fields are added as optional
- Deprecated fields remain for 6 months
- Breaking changes require new version
- Version sunset notices given 3 months ahead

### Deprecation Example

```typescript
{
  "board": {
    "id": "123",
    "name": "My Board",
    "theme": "dark",      // Deprecated, use settings.theme
    "settings": {
      "theme": "dark"     // New location
    }
  },
  "_deprecations": {
    "theme": {
      "message": "Use settings.theme instead",
      "sunsetDate": "2024-07-01"
    }
  }
}
```

This comprehensive API contract documentation ensures clear communication between all RAGBOARD modules and enables parallel development by different teams.