import { VectorStoreService } from './vector-store'
import { ChatService } from './chat'
import type { ChatMessage, ChatOptions, RAGContext } from '../types'
import { Document } from '@langchain/core/documents'

export class RAGService {
  constructor(
    private vectorStore: VectorStoreService,
    private chatService: ChatService
  ) {}

  async answerWithContext(
    boardId: string,
    messages: ChatMessage[],
    options: ChatOptions & { 
      useRAG?: boolean
      maxContextDocs?: number
      contextThreshold?: number 
    } = {}
  ): Promise<{
    answer: string
    context?: Document[]
    sources?: string[]
  }> {
    // If RAG is disabled, just use regular chat
    if (options.useRAG === false) {
      const answer = await this.chatService.chat(messages, options)
      return { answer }
    }

    // Extract the last user message as the query
    const lastUserMessage = messages.findLast(m => m.role === 'user')
    if (!lastUserMessage) {
      throw new Error('No user message found')
    }

    // Search for relevant context
    const searchResults = await this.vectorStore.searchNodes(
      boardId,
      lastUserMessage.content,
      options.maxContextDocs || 5,
      options.contextThreshold ? {
        score: { $lte: options.contextThreshold }
      } : undefined
    )

    const contextDocs = searchResults.map(r => r.document)
    
    // Generate answer with context
    const answer = await this.chatService.chatWithRAG(
      messages,
      contextDocs,
      options
    )

    // Extract sources
    const sources = contextDocs
      .map(doc => doc.metadata.nodeId)
      .filter((id, index, self) => self.indexOf(id) === index)

    return {
      answer,
      context: contextDocs,
      sources,
    }
  }

  async generateNodeSummary(
    nodeId: string,
    boardId: string,
    content: string
  ): Promise<string> {
    // Find similar nodes for context
    const similarNodes = await this.vectorStore.getSimilarNodes(
      nodeId,
      boardId,
      3
    )

    const context = similarNodes.map(r => r.document)
    
    // Generate summary with context
    const messages: ChatMessage[] = [{
      role: 'user',
      content: `Summarize this content, considering its relationship to similar nodes: ${content}`,
    }]

    const summary = await this.chatService.chat(messages, {
      context,
      systemPrompt: 'Generate a concise summary that highlights connections to related content.',
      maxTokens: 150,
    })

    return summary
  }

  async suggestConnections(
    nodeId: string,
    boardId: string,
    limit: number = 5
  ): Promise<Array<{
    nodeId: string
    reason: string
    score: number
  }>> {
    // Get similar nodes
    const similarNodes = await this.vectorStore.getSimilarNodes(
      nodeId,
      boardId,
      limit
    )

    if (similarNodes.length === 0) {
      return []
    }

    // Get the current node's content
    const results = await this.vectorStore.searchNodes(boardId, '', 1, {
      nodeId: { $eq: nodeId }
    })
    
    if (results.length === 0) {
      return []
    }

    const currentNodeContent = results[0].document.pageContent

    // Generate connection reasons
    const suggestions = await Promise.all(
      similarNodes.map(async (node) => {
        const prompt = `Explain in one sentence why these two pieces of content are related:
        
Content 1: ${currentNodeContent.slice(0, 200)}...
Content 2: ${node.document.pageContent.slice(0, 200)}...`

        const reason = await this.chatService.chat([{
          role: 'user',
          content: prompt,
        }], {
          maxTokens: 50,
          temperature: 0.3,
        })

        return {
          nodeId: node.document.metadata.nodeId as string,
          reason: reason.trim(),
          score: node.score,
        }
      })
    )

    return suggestions
  }

  async generateInsights(boardId: string): Promise<{
    summary: string
    themes: string[]
    suggestions: string[]
  }> {
    // Get all nodes from the board
    const allNodes = await this.vectorStore.searchNodes(boardId, '', 50)
    
    if (allNodes.length === 0) {
      return {
        summary: 'No content available yet.',
        themes: [],
        suggestions: [],
      }
    }

    // Prepare content for analysis
    const contents = allNodes
      .map(n => n.document.pageContent)
      .join('\n\n---\n\n')
      .slice(0, 4000) // Limit to avoid token limits

    // Generate insights
    const insightsPrompt = `Analyze this collection of related content and provide:
1. A brief summary of the overall topic/project
2. 3-5 key themes or patterns
3. 2-3 suggestions for what to explore next

Content:
${contents}`

    const response = await this.chatService.chat([{
      role: 'user',
      content: insightsPrompt,
    }], {
      systemPrompt: 'You are an expert analyst. Provide clear, actionable insights.',
      temperature: 0.7,
    })

    // Parse the response (this is simplified, could use structured output)
    const lines = response.split('\n')
    const summary = lines[0] || 'No summary available'
    const themes = lines
      .filter(l => l.includes('-') || l.includes('•'))
      .map(l => l.replace(/^[-•*]\s*/, '').trim())
      .slice(0, 5)
    const suggestions = lines
      .slice(-3)
      .filter(l => l.trim().length > 10)
      .map(l => l.trim())

    return {
      summary,
      themes: themes.length > 0 ? themes : ['No clear themes identified yet'],
      suggestions: suggestions.length > 0 ? suggestions : ['Add more content to generate insights'],
    }
  }
}