# RAGBOARD Quick Start Guide

## 🚀 Getting Started in 30 Minutes

This guide will help you get RAGBOARD running locally and understand the modular architecture.

## Prerequisites

- Node.js 18+ and pnpm
- Docker & Docker Compose
- PostgreSQL (via Docker)
- MinIO (via Docker)

## Initial Setup

### 1. Clone and Install (5 min)

```bash
# Clone the repository
git clone https://github.com/your-org/ragboard.git
cd ragboard

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
```

### 2. Configure Environment (5 min)

Edit `.env.local`:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/ragboard"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# AI Services
OPENAI_API_KEY="your-openai-key"
ANTHROPIC_API_KEY="your-claude-key"

# Storage (MinIO)
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="ragboard"

# PartyKit (for collaboration)
NEXT_PUBLIC_PARTYKIT_HOST="localhost:1999"
```

### 3. Start Infrastructure (5 min)

```bash
# Start PostgreSQL and MinIO
docker-compose up -d

# Wait for services to be ready
sleep 10

# Run database migrations
pnpm prisma migrate dev

# Seed initial data (optional)
pnpm prisma db seed
```

### 4. Start Development Server (2 min)

```bash
# Start the development server
pnpm dev

# In another terminal, start PartyKit server for collaboration
pnpm partykit dev
```

Visit http://localhost:3000 and you should see the RAGBOARD homepage!

---

## 🏗️ Project Structure Overview

```
ragboard/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/               # App router pages
│   │   ├── components/        # UI components
│   │   └── lib/              # Frontend utilities
│   └── api/                   # tRPC backend (if separate)
│
├── packages/                   # Shared packages (monorepo)
│   ├── ui/                    # Design system components
│   ├── canvas/                # Excalidraw wrapper
│   ├── nodes/                 # Node system
│   ├── ai/                    # AI integration
│   └── types/                 # Shared TypeScript types
│
├── prisma/
│   └── schema.prisma          # Database schema
│
└── docker-compose.yml         # Local infrastructure
```

---

## 🎯 Creating Your First Board

### 1. Register/Login

```typescript
// The auth flow is handled by Supabase
// Components are in apps/web/app/(auth)/
```

### 2. Create a Board

```typescript
// apps/web/app/boards/new/page.tsx
import { createBoard } from '@/lib/api/boards'

const board = await createBoard({
  name: 'My First Board',
  description: 'Testing RAGBOARD',
})

// Redirects to /boards/[id]
```

### 3. Add Your First Node

```typescript
// The node system is modular - here's how to add a text node
import { useNodeRegistry } from '@ragboard/nodes'

const registry = useNodeRegistry()
const textNode = registry.create('text', {
  position: { x: 100, y: 100 },
  data: { content: 'Hello RAGBOARD!' }
})
```

### 4. Connect to AI

```typescript
// AI nodes can be connected to other nodes for context
const aiNode = registry.create('ai', {
  position: { x: 400, y: 100 },
  data: { model: 'claude-3-sonnet' }
})

// Create connection
canvas.connect(textNode.id, aiNode.id)
```

---

## 📦 Working with Modules

### Understanding Module Boundaries

Each module in RAGBOARD is designed to be independent:

```typescript
// ✅ GOOD: Import from module's public API
import { useCanvas } from '@ragboard/canvas'
import { NodeRegistry } from '@ragboard/nodes'

// ❌ BAD: Import from internal files
import { CanvasCore } from '@ragboard/canvas/src/core' // Don't do this!
```

### Creating a Custom Node Type

```typescript
// packages/nodes/src/custom/MyCustomNode.tsx
import { INodeRenderer, NodeProps } from '../types'

export const MyCustomNode: INodeRenderer = {
  type: 'my-custom',
  component: ({ node, selected }) => (
    <div className={`node ${selected ? 'selected' : ''}`}>
      {/* Your node UI */}
    </div>
  ),
  defaultSize: { width: 200, height: 100 },
  resizable: true,
  connectableTypes: ['ai', 'text'],
  serialize: (node) => JSON.stringify(node.data),
  deserialize: (data) => JSON.parse(data),
  validate: (data) => true,
}

