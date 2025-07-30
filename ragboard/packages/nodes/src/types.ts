import { NodeType, Position, Size } from '@ragboard/types'

export interface BaseNodeData {
  id: string
  type: NodeType
  position: Position
  size: Size
  boardId: string
  selected?: boolean
  dragging?: boolean
  connecting?: boolean
}

export interface NodeProps<T = any> {
  node: BaseNodeData & { data: T }
  selected: boolean
  onUpdate: (updates: Partial<BaseNodeData & { data: T }>) => void
  onDelete: () => void
  onConnect?: (targetId: string) => void
  onStartConnection?: () => void
  onEndConnection?: (port: string) => void
  onResize?: (size: Size) => void
  onChat?: (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<{ answer: string; sources?: string[] }>
}

export interface NodeRenderer<T = any> {
  type: NodeType
  displayName: string
  icon: React.ComponentType<{ className?: string }>
  defaultSize: Size
  minSize: Size
  maxSize?: Size
  resizable: boolean
  component: React.ComponentType<NodeProps<T>>
  defaultData: () => T
}

export interface NodeRegistryInterface {
  register<T>(renderer: NodeRenderer<T>): void
  unregister(type: NodeType): void
  get(type: NodeType): NodeRenderer | undefined
  getAll(): NodeRenderer[]
  create<T>(type: NodeType, position: Position, boardId: string): BaseNodeData & { data: T }
}

// Node-specific data types
export interface TextNodeData {
  content: string
  format?: 'plain' | 'markdown' | 'rich'
  plainText?: string
}

export interface AIChatNodeData {
  model: 'claude-3-sonnet' | 'gpt-4' | 'gpt-3.5-turbo'
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    sources?: string[]
  }>
  temperature?: number
  maxTokens?: number
}

export interface ImageNodeData {
  url?: string
  file?: File
  caption?: string
  width?: number
  height?: number
}

export interface VideoNodeData {
  url?: string
  originalUrl?: string
  file?: File
  name?: string
  platform?: 'youtube' | 'vimeo' | 'local'
  thumbnail?: string
  duration?: number
  transcript?: string
}

export interface AudioNodeData {
  url?: string
  file?: File | Blob
  name?: string
  duration?: number
  waveform?: number[]
  transcript?: string
  recordedAt?: Date
}

export interface DocumentNodeData {
  url?: string
  file?: File
  name?: string
  fileType?: 'pdf' | 'doc' | 'docx' | 'txt'
  pageCount?: number
  size?: number
  extractedText?: string
  preview?: string
}

export interface URLNodeData {
  url: string
  title?: string
  description?: string
  image?: string
  favicon?: string
  content?: string
  extractedContent?: string
  scrapedAt?: Date
}

export interface FolderNodeData {
  name: string
  color?: string
  nodeIds: string[]
}