# Phase 1: Foundation Implementation Guide

## Overview
Phase 1 establishes the core foundation: authentication, database, board CRUD operations, and Excalidraw integration.

## Module Structure

```
ragboard/
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── signup/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── boards/
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   └── AuthGuard.tsx
│   │   ├── board/
│   │   │   ├── BoardList.tsx
│   │   │   ├── BoardCard.tsx
│   │   │   └── CreateBoardModal.tsx
│   │   └── canvas/
│   │       ├── ExcalidrawWrapper.tsx
│   │       └── CanvasToolbar.tsx
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── supabase.ts
│   │   │   └── context.tsx
│   │   └── trpc/
│   │       ├── client.ts
│   │       └── provider.tsx
│   └── store/
│       └── authStore.ts
│
└── backend/
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/
    ├── src/
    │   ├── server.ts
    │   ├── context.ts
    │   ├── routers/
    │   │   ├── index.ts
    │   │   ├── auth.ts
    │   │   └── board.ts
    │   └── services/
    │       └── board.service.ts
    └── package.json
```

## Step-by-Step Implementation

### Step 1: Project Initialization

```bash
# Create monorepo structure
mkdir ragboard && cd ragboard
pnpm init

# Create workspace configuration
cat > pnpm-workspace.yaml << EOF
packages:
  - 'frontend'
  - 'backend'
  - 'packages/*'
EOF

# Initialize frontend (Next.js)
pnpm create next-app@latest frontend --typescript --tailwind --app
cd frontend
pnpm add @supabase/supabase-js @trpc/client @trpc/react-query @tanstack/react-query zustand
pnpm add -D @types/node

# Initialize backend
cd ../
mkdir backend && cd backend
pnpm init
pnpm add @trpc/server @prisma/client express cors zod superjson
pnpm add -D @types/node @types/express prisma tsx nodemon
```

### Step 2: Database Setup

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  avatarUrl     String?
  supabaseId    String    @unique
  
  boards        Board[]
  collaborators BoardCollaborator[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Board {
  id            String    @id @default(uuid())
  title         String
  description   String?
  thumbnail     String?
  isPublic      Boolean   @default(false)
  
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  elements      Json      @default("[]")
  appState      Json      @default("{}")
  
  collaborators BoardCollaborator[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([userId])
}

model BoardCollaborator {
  id        String   @id @default(uuid())
  
  boardId   String
  board     Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)
  
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  role      BoardRole @default(VIEWER)
  
  createdAt DateTime @default(now())
  
  @@unique([boardId, userId])
  @@index([userId])
}

enum BoardRole {
  VIEWER
  EDITOR
  OWNER
}
```

### Step 3: Supabase Authentication Setup

```typescript
// frontend/lib/auth/supabase.ts
import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

// Helper functions
export async function signUp(email: string, password: string, name?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  })
  
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}
```

```typescript
// frontend/lib/auth/context.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const value = {
    user,
    loading,
    signIn: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push('/boards')
    },
    signUp: async (email: string, password: string, name?: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      })
      if (error) throw error
      router.push('/boards')
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/login')
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

### Step 4: tRPC Setup

```typescript
// backend/src/context.ts
import { PrismaClient } from '@prisma/client'
import { inferAsyncReturnType } from '@trpc/server'
import { CreateExpressContextOptions } from '@trpc/server/adapters/express'

const prisma = new PrismaClient()

export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Get the user from the Supabase JWT
  const token = req.headers.authorization?.replace('Bearer ', '')
  let userId: string | null = null

  if (token) {
    try {
      // Verify Supabase JWT and extract user ID
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data.user) {
        // Find or create user in our database
        const user = await prisma.user.upsert({
          where: { supabaseId: data.user.id },
          update: {},
          create: {
            supabaseId: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.name,
          },
        })
        userId = user.id
      }
    } catch (error) {
      console.error('Auth error:', error)
    }
  }

  return {
    req,
    res,
    prisma,
    userId,
  }
}

export type Context = inferAsyncReturnType<typeof createContext>
```

```typescript
// backend/src/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { Context } from './context'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure

// Middleware to check if user is authenticated
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      userId: ctx.userId,
    },
  })
})

export const protectedProcedure = t.procedure.use(isAuthed)
```

