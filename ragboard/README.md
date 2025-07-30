# RAGBOARD - Phase 1 Implementation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- Supabase account (for authentication)

### Setup Instructions

1. **Clone and install dependencies:**
```bash
cd ragboard
pnpm install
```

2. **Set up environment variables:**
```bash
cp .env.example apps/web/.env.local
```

Edit `apps/web/.env.local` and add your Supabase credentials:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ragboard"
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-key"
```

3. **Start infrastructure:**
```bash
docker-compose up -d
```

4. **Run database migrations:**
```bash
pnpm prisma:generate
pnpm prisma:migrate
```

5. **Start development server:**
```bash
pnpm dev
```

Visit http://localhost:3000

## 📁 Project Structure

```
ragboard/
├── apps/
│   └── web/                 # Next.js application
│       ├── app/            # App router pages
│       ├── lib/            # Utilities and configurations
│       ├── server/         # tRPC server code
│       └── prisma/         # Database schema
├── packages/
│   ├── types/              # Shared TypeScript types
│   └── canvas/             # Excalidraw canvas component
└── docker-compose.yml      # Local infrastructure
```

## ✅ Phase 1 Completed Features

- [x] Monorepo setup with pnpm workspaces
- [x] Next.js 14 with App Router
- [x] TypeScript & Tailwind CSS
- [x] Supabase Authentication
- [x] PostgreSQL with Prisma ORM
- [x] tRPC for type-safe APIs
- [x] Board CRUD operations
- [x] Excalidraw canvas integration
- [x] Auto-save functionality
- [x] Protected routes with middleware
- [x] Docker infrastructure (PostgreSQL, Redis, MinIO, ChromaDB)

## 🔧 Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm typecheck` - Run TypeScript checks
- `pnpm lint` - Run ESLint
- `pnpm prisma:studio` - Open Prisma Studio

## 🎯 Next Steps (Phase 2)

1. Implement node system architecture
2. Add all node types (Text, AI Chat, Media, etc.)
3. Create drag & drop functionality
4. Build node connections UI
5. Persist node data

## 📚 Documentation

- [Development Plan](./RAGBOARD_MODULAR_DEVELOPMENT_PLAN.md)
- [Module Specifications](./RAGBOARD_MODULE_SPECIFICATION.md)
- [Quick Start Guide](./RAGBOARD_QUICK_START_GUIDE.md)
- [Phase 1 Implementation](./PHASE_1_DETAILED_IMPLEMENTATION.md)

## 🐛 Known Issues

- Canvas may not load on first render (refresh fixes it)
- Auto-save indicator sometimes persists after save

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.