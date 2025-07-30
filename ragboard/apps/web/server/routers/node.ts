import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { NodeType } from '@ragboard/types'
import { getAIService } from '../services/ai'

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

const sizeSchema = z.object({
  width: z.number(),
  height: z.number(),
})

const nodeDataSchema = z.record(z.any())

export const nodeRouter = router({
  list: protectedProcedure
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

      return ctx.prisma.node.findMany({
        where: { boardId: input.boardId },
        include: {
          fromConnections: {
            include: {
              toNode: true,
            },
          },
          toConnections: {
            include: {
              fromNode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const node = await ctx.prisma.node.findUnique({
        where: { id: input.id },
        include: {
          board: {
            select: { userId: true },
          },
          fromConnections: {
            include: {
              toNode: true,
            },
          },
          toConnections: {
            include: {
              fromNode: true,
            },
          },
        },
      })

      if (!node || node.board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return node
    }),

  create: protectedProcedure
    .input(
      z.object({
        boardId: z.string(),
        type: z.nativeEnum(NodeType),
        position: positionSchema,
        size: sizeSchema,
        data: nodeDataSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify board ownership
      const board = await ctx.prisma.board.findUnique({
        where: { id: input.boardId },
        select: { userId: true },
      })

      if (!board || board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const node = await ctx.prisma.node.create({
        data: {
          type: input.type,
          position: input.position,
          size: input.size,
          data: input.data,
          boardId: input.boardId,
        },
      })

      // Index the node for search
      try {
        const ai = await getAIService()
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
      } catch (error) {
        console.error('Failed to index node:', error)
        // Don't fail the creation if indexing fails
      }

      return node
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        position: positionSchema.optional(),
        size: sizeSchema.optional(),
        data: nodeDataSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      // Verify ownership through board
      const node = await ctx.prisma.node.findUnique({
        where: { id },
        include: {
          board: {
            select: { userId: true },
          },
        },
      })

      if (!node || node.board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const updatedNode = await ctx.prisma.node.update({
        where: { id },
        data,
      })

      // Re-index the node if data changed
      if (data.data) {
        try {
          const ai = await getAIService()
          const content = await ai.processNodeContent({
            id: updatedNode.id,
            type: updatedNode.type,
            data: updatedNode.data,
            boardId: node.boardId,
          })

          if (content) {
            await ai.updateNodeEmbedding(
              updatedNode.id,
              node.boardId,
              content,
              updatedNode.data as any
            )
          }
        } catch (error) {
          console.error('Failed to re-index node:', error)
        }
      }

      return updatedNode
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through board
      const node = await ctx.prisma.node.findUnique({
        where: { id: input.id },
        include: {
          board: {
            select: { userId: true },
          },
        },
      })

      if (!node || node.board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      const deletedNode = await ctx.prisma.node.delete({
        where: { id: input.id },
      })

      // Remove from vector store
      try {
        const ai = await getAIService()
        await ai.deleteNodeEmbedding(input.id, node.boardId)
      } catch (error) {
        console.error('Failed to remove node from index:', error)
      }

      return deletedNode
    }),

  // Batch operations for performance
  createMany: protectedProcedure
    .input(
      z.object({
        boardId: z.string(),
        nodes: z.array(
          z.object({
            type: z.nativeEnum(NodeType),
            position: positionSchema,
            size: sizeSchema,
            data: nodeDataSchema,
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify board ownership
      const board = await ctx.prisma.board.findUnique({
        where: { id: input.boardId },
        select: { userId: true },
      })

      if (!board || board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return ctx.prisma.node.createMany({
        data: input.nodes.map((node) => ({
          ...node,
          boardId: input.boardId,
        })),
      })
    }),

  updateMany: protectedProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            id: z.string(),
            position: positionSchema.optional(),
            size: sizeSchema.optional(),
            data: nodeDataSchema.optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Batch verify ownership
      const nodeIds = input.updates.map((u) => u.id)
      const nodes = await ctx.prisma.node.findMany({
        where: { id: { in: nodeIds } },
        include: {
          board: {
            select: { userId: true },
          },
        },
      })

      const userNodes = nodes.filter((n) => n.board.userId === ctx.user.id)
      if (userNodes.length !== nodeIds.length) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // Execute updates in transaction
      return ctx.prisma.$transaction(
        input.updates.map((update) => {
          const { id, ...data } = update
          return ctx.prisma.node.update({
            where: { id },
            data,
          })
        })
      )
    }),
})