# Phase 3: Real-time Collaboration Implementation Guide

## Overview
This guide details the implementation of Yjs-based real-time collaboration for RAGBOARD, enabling multiple users to work on boards simultaneously with conflict-free synchronization.

## Architecture

### Collaboration Stack
```
Frontend (Yjs + React) ↔ WebSocket ↔ Backend (y-websocket server)
         ↓                               ↓
    Local State                    Persistence Layer
```

## Implementation Steps

### 1. Yjs Document Structure

**File: `src/modules/collaboration/types/YDocTypes.ts`**
```typescript
import * as Y from 'yjs';

export interface BoardYDoc {
  nodes: Y.Map<any>;        // All nodes on the board
  edges: Y.Array<any>;      // Connections between nodes
  cursors: Y.Map<any>;      // User cursors
  selection: Y.Map<any>;    // Selected elements
  presence: Y.Map<any>;     // User presence info
}

export interface NodeData {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
  size?: { width: number; height: number };
  locked?: boolean;
  lockedBy?: string;
}

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  lastActivity: number;
}
```

### 2. Yjs Provider Setup

**File: `src/modules/collaboration/providers/YjsProvider.tsx`**
```typescript
import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { BoardYDoc } from '../types/YDocTypes';

interface YjsContextType {
  doc: Y.Doc;
  provider: WebsocketProvider;
  awareness: any;
}

const YjsContext = createContext<YjsContextType | null>(null);

export function YjsProvider({ 
  children, 
  boardId, 
  username,
  userColor 
}: { 
  children: ReactNode;
  boardId: string;
  username: string;
  userColor: string;
}) {
  const docRef = useRef<Y.Doc>();
  const providerRef = useRef<WebsocketProvider>();
  
  useEffect(() => {
    // Create Yjs document
    const doc = new Y.Doc();
    docRef.current = doc;
    
    // Setup WebSocket provider
    const wsUrl = process.env.VITE_WS_URL || 'ws://localhost:1234';
    const provider = new WebsocketProvider(
      wsUrl,
      `board-${boardId}`,
      doc,
      {
        connect: true,
        params: {
          auth: localStorage.getItem('token')
        }
      }
    );
    providerRef.current = provider;
    
    // Setup local persistence
    const persistence = new IndexeddbPersistence(
      `board-${boardId}`,
      doc
    );
    
    // Set user awareness
    provider.awareness.setLocalStateField('user', {
      id: localStorage.getItem('userId'),
      name: username,
      color: userColor,
      lastActivity: Date.now()
    });
    
    // Handle connection status
    provider.on('status', (event: any) => {
      console.log('Connection status:', event.status);
    });
    
    // Cleanup
    return () => {
      provider.destroy();
      persistence.destroy();
      doc.destroy();
    };
  }, [boardId, username, userColor]);
  
  if (!docRef.current || !providerRef.current) {
    return null;
  }
  
  return (
    <YjsContext.Provider 
      value={{
        doc: docRef.current,
        provider: providerRef.current,
        awareness: providerRef.current.awareness
      }}
    >
      {children}
    </YjsContext.Provider>
  );
}

export const useYjs = () => {
  const context = useContext(YjsContext);
  if (!context) {
    throw new Error('useYjs must be used within YjsProvider');
  }
  return context;
};
```

### 3. Shared State Hooks

**File: `src/modules/collaboration/hooks/useSharedNodes.ts`**
```typescript
import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { useYjs } from '../providers/YjsProvider';
import { NodeData } from '../types/YDocTypes';

export function useSharedNodes() {
  const { doc } = useYjs();
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const yNodes = doc.getMap('nodes');
  
  useEffect(() => {
    const updateNodes = () => {
      const nodesArray: NodeData[] = [];
      yNodes.forEach((node: any) => {
        nodesArray.push(node);
      });
      setNodes(nodesArray);
    };
    
    // Initial load
    updateNodes();
    
    // Subscribe to changes
    yNodes.observe(updateNodes);
    
    return () => {
      yNodes.unobserve(updateNodes);
    };
  }, [yNodes]);
  
  const addNode = useCallback((node: NodeData) => {
    doc.transact(() => {
      yNodes.set(node.id, node);
    });
  }, [doc, yNodes]);
  
  const updateNode = useCallback((nodeId: string, updates: Partial<NodeData>) => {
    doc.transact(() => {
      const existingNode = yNodes.get(nodeId);
      if (existingNode) {
        yNodes.set(nodeId, { ...existingNode, ...updates });
      }
    });
  }, [doc, yNodes]);
  
  const deleteNode = useCallback((nodeId: string) => {
    doc.transact(() => {
      yNodes.delete(nodeId);
    });
  }, [doc, yNodes]);
  
  const lockNode = useCallback((nodeId: string, userId: string) => {
    updateNode(nodeId, { locked: true, lockedBy: userId });
  }, [updateNode]);
  
  const unlockNode = useCallback((nodeId: string) => {
    updateNode(nodeId, { locked: false, lockedBy: undefined });
  }, [updateNode]);
  
  return {
    nodes,
    addNode,
    updateNode,
    deleteNode,
    lockNode,
    unlockNode
  };
}
```

