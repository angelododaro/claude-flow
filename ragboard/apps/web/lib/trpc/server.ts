import { httpBatchLink } from '@trpc/client'
import { createTRPCProxyClient } from '@trpc/client'
import { headers } from 'next/headers'
import superjson from 'superjson'
import { type AppRouter } from '@/server/routers'

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export const api = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      headers() {
        const heads = new Map(headers())
        heads.set('x-trpc-source', 'rsc')
        return Object.fromEntries(heads)
      },
    }),
  ],
})