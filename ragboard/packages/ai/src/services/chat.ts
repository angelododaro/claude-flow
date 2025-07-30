import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { 
  SystemMessage, 
  HumanMessage, 
  AIMessage,
  BaseMessage 
} from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { Document } from '@langchain/core/documents'
import type { ChatMessage, ChatOptions } from '../types'

export class ChatService {
  private openaiChat?: ChatOpenAI
  private anthropicChat?: ChatAnthropic
  private defaultModel: 'openai' | 'anthropic' = 'openai'

  constructor(config?: {
    openaiApiKey?: string
    anthropicApiKey?: string
    defaultModel?: 'openai' | 'anthropic'
  }) {
    if (config?.openaiApiKey || process.env.OPENAI_API_KEY) {
      this.openaiChat = new ChatOpenAI({
        openAIApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
        modelName: 'gpt-4-turbo-preview',
        temperature: 0.7,
      })
    }

    if (config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY) {
      this.anthropicChat = new ChatAnthropic({
        anthropicApiKey: config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
        modelName: 'claude-3-sonnet-20240229',
        temperature: 0.7,
      })
    }

    if (config?.defaultModel) {
      this.defaultModel = config.defaultModel
    }
  }

  private getChat(model?: string) {
    if (model?.startsWith('claude') && this.anthropicChat) {
      return this.anthropicChat
    }
    if (model?.startsWith('gpt') && this.openaiChat) {
      return this.openaiChat
    }
    
    // Use default
    if (this.defaultModel === 'anthropic' && this.anthropicChat) {
      return this.anthropicChat
    }
    if (this.openaiChat) {
      return this.openaiChat
    }
    
    throw new Error('No chat model configured. Please provide an API key.')
  }

  private formatContext(documents: Document[]): string {
    if (documents.length === 0) return ''
    
    return `\n\nContext from related nodes:\n${documents
      .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
      .join('\n\n')}`
  }

  private messagesToLangChain(messages: ChatMessage[]): BaseMessage[] {
    return messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content)
        case 'user':
          return new HumanMessage(msg.content)
        case 'assistant':
          return new AIMessage(msg.content)
        default:
          throw new Error(`Unknown message role: ${msg.role}`)
      }
    })
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<string> {
    const chat = this.getChat(options.model)
    
    // Update model settings if provided
    if (options.temperature !== undefined) {
      chat.temperature = options.temperature
    }
    if (options.maxTokens !== undefined) {
      chat.maxTokens = options.maxTokens
    }

    // Build message list
    const langchainMessages: BaseMessage[] = []
    
    // Add system prompt if provided
    if (options.systemPrompt) {
      langchainMessages.push(new SystemMessage(options.systemPrompt))
    }

    // Add context if provided
    if (options.context && options.context.length > 0) {
      const contextStr = this.formatContext(options.context)
      langchainMessages.push(new SystemMessage(contextStr))
    }

    // Add conversation messages
    langchainMessages.push(...this.messagesToLangChain(messages))

    // Generate response
    const response = await chat.pipe(new StringOutputParser()).invoke(langchainMessages)
    
    return response
  }

  async chatWithRAG(
    messages: ChatMessage[],
    searchResults: Document[],
    options: ChatOptions = {}
  ): Promise<string> {
    // Use search results as context
    return this.chat(messages, {
      ...options,
      context: searchResults,
      systemPrompt: options.systemPrompt || 
        'You are a helpful AI assistant. Use the provided context to answer questions accurately. If the context doesn\'t contain relevant information, say so.',
    })
  }

  async generateTitle(content: string, maxLength: number = 50): Promise<string> {
    const chat = this.getChat()
    const prompt = `Generate a concise title (max ${maxLength} characters) for the following content. Return only the title, no quotes or extra text:\n\n${content.slice(0, 500)}`
    
    const title = await chat
      .pipe(new StringOutputParser())
      .invoke([new HumanMessage(prompt)])
    
    return title.slice(0, maxLength).trim()
  }

  async summarize(content: string, maxLength: number = 200): Promise<string> {
    const chat = this.getChat()
    const prompt = `Summarize the following content in ${maxLength} characters or less. Be concise and capture the key points:\n\n${content}`
    
    const summary = await chat
      .pipe(new StringOutputParser())
      .invoke([new HumanMessage(prompt)])
    
    return summary.slice(0, maxLength).trim()
  }

  async extractKeywords(content: string, count: number = 5): Promise<string[]> {
    const chat = this.getChat()
    const prompt = `Extract ${count} key terms or phrases from the following content. Return them as a comma-separated list:\n\n${content}`
    
    const response = await chat
      .pipe(new StringOutputParser())
      .invoke([new HumanMessage(prompt)])
    
    return response
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .slice(0, count)
  }
}