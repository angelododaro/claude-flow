import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

const connectionDataSchema = z.object({
  label: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
  color: z.string().optional(),
  animated: z.boolean().optional(),
})

export const connectionRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        fromNodeId: z.string(),
        toNodeId: z.string(),
        fromPort: z.string(),
        toPort: z.string(),
        data: connectionDataSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify both nodes exist and user owns them through board
      const nodes = await ctx.prisma.node.findMany({
        where: {
          id: { in: [input.fromNodeId, input.toNodeId] },
        },
        include: {
          board: {
            select: { userId: true },
          },
        },
      })

      if (
        nodes.length !== 2 ||
        !nodes.every((n) => n.board.userId === ctx.user.id)
      ) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      // Check if connection already exists
      const existingConnection = await ctx.prisma.connection.findUnique({
        where: {
          fromNodeId_toNodeId_fromPort_toPort: {
            fromNodeId: input.fromNodeId,
            toNodeId: input.toNodeId,
            fromPort: input.fromPort,
            toPort: input.toPort,
          },
        },
      })

      if (existingConnection) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Connection already exists',
        })
      }

      return ctx.prisma.connection.create({
        data: {
          fromNodeId: input.fromNodeId,
          toNodeId: input.toNodeId,
          fromPort: input.fromPort,
          toPort: input.toPort,
          data: input.data || {},
        },
        include: {
          fromNode: true,
          toNode: true,
        },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        data: connectionDataSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through nodes
      const connection = await ctx.prisma.connection.findUnique({
        where: { id: input.id },
        include: {
          fromNode: {
            include: {
              board: {
                select: { userId: true },
              },
            },
          },
        },
      })

      if (!connection || connection.fromNode.board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return ctx.prisma.connection.update({
        where: { id: input.id },
        data: { data: input.data },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through nodes
      const connection = await ctx.prisma.connection.findUnique({
        where: { id: input.id },
        include: {
          fromNode: {
            include: {
              board: {
                select: { userId: true },
              },
            },
          },
        },
      })

      if (!connection || connection.fromNode.board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return ctx.prisma.connection.delete({
        where: { id: input.id },
      })
    }),

  deleteByNodes: protectedProcedure
    .input(
      z.object({
        fromNodeId: z.string(),
        toNodeId: z.string(),
        fromPort: z.string(),
        toPort: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through nodes
      const connection = await ctx.prisma.connection.findUnique({
        where: {
          fromNodeId_toNodeId_fromPort_toPort: {
            fromNodeId: input.fromNodeId,
            toNodeId: input.toNodeId,
            fromPort: input.fromPort,
            toPort: input.toPort,
          },
        },
        include: {
          fromNode: {
            include: {
              board: {
                select: { userId: true },
              },
            },
          },
        },
      })

      if (!connection || connection.fromNode.board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return ctx.prisma.connection.delete({
        where: {
          fromNodeId_toNodeId_fromPort_toPort: {
            fromNodeId: input.fromNodeId,
            toNodeId: input.toNodeId,
            fromPort: input.fromPort,
            toPort: input.toPort,
          },
        },
      })
    }),
})