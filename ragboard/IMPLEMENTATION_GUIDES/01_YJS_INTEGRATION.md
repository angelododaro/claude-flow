# Yjs Real-Time Collaboration Integration Guide

## Overview
Integrate Yjs CRDT (Conflict-free Replicated Data Type) to enable real-time collaboration in ragboard. This will allow multiple users to edit the same board simultaneously without conflicts.

## Prerequisites
- Existing TipTap editor (already has Yjs support)
- WebSocket infrastructure (already in place)
- React 18+ (✓)

## Installation

```bash
npm install yjs y-websocket y-prosemirror @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor
```

## Implementation Steps

### 1. Create Yjs Provider (backend/app/services/yjs_provider.py)

```python
from fastapi import WebSocket
import y_py as Y
from typing import Dict, Set
import asyncio
import json

class YjsRoom:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.doc = Y.YDoc()
        self.clients: Set[WebSocket] = set()
        self.awareness = {}
        
    async def add_client(self, websocket: WebSocket, user_id: str):
        self.clients.add(websocket)
        self.awareness[user_id] = {
            "user": {"name": user_id, "color": self._get_user_color(user_id)},
            "cursor": None
        }
        await self.broadcast_awareness()
        
    async def handle_message(self, websocket: WebSocket, message: bytes):
        # Handle Yjs sync protocol
        message_type = message[0]
        
        if message_type == 0:  # Sync step 1
            await self._handle_sync_step1(websocket, message[1:])
        elif message_type == 1:  # Sync step 2
            await self._handle_sync_step2(message[1:])
        elif message_type == 2:  # Update
            await self._handle_update(message[1:])
            
    async def broadcast_update(self, update: bytes, origin: WebSocket = None):
        message = bytes([2]) + update
        for client in self.clients:
            if client != origin:
                await client.send_bytes(message)
```

### 2. Update WebSocket Handler (backend/app/websocket.py)

```python
from .services.yjs_provider import YjsRoom

class ConnectionManager:
    def __init__(self):
        self.yjs_rooms: Dict[str, YjsRoom] = {}
        
    async def handle_yjs_message(self, board_id: str, websocket: WebSocket, data: bytes):
        if board_id not in self.yjs_rooms:
            self.yjs_rooms[board_id] = YjsRoom(board_id)
            
        room = self.yjs_rooms[board_id]
        await room.handle_message(websocket, data)
```

### 3. Frontend Yjs Provider (src/hooks/useYjsProvider.ts)

```typescript
import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useWebSocket } from './useWebSocket';

export function useYjsProvider(boardId: string, userId: string) {
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const { wsUrl } = useWebSocket();

  useEffect(() => {
    const wsProvider = new WebsocketProvider(
      wsUrl,
      `board-${boardId}`,
      ydoc,
      {
        connect: true,
        params: { userId },
      }
    );

    wsProvider.awareness.setLocalStateField('user', {
      name: userId,
      color: getUserColor(userId),
    });

    setProvider(wsProvider);

    return () => {
      wsProvider.destroy();
    };
  }, [boardId, userId, wsUrl, ydoc]);

  return { ydoc, provider };
}
```

### 4. Update TipTap Editor (src/components/RichTextEditor.tsx)

```typescript
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import { useYjsProvider } from '../hooks/useYjsProvider';

export function RichTextEditor({ boardId, userId, nodeId }) {
  const { ydoc, provider } = useYjsProvider(boardId, userId);
  
  const editor = useEditor({
    extensions: [
      // ... existing extensions
      Collaboration.configure({
        document: ydoc,
        field: `node-${nodeId}`,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: userId,
          color: getUserColor(userId),
        },
      }),
    ],
  });
  
  return <EditorContent editor={editor} />;
}
```

### 5. Sync ReactFlow State (src/store/boardStore.ts)

```typescript
import * as Y from 'yjs';

interface BoardStore {
  ydoc: Y.Doc;
  yNodes: Y.Map<any>;
  yEdges: Y.Map<any>;
  
  initYjs: (ydoc: Y.Doc) => void;
  syncNodesToYjs: () => void;
  syncNodesFromYjs: () => void;
}

const useBoardStore = create<BoardStore>((set, get) => ({
  initYjs: (ydoc: Y.Doc) => {
    const yNodes = ydoc.getMap('nodes');
    const yEdges = ydoc.getMap('edges');
    
    // Listen for remote changes
    yNodes.observe(() => {
      get().syncNodesFromYjs();
    });
    
    yEdges.observe(() => {
      get().syncEdgesFromYjs();
    });
    
    set({ ydoc, yNodes, yEdges });
  },
  
  syncNodesToYjs: () => {
    const { nodes, yNodes } = get();
    nodes.forEach((node, id) => {
      yNodes.set(id, node);
    });
  },
}));
```

### 6. Add Presence Indicators (src/components/PresenceIndicator.tsx)

```typescript
export function PresenceIndicator({ provider }: { provider: WebsocketProvider }) {
  const [users, setUsers] = useState<Map<number, any>>(new Map());

  useEffect(() => {
    const updateUsers = () => {
      const states = provider.awareness.getStates();
      setUsers(new Map(states));
    };

    provider.awareness.on('change', updateUsers);
    updateUsers();

    return () => {
      provider.awareness.off('change', updateUsers);
    };
  }, [provider]);

  return (
    <div className="absolute top-4 right-4 flex gap-2">
      {Array.from(users.values()).map((user) => (
        <div
          key={user.clientId}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: user.user?.color }}
        >
          {user.user?.name?.[0]?.toUpperCase()}
        </div>
      ))}
    </div>
  );
}
```

## Testing

1. **Local Testing**:
   ```bash
   # Terminal 1: Start backend with Yjs support
   python main.py
   
   # Terminal 2: Start frontend
   npm run dev
   ```

2. **Multi-user Testing**:
   - Open multiple browser windows
   - Join the same board
   - Verify real-time sync

## Performance Considerations

1. **Debounce Updates**: Batch Yjs updates to reduce network traffic
2. **Lazy Loading**: Only sync visible nodes
3. **Compression**: Enable WebSocket compression
4. **Garbage Collection**: Periodically clean Yjs document

## Security

1. **Authentication**: Verify user tokens before allowing Yjs connection
2. **Authorization**: Check board permissions
3. **Rate Limiting**: Limit update frequency per user
4. **Validation**: Validate all Yjs operations server-side

## Monitoring

Add metrics for:
- Active collaboration sessions
- Update frequency
- Conflict resolution stats
- Network bandwidth usage

## Rollout Strategy

1. **Feature Flag**: Enable Yjs for specific boards
2. **Beta Testing**: Roll out to power users first
3. **Gradual Rollout**: Increase percentage over time
4. **Fallback**: Keep non-collaborative mode available