# Phase 1: Foundation - Detailed Implementation Guide

## Overview

Phase 1 establishes the core infrastructure for RAGBOARD, including project setup, authentication, database schema, basic board CRUD operations, and Excalidraw integration.

**Duration**: 2-3 weeks  
**Team**: 1-2 developers  
**Deliverables**: Working board creation/management with canvas

---

## Week 1: Project Setup & Infrastructure

### Day 1-2: Initial Setup

#### 1. Create Monorepo Structure

```bash
# Create project
mkdir ragboard && cd ragboard
pnpm init

# Setup monorepo
cat > pnpm-workspace.yaml << EOF
packages:
  - 'apps/*'
  - 'packages/*'
EOF

# Create app directories
mkdir -p apps/web apps/api
mkdir -p packages/ui packages/types packages/canvas
```

#### 2. Initialize Next.js App

```bash
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --app --src-dir=false

# Install additional dependencies
pnpm add @supabase/supabase-js @supabase/auth-helpers-nextjs
pnpm add @trpc/client @trpc/server @trpc/react-query @trpc/next
pnpm add @tanstack/react-query
pnpm add zustand
pnpm add -D @types/node
```

#### 3. Setup Shared Packages

```typescript
// packages/types/index.ts
export interface User {
  id: string
  email: string
  name?: string
  avatarUrl?: string
}

export interface Board {
  id: string
  name: string
  description?: string
  thumbnail?: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}
```

### Day 3-4: Database & Authentication

#### 1. Setup Prisma

```bash
cd apps/web
pnpm add -D prisma
pnpm add @prisma/client
npx prisma init
```

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String?
  avatarUrl  String?
  boards     Board[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Board {
  id          String   @id @default(cuid())
  name        String
  description String?
  thumbnail   String?
  data        Json?    // Excalidraw data
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  nodes       Node[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([userId])
}

model Node {
  id         String       @id @default(cuid())
  type       String
  position   Json         // {x, y}
  size       Json         // {width, height}
  data       Json
  boardId    String
  board      Board        @relation(fields: [boardId], references: [id], onDelete: Cascade)
  fromConnections Connection[] @relation("FromNode")
  toConnections   Connection[] @relation("ToNode")
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
  
  @@index([boardId])
}

model Connection {
  id        String   @id @default(cuid())
  fromId    String
  from      Node     @relation("FromNode", fields: [fromId], references: [id], onDelete: Cascade)
  toId      String
  to        Node     @relation("ToNode", fields: [toId], references: [id], onDelete: Cascade)
  boardId   String
  createdAt DateTime @default(now())
  
  @@unique([fromId, toId])
  @@index([boardId])
}
```

#### 2. Setup Supabase Auth

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
```

#### 3. Auth Components

```typescript
// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else {
      router.push('/boards')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to RAGBOARD
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

### Day 5: tRPC Setup

#### 1. Configure tRPC

```typescript
// server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import { type CreateNextContextOptions } from '@trpc/server/adapters/next'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return {
    user,
    supabase,
    prisma,
    ...opts,
  }
}

const t = initTRPC.context<typeof createTRPCContext>().create()

export const router = t.router
export const publicProcedure = t.procedure

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  })
})

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed)
```

#### 2. Board Router

```typescript
// server/routers/board.ts
import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

export const boardRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.board.findMany({
      where: { userId: ctx.user.id },
      orderBy: { updatedAt: 'desc' },
    })
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const board = await ctx.prisma.board.findUnique({
        where: { id: input.id },
        include: { nodes: true },
      })

      if (!board || board.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' })
      }

      return board
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.board.create({
        data: {
          ...input,
          userId: ctx.user.id,
        },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      data: z.any().optional(), // Excalidraw data
    }))
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
```

---

## Week 2: Board UI & Canvas Integration

### Day 1-2: Board List & Management UI

#### 1. Board List Page

```typescript
// app/boards/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { Plus, MoreVertical, Trash2, Edit2 } from 'lucide-react'