### 4. Presence & Cursors

**File: `src/modules/collaboration/hooks/usePresence.ts`**
```typescript
import { useEffect, useState, useCallback } from 'react';
import { useYjs } from '../providers/YjsProvider';
import { UserPresence } from '../types/YDocTypes';

export function usePresence() {
  const { awareness } = useYjs();
  const [users, setUsers] = useState<Map<number, UserPresence>>(new Map());
  
  useEffect(() => {
    const updateUsers = () => {
      const states = awareness.getStates();
      const usersMap = new Map<number, UserPresence>();
      
      states.forEach((state: any, clientId: number) => {
        if (state.user && clientId !== awareness.clientID) {
          usersMap.set(clientId, state.user);
        }
      });
      
      setUsers(usersMap);
    };
    
    awareness.on('change', updateUsers);
    updateUsers();
    
    return () => {
      awareness.off('change', updateUsers);
    };
  }, [awareness]);
  
  const updateCursor = useCallback((position: { x: number; y: number }) => {
    awareness.setLocalStateField('cursor', position);
  }, [awareness]);
  
  const updateSelection = useCallback((selectedIds: string[]) => {
    awareness.setLocalStateField('selection', selectedIds);
  }, [awareness]);
  
  return {
    users: Array.from(users.values()),
    updateCursor,
    updateSelection
  };
}
```

**File: `src/modules/collaboration/components/UserCursors.tsx`**
```typescript
import { usePresence } from '../hooks/usePresence';
import { motion } from 'framer-motion';

export function UserCursors() {
  const { users } = usePresence();
  
  return (
    <>
      {users.map((user) => (
        user.cursor && (
          <motion.div
            key={user.id}
            initial={false}
            animate={{
              x: user.cursor.x,
              y: user.cursor.y
            }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute pointer-events-none z-50"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M5.5 3.5L19.5 12L12 12L12 20.5L5.5 3.5Z"
                fill={user.color}
                stroke="white"
                strokeWidth="2"
              />
            </svg>
            <div
              className="absolute top-6 left-2 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </div>
          </motion.div>
        )
      ))}
    </>
  );
}
```

### 5. Conflict Resolution

**File: `src/modules/collaboration/utils/conflictResolution.ts`**
```typescript
import * as Y from 'yjs';

export class ConflictResolver {
  static resolveNodePosition(
    localChange: any,
    remoteChange: any,
    localTimestamp: number,
    remoteTimestamp: number
  ) {
    // Last-write-wins for position changes
    return remoteTimestamp > localTimestamp ? remoteChange : localChange;
  }
  
  static resolveNodeData(
    yNode: Y.Map<any>,
    localData: any,
    remoteData: any
  ) {
    // Merge non-conflicting fields
    const merged = { ...localData };
    
    Object.keys(remoteData).forEach(key => {
      if (localData[key] === undefined) {
        // Remote added a new field
        merged[key] = remoteData[key];
      } else if (typeof localData[key] === 'object' && typeof remoteData[key] === 'object') {
        // Deep merge objects
        merged[key] = { ...localData[key], ...remoteData[key] };
      } else if (localData[key] !== remoteData[key]) {
        // Conflict - use operational transform
        merged[key] = this.operationalTransform(
          key,
          localData[key],
          remoteData[key]
        );
      }
    });
    
    return merged;
  }
  
  static operationalTransform(field: string, localValue: any, remoteValue: any) {
    // Custom conflict resolution based on field type
    switch (field) {
      case 'text':
        // For text, try to merge if possible
        if (typeof localValue === 'string' && typeof remoteValue === 'string') {
          // Simple example - in practice, use a proper OT library
          return localValue + '\n[Merged]\n' + remoteValue;
        }
        break;
        
      case 'position':
        // For positions, average them to avoid overlap
        if (localValue.x && remoteValue.x) {
          return {
            x: (localValue.x + remoteValue.x) / 2,
            y: (localValue.y + remoteValue.y) / 2
          };
        }
        break;
    }
    
    // Default: last-write-wins
    return remoteValue;
  }
}
```

