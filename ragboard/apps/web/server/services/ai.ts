import { AIService } from '@ragboard/ai'

// Create a singleton instance
let aiService: AIService | null = null

export async function getAIService(): Promise<AIService> {
  if (!aiService) {
    aiService = new AIService({
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      },
      vectorStore: {
        provider: 'chromadb',
        config: {
          url: process.env.CHROMADB_URL || 'http://localhost:8000',
        },
      },
    })

    // Initialize the service
    try {
      await aiService.initialize()
    } catch (error) {
      console.error('Failed to initialize AI service:', error)
      console.log('Make sure ChromaDB is running with: docker-compose up chromadb')
    }
  }

  return aiService
}