// Register it
import { nodeRegistry } from '@ragboard/nodes'
nodeRegistry.register(MyCustomNode)
```

### Using the AI Module

```typescript
import { useAI } from '@ragboard/ai'

function ChatComponent() {
  const { chat, isLoading } = useAI()
  
  const handleSend = async (message: string) => {
    const response = await chat([
      { role: 'user', content: message }
    ], {
      // Optional context from connected nodes
      nodeIds: ['node-1', 'node-2']
    })
    
    console.log(response)
  }
}
```

---

## 🔧 Common Development Tasks

### Adding a New API Endpoint

```typescript
// apps/web/server/routers/myRouter.ts
import { router, protectedProcedure } from '../trpc'
import { z } from 'zod'

export const myRouter = router({
  myEndpoint: protectedProcedure
    .input(z.object({
      data: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Your logic here
      return { success: true }
    }),
})

// Add to main router
export const appRouter = router({
  boards: boardRouter,
  nodes: nodeRouter,
  my: myRouter, // Add here
})
```

### Working with the Database

```typescript
// Using Prisma
import { prisma } from '@/lib/db'

// Create
const board = await prisma.board.create({
  data: {
    name: 'New Board',
    userId: user.id,
  },
})

// Read
const boards = await prisma.board.findMany({
  where: { userId: user.id },
  include: { nodes: true },
})

// Update
await prisma.board.update({
  where: { id: boardId },
  data: { name: 'Updated Name' },
})
```

### Styling Components

```typescript
// Using Tailwind CSS + CVA
import { cva } from 'class-variance-authority'

const nodeStyles = cva(
  'rounded-lg border-2 p-4 shadow-lg transition-all',
  {
    variants: {
      type: {
        text: 'bg-white border-gray-300',
        ai: 'bg-purple-50 border-purple-500',
        media: 'bg-blue-50 border-blue-500',
      },
      selected: {
        true: 'ring-2 ring-purple-400 scale-105',
      },
    },
    defaultVariants: {
      type: 'text',
      selected: false,
    },
  }
)

// Usage
<div className={nodeStyles({ type: 'ai', selected: true })} />
```

---

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Make sure PostgreSQL is running
   docker-compose ps
   
   # Check logs
   docker-compose logs postgres
   ```

2. **MinIO Not Working**
   ```bash
   # Access MinIO console at http://localhost:9001
   # Default credentials: minioadmin/minioadmin
   
   # Create bucket manually if needed
   mc alias set local http://localhost:9000 minioadmin minioadmin
   mc mb local/ragboard
   ```

3. **TypeScript Errors**
   ```bash
   # Rebuild types
   pnpm typecheck
   
   # Clean and reinstall
   pnpm clean
   pnpm install
   ```

4. **Canvas Not Loading**
   ```bash
   # Check if Excalidraw assets are loaded
   # May need to add to next.config.js:
   experimental: {
     externalDir: true,
   }
   ```

---

## 📚 Next Steps

1. **Explore the Codebase**
   - Start with `apps/web/app/page.tsx`
   - Look at example nodes in `packages/nodes/src`
   - Check out the canvas integration

2. **Read Module Docs**
   - [Canvas Module](./docs/modules/canvas.md)
   - [Node System](./docs/modules/nodes.md)
   - [AI Integration](./docs/modules/ai.md)

3. **Join the Community**
   - Discord: [discord.gg/ragboard]
   - GitHub Discussions
   - Weekly dev calls

4. **Start Contributing**
   - Check open issues
   - Read CONTRIBUTING.md
   - Submit your first PR!

---

## 🎉 You're Ready!

You now have RAGBOARD running locally and understand the basics. Start building your visual AI-powered knowledge boards!

Need help? Check the [full documentation](./docs) or ask in [Discord](https://discord.gg/ragboard).