### 6. Collaboration-Aware Board Canvas

**File: `src/modules/collaboration/components/CollaborativeBoard.tsx`**
```typescript
import { useCallback, useEffect } from 'react';
import ReactFlow, { 
  Node, 
  Edge, 
  useNodesState, 
  useEdgesState,
  OnNodesChange,
  OnEdgesChange,
  NodeDragHandler
} from 'reactflow';
import { useSharedNodes } from '../hooks/useSharedNodes';
import { usePresence } from '../hooks/usePresence';
import { UserCursors } from './UserCursors';
import { SelectionIndicators } from './SelectionIndicators';

export function CollaborativeBoard() {
  const { nodes: sharedNodes, updateNode, lockNode, unlockNode } = useSharedNodes();
  const { updateCursor, updateSelection } = usePresence();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Sync shared nodes to local state
  useEffect(() => {
    setNodes(sharedNodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        ...node.data,
        locked: node.locked,
        lockedBy: node.lockedBy
      }
    })));
  }, [sharedNodes, setNodes]);
  
  // Track mouse movement for cursor sharing
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    updateCursor({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    });
  }, [updateCursor]);
  
  // Handle node dragging with locking
  const handleNodeDragStart: NodeDragHandler = useCallback((event, node) => {
    lockNode(node.id, localStorage.getItem('userId')!);
  }, [lockNode]);
  
  const handleNodeDrag: NodeDragHandler = useCallback((event, node) => {
    updateNode(node.id, { position: node.position });
  }, [updateNode]);
  
  const handleNodeDragStop: NodeDragHandler = useCallback((event, node) => {
    unlockNode(node.id);
  }, [unlockNode]);
  
  // Handle selection changes
  const handleSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    updateSelection(nodes.map(n => n.id));
  }, [updateSelection]);
  
  return (
    <div className="relative w-full h-full" onMouseMove={handleMouseMove}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onSelectionChange={handleSelectionChange}
        nodesDraggable
        nodesConnectable
        nodesFocusable
      >
        <UserCursors />
        <SelectionIndicators />
      </ReactFlow>
    </div>
  );
}
```

### 7. Backend WebSocket Server

**File: `backend/app/modules/realtime/yjs_server.py`**
```python
import asyncio
from ypy_websocket import WebsocketServer, YRoom
from typing import Optional
import y_py as Y
import logging

logger = logging.getLogger(__name__)

class PersistentYRoom(YRoom):
    """Custom YRoom with Redis persistence"""
    
    def __init__(self, room_name: str, redis_client):
        super().__init__(room_name)
        self.redis_client = redis_client
        self.room_name = room_name
        
    async def on_message(self, client_id: str, message: bytes):
        """Handle incoming messages"""
        await super().on_message(client_id, message)
        
        # Persist to Redis after each change
        await self.persist()
        
    async def persist(self):
        """Persist Y.Doc state to Redis"""
        try:
            state = Y.encode_state_as_update(self.ydoc)
            await self.redis_client.set(
                f"yjs:board:{self.room_name}",
                state,
                ex=86400  # 24 hour expiry
            )
        except Exception as e:
            logger.error(f"Failed to persist room {self.room_name}: {e}")
            
    async def load(self):
        """Load Y.Doc state from Redis"""
        try:
            state = await self.redis_client.get(f"yjs:board:{self.room_name}")
            if state:
                Y.apply_update(self.ydoc, state)
        except Exception as e:
            logger.error(f"Failed to load room {self.room_name}: {e}")

class CollaborationServer:
    def __init__(self, redis_client):
        self.redis_client = redis_client
        self.server = WebsocketServer(
            rooms_factory=lambda room_name: PersistentYRoom(room_name, redis_client)
        )
        
    async def start(self, host: str = "0.0.0.0", port: int = 1234):
        """Start the WebSocket server"""
        logger.info(f"Starting collaboration server on {host}:{port}")
        await self.server.start_server(host, port)
        
    async def shutdown(self):
        """Gracefully shutdown the server"""
        await self.server.shutdown()

# Integration with FastAPI
async def start_collaboration_server(app):
    """Start collaboration server as background task"""
    redis_client = app.state.redis
    collab_server = CollaborationServer(redis_client)
    
    # Store reference for cleanup
    app.state.collab_server = collab_server
    
    # Start server
    asyncio.create_task(collab_server.start())

@app.on_event("shutdown")
async def shutdown_collaboration_server():
    """Cleanup on app shutdown"""
    if hasattr(app.state, "collab_server"):
        await app.state.collab_server.shutdown()
```

