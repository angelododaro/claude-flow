import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const boardRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // First, ensure user exists in our database
    const dbUser = await ctx.prisma.user.upsert({
      where: { email: ctx.user.email! },
      update: {},
      create: {
        id: ctx.user.id,
        email: ctx.user.email!,
        name: ctx.user.user_metadata?.name,
        avatarUrl: ctx.user.user_metadata?.avatar_url,
      },
    })

    return ctx.prisma.board.findMany({
      where: { userId: dbUser.id },
      orderBy: { updatedAt: 'desc' },
    })
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const board = await ctx.prisma.board.findUnique({
        where: { id: input.id },
        include: { 
          nodes: true,
          user: true,
        },
      })

      if (!board || board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return board
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure user exists
      const dbUser = await ctx.prisma.user.upsert({
        where: { email: ctx.user.email! },
        update: {},
        create: {
          id: ctx.user.id,
          email: ctx.user.email!,
          name: ctx.user.user_metadata?.name,
          avatarUrl: ctx.user.user_metadata?.avatar_url,
        },
      })

      return ctx.prisma.board.create({
        data: {
          ...input,
          userId: dbUser.id,
        },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        data: z.any().optional(), // Excalidraw data
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      return ctx.prisma.board.update({
        where: {
          id,
          userId: ctx.user.id, // Ensure user owns the board
        },
        data,
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.board.delete({
        where: {
          id: input.id,
          userId: ctx.user.id,
        },
      })
    }),
})