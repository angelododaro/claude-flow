import { ChromaClient, Collection } from 'chromadb'
import { OpenAIEmbeddings } from '@langchain/openai'
import { Document } from '@langchain/core/documents'
import type { EmbeddingResult, SearchResult, NodeEmbedding } from '../types'

export class VectorStoreService {
  private client: ChromaClient
  private embeddings: OpenAIEmbeddings
  private collections: Map<string, Collection> = new Map()

  constructor(
    chromaUrl: string = 'http://localhost:8000',
    openaiApiKey?: string
  ) {
    this.client = new ChromaClient({ path: chromaUrl })
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: openaiApiKey || process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    })
  }

  async initialize() {
    // Ensure ChromaDB is running
    try {
      await this.client.heartbeat()
    } catch (error) {
      throw new Error('ChromaDB is not running. Please start it with: docker-compose up chromadb')
    }
  }

  async getOrCreateCollection(name: string, metadata?: Record<string, any>) {
    if (this.collections.has(name)) {
      return this.collections.get(name)!
    }

    try {
      const collection = await this.client.getOrCreateCollection({
        name,
        metadata,
      })
      this.collections.set(name, collection)
      return collection
    } catch (error) {
      console.error('Error creating collection:', error)
      throw error
    }
  }

  async embedNode(node: {
    id: string
    type: string
    content: string
    metadata?: Record<string, any>
  }): Promise<NodeEmbedding> {
    const embedding = await this.embeddings.embedQuery(node.content)
    
    const nodeEmbedding: NodeEmbedding = {
      nodeId: node.id,
      nodeType: node.type,
      content: node.content,
      embedding,
      metadata: node.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Store in the board's collection
    const boardId = node.metadata?.boardId
    if (boardId) {
      const collection = await this.getOrCreateCollection(`board_${boardId}`)
      await collection.add({
        ids: [node.id],
        embeddings: [embedding],
        documents: [node.content],
        metadatas: [{
          nodeId: node.id,
          nodeType: node.type,
          ...node.metadata,
        }],
      })
    }

    return nodeEmbedding
  }

  async searchNodes(
    boardId: string,
    query: string,
    limit: number = 10,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    const collection = await this.getOrCreateCollection(`board_${boardId}`)
    const queryEmbedding = await this.embeddings.embedQuery(query)

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      where: filter,
    })

    const searchResults: SearchResult[] = []
    
    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const doc = new Document({
          pageContent: results.documents?.[0]?.[i] || '',
          metadata: results.metadatas?.[0]?.[i] || {},
        })

        searchResults.push({
          document: doc,
          score: results.distances?.[0]?.[i] || 0,
        })
      }
    }

    return searchResults
  }

  async updateNodeEmbedding(
    nodeId: string,
    boardId: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const collection = await this.getOrCreateCollection(`board_${boardId}`)
    const embedding = await this.embeddings.embedQuery(content)

    await collection.update({
      ids: [nodeId],
      embeddings: [embedding],
      documents: [content],
      metadatas: [{ ...metadata, updatedAt: new Date().toISOString() }],
    })
  }

  async deleteNodeEmbedding(nodeId: string, boardId: string): Promise<void> {
    const collection = await this.getOrCreateCollection(`board_${boardId}`)
    await collection.delete({ ids: [nodeId] })
  }

  async deleteBoard(boardId: string): Promise<void> {
    try {
      await this.client.deleteCollection({ name: `board_${boardId}` })
      this.collections.delete(`board_${boardId}`)
    } catch (error) {
      console.error('Error deleting board collection:', error)
    }
  }

  async getSimilarNodes(
    nodeId: string,
    boardId: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    const collection = await this.getOrCreateCollection(`board_${boardId}`)
    
    // Get the node's content first
    const nodeData = await collection.get({
      ids: [nodeId],
    })

    if (!nodeData.documents?.[0]) {
      return []
    }

    // Search for similar nodes
    return this.searchNodes(
      boardId,
      nodeData.documents[0] as string,
      limit + 1, // Include self
    ).then(results => 
      results.filter(r => r.document.metadata.nodeId !== nodeId).slice(0, limit)
    )
  }
}