### 8. Presence Indicators

**File: `src/modules/collaboration/components/PresenceAvatars.tsx`**
```typescript
import { usePresence } from '../hooks/usePresence';
import { motion, AnimatePresence } from 'framer-motion';

export function PresenceAvatars() {
  const { users } = usePresence();
  
  // Filter active users (active in last 30 seconds)
  const activeUsers = users.filter(
    user => Date.now() - user.lastActivity < 30000
  );
  
  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
      <AnimatePresence>
        {activeUsers.map((user, index) => (
          <motion.div
            key={user.id}
            initial={{ scale: 0, x: 50 }}
            animate={{ scale: 1, x: 0 }}
            exit={{ scale: 0, x: 50 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            
            {/* Activity indicator */}
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            
            {/* Selection indicator */}
            {user.selection && user.selection.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {user.selection.length}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      
      {activeUsers.length > 0 && (
        <div className="text-sm text-gray-600 ml-2">
          {activeUsers.length} active {activeUsers.length === 1 ? 'user' : 'users'}
        </div>
      )}
    </div>
  );
}
```

### 9. Offline Support

**File: `src/modules/collaboration/hooks/useOfflineSync.ts`**
```typescript
import { useEffect, useState } from 'react';
import { useYjs } from '../providers/YjsProvider';

export function useOfflineSync() {
  const { provider } = useYjs();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingChanges, setPendingChanges] = useState(0);
  
  useEffect(() => {
    const handleStatusChange = ({ status }: { status: string }) => {
      setIsOnline(status === 'connected');
    };
    
    const handleSync = ({ synced }: { synced: boolean }) => {
      if (synced) {
        setPendingChanges(0);
      }
    };
    
    provider.on('status', handleStatusChange);
    provider.on('sync', handleSync);
    
    // Track offline changes
    if (!isOnline) {
      const doc = provider.doc;
      const trackChanges = () => {
        setPendingChanges(prev => prev + 1);
      };
      
      doc.on('update', trackChanges);
      
      return () => {
        doc.off('update', trackChanges);
      };
    }
    
    return () => {
      provider.off('status', handleStatusChange);
      provider.off('sync', handleSync);
    };
  }, [provider, isOnline]);
  
  return { isOnline, pendingChanges };
}

// Offline indicator component
export function OfflineIndicator() {
  const { isOnline, pendingChanges } = useOfflineSync();
  
  if (isOnline) return null;
  
  return (
    <div className="fixed bottom-4 left-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span>Offline mode</span>
        {pendingChanges > 0 && (
          <span className="text-sm">
            ({pendingChanges} pending changes)
          </span>
        )}
      </div>
    </div>
  );
}
```

## Testing

```typescript
// tests/collaboration.test.ts
import { renderHook } from '@testing-library/react-hooks';
import * as Y from 'yjs';
import { useSharedNodes } from '../src/modules/collaboration/hooks/useSharedNodes';

describe('Collaboration', () => {
  let doc: Y.Doc;
  
  beforeEach(() => {
    doc = new Y.Doc();
  });
  
  test('shared nodes sync correctly', () => {
    const { result } = renderHook(() => useSharedNodes(), {
      wrapper: ({ children }) => (
        <YjsProvider boardId="test" username="Test" userColor="#000">
          {children}
        </YjsProvider>
      )
    });
    
    // Add a node
    act(() => {
      result.current.addNode({
        id: 'node1',
        type: 'text',
        position: { x: 100, y: 100 },
        data: { text: 'Hello' }
      });
    });
    
    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].id).toBe('node1');
  });
});
```

## Performance Optimization

1. **Debounce Updates**: Throttle position updates during dragging
2. **Viewport Culling**: Only render visible cursors/selections
3. **Batch Transactions**: Group multiple changes in single transaction
4. **Compression**: Enable WebSocket compression
5. **Lazy Loading**: Load collaboration features on-demand

## Next Steps

1. Add voice/video chat for real-time communication
2. Implement commenting system with threads
3. Add version history and rollback
4. Implement advanced merge strategies
5. Add collaboration analytics

This completes the Phase 3 Collaboration implementation guide.