```typescript
// backend/src/routers/board.ts
import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

export const boardRouter = router({
  // Create a new board
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const board = await ctx.prisma.board.create({
        data: {
          title: input.title,
          description: input.description,
          userId: ctx.userId,
        },
      })
      
      return board
    }),

  // List user's boards
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const boards = await ctx.prisma.board.findMany({
        where: {
          OR: [
            { userId: ctx.userId },
            {
              collaborators: {
                some: { userId: ctx.userId },
              },
            },
          ],
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              collaborators: true,
            },
          },
        },
      })

      let nextCursor: typeof input.cursor | undefined = undefined
      if (boards.length > input.limit) {
        const nextItem = boards.pop()
        nextCursor = nextItem!.id
      }

      return {
        items: boards,
        nextCursor,
      }
    }),

  // Get a single board
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const board = await ctx.prisma.board.findFirst({
        where: {
          id: input.id,
          OR: [
            { userId: ctx.userId },
            {
              collaborators: {
                some: { userId: ctx.userId },
              },
            },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          collaborators: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      })

      if (!board) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Board not found',
        })
      }

      return board
    }),

  // Update board content
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        elements: z.any().optional(),
        appState: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check permissions
      const board = await ctx.prisma.board.findFirst({
        where: {
          id: input.id,
          OR: [
            { userId: ctx.userId },
            {
              collaborators: {
                some: {
                  userId: ctx.userId,
                  role: { in: ['EDITOR', 'OWNER'] },
                },
              },
            },
          ],
        },
      })

      if (!board) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to edit this board',
        })
      }

      const updated = await ctx.prisma.board.update({
        where: { id: input.id },
        data: {
          title: input.title,
          description: input.description,
          elements: input.elements,
          appState: input.appState,
        },
      })

      return updated
    }),

  // Delete a board
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Only owner can delete
      const board = await ctx.prisma.board.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
      })

      if (!board) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this board',
        })
      }

      await ctx.prisma.board.delete({
        where: { id: input.id },
      })

      return { success: true }
    }),
})
```

### Step 5: Frontend Components

```typescript
// frontend/components/auth/LoginForm.tsx
'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signIn(email, password)
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  )
}
```

```typescript
// frontend/components/board/BoardList.tsx
'use client'

import { trpc } from '@/lib/trpc/client'
import { BoardCard } from './BoardCard'
import { CreateBoardModal } from './CreateBoardModal'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export function BoardList() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = 
    trpc.board.list.useInfiniteQuery(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    )

  const boards = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Boards</h1>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Board
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {boards.map((board) => (
          <BoardCard key={board.id} board={board} />
        ))}
      </div>

      {hasNextPage && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}

      <CreateBoardModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  )
}
```

```typescript
// frontend/components/canvas/ExcalidrawWrapper.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import { ExcalidrawElement, AppState } from '@excalidraw/excalidraw/types/types'
import { trpc } from '@/lib/trpc/client'
import { useDebounce } from '@/hooks/useDebounce'

interface ExcalidrawWrapperProps {
  boardId: string
  initialElements?: ExcalidrawElement[]
  initialAppState?: Partial<AppState>
}

export function ExcalidrawWrapper({
  boardId,
  initialElements = [],
  initialAppState = {},
}: ExcalidrawWrapperProps) {
  const [elements, setElements] = useState<ExcalidrawElement[]>(initialElements)
  const [appState, setAppState] = useState<Partial<AppState>>(initialAppState)
  const debouncedElements = useDebounce(elements, 1000)
  const debouncedAppState = useDebounce(appState, 1000)
  
  const updateBoard = trpc.board.update.useMutation()
  const excalidrawRef = useRef<any>(null)

  // Auto-save
  useEffect(() => {
    if (debouncedElements.length > 0 || Object.keys(debouncedAppState).length > 0) {
      updateBoard.mutate({
        id: boardId,
        elements: debouncedElements,
        appState: debouncedAppState,
      })
    }
  }, [debouncedElements, debouncedAppState, boardId])

  return (
    <div className="h-screen w-full">
      <Excalidraw
        ref={excalidrawRef}
        initialData={{
          elements: initialElements,
          appState: initialAppState,
        }}
        onChange={(elements, appState) => {
          setElements(elements)
          setAppState(appState)
        }}
        UIOptions={{
          canvasActions: {
            export: {
              saveAsImage: true,
              saveAsJSON: true,
            },
          },
        }}
      />
    </div>
  )
}
```