export default function BoardsPage() {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')

  const { data: boards, isLoading } = trpc.board.list.useQuery()
  const createBoard = trpc.board.create.useMutation({
    onSuccess: (board) => {
      router.push(`/boards/${board.id}`)
    },
  })
  const deleteBoard = trpc.board.delete.useMutation({
    onSuccess: () => {
      router.refresh()
    },
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBoardName.trim()) return

    createBoard.mutate({ name: newBoardName })
    setNewBoardName('')
    setIsCreating(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Boards</h1>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Board
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreate} className="mb-6 bg-white p-4 rounded-lg shadow">
            <input
              type="text"
              placeholder="Board name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards?.map((board) => (
            <div
              key={board.id}
              className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow"
            >
              <Link href={`/boards/${board.id}`}>
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 truncate">
                    {board.name}
                  </h3>
                  {board.description && (
                    <p className="mt-1 text-sm text-gray-500 truncate">
                      {board.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    Updated {new Date(board.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
              <div className="bg-gray-50 px-6 py-3 flex justify-end">
                <button
                  onClick={() => deleteBoard.mutate({ id: board.id })}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Day 3-4: Excalidraw Integration

#### 1. Create Canvas Package

```bash
cd packages/canvas
pnpm init
pnpm add @excalidraw/excalidraw react react-dom
pnpm add -D @types/react
```

```typescript
// packages/canvas/src/Canvas.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Excalidraw, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types'

interface CanvasProps {
  initialData?: {
    elements?: readonly ExcalidrawElement[]
    appState?: any
  }
  onChange?: (elements: readonly ExcalidrawElement[], appState: any) => void
  onReady?: (api: ExcalidrawImperativeAPI) => void
}

export function Canvas({ initialData, onChange, onReady }: CanvasProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)

  return (
    <div className="w-full h-full">
      <Excalidraw
        excalidrawAPI={(api) => {
          setExcalidrawAPI(api)
          onReady?.(api)
        }}
        initialData={initialData}
        onChange={(elements, appState) => {
          onChange?.(elements, appState)
        }}
        theme="light"
        name="RAGBOARD Canvas"
        UIOptions={{
          canvasActions: {
            export: false,
            loadScene: false,
            saveToActiveFile: false,
          },
        }}
      />
    </div>
  )
}

// Export utilities
export { exportToBlob, exportToSvg } from '@excalidraw/excalidraw'
export type { ExcalidrawImperativeAPI, ExcalidrawElement }
```

### Day 5: Board Detail Page with Canvas

```typescript
// app/boards/[id]/page.tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc/client'
import { ArrowLeft, Save, Share2 } from 'lucide-react'
import type { ExcalidrawElement, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types'

// Dynamic import to avoid SSR issues
const Canvas = dynamic(
  () => import('@ragboard/canvas').then(mod => mod.Canvas),
  { ssr: false }
)

export default function BoardPage() {
  const params = useParams()
  const router = useRouter()
  const boardId = params.id as string
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null)

  const { data: board, isLoading } = trpc.board.get.useQuery({ id: boardId })
  const updateBoard = trpc.board.update.useMutation()

  const handleCanvasChange = useCallback((elements: readonly ExcalidrawElement[], appState: any) => {
    setHasChanges(true)
  }, [])

  const handleSave = async () => {
    if (!excalidrawAPI.current || !hasChanges) return

    setIsSaving(true)
    const elements = excalidrawAPI.current.getSceneElements()
    const appState = excalidrawAPI.current.getAppState()

    try {
      await updateBoard.mutateAsync({
        id: boardId,
        data: {
          elements,
          appState,
        },
      })
      setHasChanges(false)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!board) {
    return <div>Board not found</div>
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/boards')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold">{board.name}</h1>
            {hasChanges && (
              <span className="text-sm text-gray-500">• Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-md">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-gray-50">
        <Canvas
          initialData={board.data as any}
          onChange={handleCanvasChange}
          onReady={(api) => {
            excalidrawAPI.current = api
          }}
        />
      </div>
    </div>
  )
}
```

---

## Week 3: Polish & Basic Node System

### Day 1-2: Auto-save & Performance

```typescript
// hooks/useAutoSave.ts
import { useCallback, useEffect, useRef } from 'react'
import { debounce } from 'lodash'

export function useAutoSave(
  save: () => Promise<void>,
  delay: number = 2000
) {
  const saveRef = useRef(save)
  saveRef.current = save

  const debouncedSave = useCallback(
    debounce(async () => {
      await saveRef.current()
    }, delay),
    [delay]
  )

  useEffect(() => {
    return () => {
      debouncedSave.cancel()
    }
  }, [debouncedSave])

  return debouncedSave
}

// Update BoardPage to use auto-save
const autoSave = useAutoSave(handleSave, 2000)

const handleCanvasChange = useCallback((elements: readonly ExcalidrawElement[], appState: any) => {
  setHasChanges(true)
  autoSave()
}, [autoSave])
```

### Day 3-5: Basic Node System Foundation

```typescript
// packages/nodes/src/types.ts
export interface NodeData {
  id: string
  type: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  data: any
}

export interface NodeConnection {
  from: string
  to: string
}

// packages/nodes/src/NodeLayer.tsx
import { useEffect, useState } from 'react'
import { NodeData, NodeConnection } from './types'

interface NodeLayerProps {
  nodes: NodeData[]
  connections: NodeConnection[]
  onNodeUpdate: (nodeId: string, updates: Partial<NodeData>) => void
  onConnectionCreate: (from: string, to: string) => void
}

export function NodeLayer({ nodes, connections, onNodeUpdate, onConnectionCreate }: NodeLayerProps) {
  // Basic implementation for Phase 1
  // Full implementation in Phase 2
  
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Render nodes */}
      {nodes.map(node => (
        <div
          key={node.id}
          className="absolute bg-white border-2 border-gray-300 rounded-lg p-4 pointer-events-auto"
          style={{
            left: node.position.x,
            top: node.position.y,
            width: node.size.width,
            height: node.size.height,
          }}
        >
          <div className="text-sm font-medium">{node.type}</div>
        </div>
      ))}
      
      {/* Render connections */}
      <svg className="absolute inset-0">
        {connections.map((conn, idx) => {
          const fromNode = nodes.find(n => n.id === conn.from)
          const toNode = nodes.find(n => n.id === conn.to)
          if (!fromNode || !toNode) return null
          
          return (
            <line
              key={idx}
              x1={fromNode.position.x + fromNode.size.width / 2}
              y1={fromNode.position.y + fromNode.size.height / 2}
              x2={toNode.position.x + toNode.size.width / 2}
              y2={toNode.position.y + toNode.size.height / 2}
              stroke="#9CA3AF"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          )
        })}
      </svg>
    </div>
  )
}
```

---

## Testing Strategy for Phase 1

### Unit Tests

```typescript
// __tests__/api/board.test.ts
import { createMockContext } from '@/test/context'
import { boardRouter } from '@/server/routers/board'

describe('Board API', () => {
  test('creates a board', async () => {
    const ctx = createMockContext({
      user: { id: 'user-1', email: 'test@example.com' }
    })
    
    const board = await boardRouter.create({
      ctx,
      input: { name: 'Test Board' }
    })
    
    expect(board.name).toBe('Test Board')
    expect(board.userId).toBe('user-1')
  })
})
```

### E2E Tests

```typescript
// e2e/boards.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Board Management', () => {
  test('can create and open a board', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    // Create board
    await page.goto('/boards')
    await page.click('text=New Board')
    await page.fill('input[placeholder="Board name..."]', 'My Test Board')
    await page.click('text=Create')
    
    // Should redirect to board
    await expect(page).toHaveURL(/\/boards\/[\w-]+/)
    await expect(page.locator('h1')).toContainText('My Test Board')
  })
})
```

---

## Deployment Checklist for Phase 1

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Authentication working
- [ ] Canvas saving/loading tested
- [ ] Basic error handling in place
- [ ] Loading states implemented
- [ ] Responsive design verified
- [ ] Basic security headers added
- [ ] CI/CD pipeline setup

---

## Success Criteria for Phase 1

1. ✅ Users can register and login
2. ✅ Users can create, list, and delete boards
3. ✅ Excalidraw canvas loads and saves
4. ✅ Basic UI is responsive and polished
5. ✅ Database schema supports future features
6. ✅ Project structure supports modular development
7. ✅ Basic tests are passing
8. ✅ Development environment is documented

---

## Common Issues & Solutions

### Issue: Excalidraw not loading
```javascript
// Ensure dynamic import and check for SSR
const Canvas = dynamic(
  () => import('@ragboard/canvas').then(mod => mod.Canvas),
  { 
    ssr: false,
    loading: () => <div>Loading canvas...</div>
  }
)
```

### Issue: CORS errors with Supabase
```javascript
// Add to next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ]
  },
}
```

### Issue: TypeScript errors with Excalidraw
```typescript
// Add to tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

---

## Next Steps (Phase 2 Preview)

With Phase 1 complete, you'll have:
- Working authentication
- Board management
- Canvas that saves
- Modular architecture

Phase 2 will build on this by:
- Implementing the full node system
- Adding all node types (Text, AI, Media, etc.)
- Drag and drop functionality
- Node connections UI
- Node data persistence

Start Phase 2 by reviewing the Node System specification in the main development plan.