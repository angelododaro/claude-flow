import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { getAIService } from '../services/ai'
import { TRPCError } from '@trpc/server'
import { NodeType } from '@ragboard/types'

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
})

export const aiRouter = router({
  chat: protectedProcedure
    .input(
      z.object({
        boardId: z.string(),
        nodeId: z.string(),
        messages: z.array(chatMessageSchema),
        options: z.object({
          model: z.string().optional(),
          temperature: z.number().min(0).max(2).optional(),
          maxTokens: z.number().min(1).max(4000).optional(),
          useRAG: z.boolean().optional().default(true),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify node ownership
      const node = await ctx.prisma.node.findUnique({
        where: { id: input.nodeId },
        include: {
          board: {
            select: { userId: true },
          },
        },
      })

      if (!node || node.board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // Get AI service
      const ai = await getAIService()

      // Generate response with RAG
      const result = await ai.answerWithContext(
        input.boardId,
        input.messages,
        input.options
      )

      // Update node with new message
      const updatedMessages = [
        ...((node.data as any).messages || []),
        ...input.messages.slice(-1), // Add the user's message
        {
          role: 'assistant',
          content: result.answer,
          timestamp: new Date(),
          sources: result.sources,
        },
      ]

      await ctx.prisma.node.update({
        where: { id: input.nodeId },
        data: {
          data: {
            ...(node.data as any),
            messages: updatedMessages,
          },
        },
      })

      return {
        answer: result.answer,
        sources: result.sources,
        context: result.context?.map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata,
        })),
      }
    }),

  search: protectedProcedure
    .input(
      z.object({
        boardId: z.string(),
        query: z.string(),
        limit: z.number().min(1).max(50).optional().default(10),
        nodeTypes: z.array(z.nativeEnum(NodeType)).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify board ownership
      const board = await ctx.prisma.board.findUnique({
        where: { id: input.boardId },
        select: { userId: true },
      })

      if (!board || board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // Get AI service
      const ai = await getAIService()

      // Search nodes
      const results = await ai.searchNodes(
        input.boardId,
        input.query,
        input.limit
      )

      // Filter by node types if specified
      const filteredResults = input.nodeTypes
        ? results.filter(r => 
            input.nodeTypes!.includes(r.document.metadata.nodeType as NodeType)
          )
        : results

      return filteredResults.map(result => ({
        nodeId: result.document.metadata.nodeId,
        nodeType: result.document.metadata.nodeType,
        content: result.document.pageContent,
        score: result.score,
        highlights: result.highlights,
      }))
    }),

  suggestConnections: protectedProcedure
    .input(
      z.object({
        nodeId: z.string(),
        boardId: z.string(),
        limit: z.number().min(1).max(10).optional().default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify node ownership
      const node = await ctx.prisma.node.findUnique({
        where: { id: input.nodeId },
        include: {
          board: {
            select: { userId: true },
          },
        },
      })

      if (!node || node.board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // Get AI service
      const ai = await getAIService()

      // Get suggestions
      const suggestions = await ai.suggestConnections(
        input.nodeId,
        input.boardId
      )

      // Enrich with node data
      const enrichedSuggestions = await Promise.all(
        suggestions.map(async (suggestion) => {
          const targetNode = await ctx.prisma.node.findUnique({
            where: { id: suggestion.nodeId },
            select: {
              id: true,
              type: true,
              data: true,
            },
          })

          return {
            ...suggestion,
            node: targetNode,
          }
        })
      )

      return enrichedSuggestions.filter(s => s.node !== null)
    }),

  generateInsights: protectedProcedure
    .input(z.object({ boardId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify board ownership
      const board = await ctx.prisma.board.findUnique({
        where: { id: input.boardId },
        select: { userId: true },
      })

      if (!board || board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // Get AI service
      const ai = await getAIService()

      // Generate insights
      return ai.generateInsights(input.boardId)
    }),

  indexNode: protectedProcedure
    .input(
      z.object({
        nodeId: z.string(),
        boardId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify node ownership
      const node = await ctx.prisma.node.findUnique({
        where: { id: input.nodeId },
        include: {
          board: {
            select: { userId: true },
          },
        },
      })

      if (!node || node.board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // Get AI service
      const ai = await getAIService()

      // Process and index node content
      const content = await ai.processNodeContent({
        id: node.id,
        type: node.type,
        data: node.data,
        boardId: input.boardId,
      })

      if (content) {
        await ai.embedNode({
          id: node.id,
          type: node.type,
          content,
          metadata: {
            boardId: input.boardId,
            ...(node.data as any),
          },
        })
      }

      return { indexed: true }
    }),

  indexBoard: protectedProcedure
    .input(z.object({ boardId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify board ownership
      const board = await ctx.prisma.board.findUnique({
        where: { id: input.boardId },
        select: { userId: true },
      })

      if (!board || board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // Get all nodes
      const nodes = await ctx.prisma.node.findMany({
        where: { boardId: input.boardId },
      })

      // Get AI service
      const ai = await getAIService()

      // Index all nodes
      const result = await ai.indexBoard(input.boardId, nodes)

      return result
    }),

  generateTitle: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        maxLength: z.number().min(10).max(100).optional().default(50),
      })
    )
    .mutation(async ({ input }) => {
      const ai = await getAIService()
      const title = await ai.generateTitle(input.content)
      return { title }
    }),

  summarize: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        maxLength: z.number().min(50).max(500).optional().default(200),
      })
    )
    .mutation(async ({ input }) => {
      const ai = await getAIService()
      const summary = await ai.summarize(input.content)
      return { summary }
    }),

  scrapeURL: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const ai = await getAIService()
      try {
        const result = await ai.extractTextFromURL(input.url)
        return {
          title: result.title,
          description: result.description || '',
          content: result.content,
          image: result.images?.[0],
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to scrape URL',
        })
      }
    }),

  extractPDF: protectedProcedure
    .input(z.object({ base64: z.string() }))
    .mutation(async ({ input }) => {
      const ai = await getAIService()
      try {
        // Convert base64 to buffer
        const base64Data = input.base64.split(',')[1] || input.base64
        const buffer = Buffer.from(base64Data, 'base64')
        
        const text = await ai.extractTextFromPDF(buffer)
        
        // Simple page count estimation (rough)
        const pageCount = Math.ceil(text.length / 3000)
        
        return {
          text: text.slice(0, 10000), // Limit text length
          pageCount,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to extract PDF text',
        })
      }
    }),
})