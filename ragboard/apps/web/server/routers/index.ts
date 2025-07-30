import { router } from '../trpc'
import { boardRouter } from './board'
import { nodeRouter } from './node'
import { connectionRouter } from './connection'
import { aiRouter } from './ai'

export const appRouter = router({
  board: boardRouter,
  node: nodeRouter,
  connection: connectionRouter,
  ai: aiRouter,
})

export type AppRouter = typeof appRouter