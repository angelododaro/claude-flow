// User types
export interface User {
  id: string
  email: string
  name?: string
  avatarUrl?: string
  createdAt: Date
  updatedAt: Date
}

// Board types
export interface Board {
  id: string
  name: string
  description?: string
  thumbnail?: string
  userId: string
  data?: any // Excalidraw data
  createdAt: Date
  updatedAt: Date
  nodes?: Node[]
  user?: User
}

// Position and Size types
export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

// Node types
export enum NodeType {
  AI_CHAT = 'ai_chat',
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  URL = 'url',
  FOLDER = 'folder'
}

export interface Node {
  id: string
  type: NodeType
  position: Position
  size: Size
  data: any
  boardId: string
  board?: Board
  fromConnections?: Connection[]
  toConnections?: Connection[]
  createdAt: Date
  updatedAt: Date
}

// Connection types
export interface Connection {
  id: string
  fromId: string
  from?: Node
  toId: string
  to?: Node
  boardId: string
  createdAt: Date
}

// Auth types
export interface AuthUser {
  id: string
  email: string
  user_metadata?: {
    name?: string
    avatar_url?: string
  }
}

export interface Session {
  user: AuthUser
  access_token: string
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}