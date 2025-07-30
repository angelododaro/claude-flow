import { VectorStoreService } from './vector-store'
import { ChatService } from './chat'
import { RAGService } from './rag'
import { WebScraperService } from './web-scraper'
import { DocumentService } from './document'
import type { AIConfig } from '../config'

export class AIService {
  private vectorStore: VectorStoreService
  private chat: ChatService
  private rag: RAGService
  private webScraper: WebScraperService
  private document: DocumentService

  constructor(config?: Partial<AIConfig>) {
    // Initialize vector store
    this.vectorStore = new VectorStoreService(
      config?.vectorStore?.config?.url,
      config?.openai?.apiKey
    )

    // Initialize chat service
    this.chat = new ChatService({
      openaiApiKey: config?.openai?.apiKey,
      anthropicApiKey: config?.anthropic?.apiKey,
    })

    // Initialize RAG service
    this.rag = new RAGService(this.vectorStore, this.chat)

    // Initialize utility services
    this.webScraper = new WebScraperService()
    this.document = new DocumentService()
  }

  async initialize() {
    await this.vectorStore.initialize()
  }

  // Vector Store operations
  async embedNode(node: {
    id: string
    type: string
    content: string
    metadata?: Record<string, any>
  }) {
    return this.vectorStore.embedNode(node)
  }

  async searchNodes(boardId: string, query: string, limit?: number) {
    return this.vectorStore.searchNodes(boardId, query, limit)
  }

  async updateNodeEmbedding(
    nodeId: string,
    boardId: string,
    content: string,
    metadata?: Record<string, any>
  ) {
    return this.vectorStore.updateNodeEmbedding(nodeId, boardId, content, metadata)
  }

  async deleteNodeEmbedding(nodeId: string, boardId: string) {
    return this.vectorStore.deleteNodeEmbedding(nodeId, boardId)
  }

  // Chat operations
  async chat(messages: any[], options?: any) {
    return this.chat.chat(messages, options)
  }

  async generateTitle(content: string) {
    return this.chat.generateTitle(content)
  }

  async summarize(content: string) {
    return this.chat.summarize(content)
  }

  // RAG operations
  async answerWithContext(boardId: string, messages: any[], options?: any) {
    return this.rag.answerWithContext(boardId, messages, options)
  }

  async suggestConnections(nodeId: string, boardId: string) {
    return this.rag.suggestConnections(nodeId, boardId)
  }

  async generateInsights(boardId: string) {
    return this.rag.generateInsights(boardId)
  }

  // Document operations
  async extractTextFromPDF(buffer: Buffer) {
    return this.document.extractTextFromPDF(buffer)
  }

  async extractTextFromURL(url: string) {
    return this.webScraper.scrapeURL(url)
  }

  // Utility methods
  async processNodeContent(node: {
    id: string
    type: string
    data: any
    boardId: string
  }): Promise<string> {
    let content = ''

    switch (node.type) {
      case 'TEXT':
        content = node.data.content || ''
        break
      
      case 'AI_CHAT':
        // Combine all messages into searchable content
        content = node.data.messages
          ?.map((m: any) => `${m.role}: ${m.content}`)
          .join('\n') || ''
        break
      
      case 'IMAGE':
        content = node.data.caption || node.data.alt || 'Image node'
        break
      
      case 'DOCUMENT':
        if (node.data.extractedText) {
          content = node.data.extractedText
        } else if (node.data.url) {
          // Extract text from document
          try {
            const response = await fetch(node.data.url)
            const buffer = await response.arrayBuffer()
            content = await this.extractTextFromPDF(Buffer.from(buffer))
          } catch (error) {
            content = `Document: ${node.data.name || 'Untitled'}`
          }
        }
        break
      
      case 'URL':
        if (node.data.extractedContent) {
          content = node.data.extractedContent
        } else if (node.data.url) {
          try {
            const scraped = await this.extractTextFromURL(node.data.url)
            content = `${scraped.title}\n\n${scraped.content}`
          } catch (error) {
            content = `URL: ${node.data.url}`
          }
        }
        break
      
      default:
        content = JSON.stringify(node.data)
    }

    return content
  }

  // Batch operations
  async indexBoard(boardId: string, nodes: any[]) {
    const results = await Promise.allSettled(
      nodes.map(async (node) => {
        const content = await this.processNodeContent({
          ...node,
          boardId,
        })

        if (content) {
          return this.embedNode({
            id: node.id,
            type: node.type,
            content,
            metadata: {
              boardId,
              ...node.data,
            },
          })
        }
      })
    )

    return {
      success: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      errors: results
        .filter(r => r.status === 'rejected')
        .map((r: any) => r.reason),
    }
  }
}