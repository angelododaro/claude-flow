export interface AIConfig {
  openai?: {
    apiKey: string
    organization?: string
    baseURL?: string
  }
  anthropic?: {
    apiKey: string
  }
  embeddings: {
    provider: 'openai' | 'cohere' | 'huggingface'
    model?: string
    apiKey?: string
  }
  vectorStore: {
    provider: 'chromadb' | 'pinecone' | 'weaviate'
    config: Record<string, any>
  }
}

export const defaultConfig: Partial<AIConfig> = {
  embeddings: {
    provider: 'openai',
    model: 'text-embedding-3-small',
  },
  vectorStore: {
    provider: 'chromadb',
    config: {
      url: process.env.CHROMADB_URL || 'http://localhost:8000',
    },
  },
}