### Step 6: Board Page Implementation

```typescript
// frontend/app/boards/[id]/page.tsx
'use client'

import { useParams } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { ExcalidrawWrapper } from '@/components/canvas/ExcalidrawWrapper'
import { Skeleton } from '@/components/ui/skeleton'

export default function BoardPage() {
  const params = useParams()
  const boardId = params.id as string
  
  const { data: board, isLoading } = trpc.board.get.useQuery({ id: boardId })

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Skeleton className="w-full h-full" />
      </div>
    )
  }

  if (!board) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <p>Board not found</p>
      </div>
    )
  }

  return (
    <div className="h-screen w-full">
      <ExcalidrawWrapper
        boardId={board.id}
        initialElements={board.elements as any}
        initialAppState={board.appState as any}
      />
    </div>
  )
}
```

### Step 7: Environment Configuration

```bash
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:4000/trpc

# backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/ragboard
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
PORT=4000
```

### Step 8: Database Migrations

```bash
# Run from backend directory
npx prisma migrate dev --name init
npx prisma generate
```

### Step 9: Start Scripts

```json
// backend/package.json
{
  "scripts": {
    "dev": "nodemon --exec tsx src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate"
  }
}

// frontend/package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}

// Root package.json
{
  "scripts": {
    "dev": "pnpm run --parallel dev",
    "build": "pnpm run --recursive build",
    "start": "pnpm run --parallel start"
  }
}
```

## Testing Phase 1

### Unit Tests
```typescript
// frontend/__tests__/components/BoardList.test.tsx
import { render, screen } from '@testing-library/react'
import { BoardList } from '@/components/board/BoardList'
import { trpc } from '@/lib/trpc/client'

jest.mock('@/lib/trpc/client')

describe('BoardList', () => {
  it('renders board list', async () => {
    const mockBoards = [
      { id: '1', title: 'Board 1', createdAt: new Date() },
      { id: '2', title: 'Board 2', createdAt: new Date() },
    ]

    ;(trpc.board.list.useInfiniteQuery as jest.Mock).mockReturnValue({
      data: { pages: [{ items: mockBoards, nextCursor: null }] },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })

    render(<BoardList />)
    
    expect(screen.getByText('Board 1')).toBeInTheDocument()
    expect(screen.getByText('Board 2')).toBeInTheDocument()
  })
})
```

### Integration Tests
```typescript
// backend/__tests__/routers/board.test.ts
import { createContext } from '../helpers/context'
import { appRouter } from '../../src/routers'

describe('Board Router', () => {
  it('creates a new board', async () => {
    const ctx = await createContext({ userId: 'test-user' })
    const caller = appRouter.createCaller(ctx)

    const board = await caller.board.create({
      title: 'Test Board',
      description: 'Test Description',
    })

    expect(board.title).toBe('Test Board')
    expect(board.userId).toBe('test-user')
  })
})
```

## Phase 1 Completion Checklist

- [ ] Supabase project created and configured
- [ ] Database schema created and migrated
- [ ] Authentication flow working (login/signup)
- [ ] Protected routes implemented
- [ ] Board CRUD operations functional
- [ ] Excalidraw canvas integrated
- [ ] Auto-save functionality working
- [ ] Basic UI components styled
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Basic tests written
- [ ] Environment variables configured
- [ ] Development server running smoothly

## Common Issues & Solutions

### Issue: CORS errors
```typescript
// backend/src/server.ts
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
```

### Issue: Prisma client not generated
```bash
npx prisma generate
```

### Issue: Supabase auth not persisting
```typescript
// Ensure session persistence
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
```

## Next Steps
Once Phase 1 is complete and tested, proceed to Phase 2: Card System & Canvas Polish.