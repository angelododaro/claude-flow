import type { Document } from '@langchain/core/documents'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp?: Date
  metadata?: Record<string, any>
}

export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  context?: Document[]
}

export interface EmbeddingResult {
  text: string
  embedding: number[]
  metadata?: Record<string, any>
}

export interface SearchResult {
  document: Document
  score: number
  highlights?: string[]
}

export interface RAGContext {
  documents: Document[]
  query: string
  maxResults?: number
  threshold?: number
}

export interface NodeEmbedding {
  nodeId: string
  nodeType: string
  content: string
  embedding: number[]
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}