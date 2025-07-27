# Excalidraw Integration Guide for RAGBOARD

## Overview
Add Excalidraw as a complementary whiteboard mode to ragboard's existing ReactFlow canvas. This provides users with hand-drawn diagramming capabilities alongside the node-based interface.

## Installation

```bash
npm install @excalidraw/excalidraw react-excalidraw-embed
```

## Implementation Steps

### 1. Excalidraw Wrapper Component (src/components/ExcalidrawCanvas.tsx)

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw';
import { ExcalidrawElement, ExcalidrawTextElement } from '@excalidraw/excalidraw/types/element/types';
import { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import { useBoardStore } from '../store/boardStore';
import { useTheme } from '../hooks/useTheme';

interface ExcalidrawCanvasProps {
  boardId: string;
  onSave?: (elements: readonly ExcalidrawElement[], appState: AppState) => void;
  collaborative?: boolean;
  initialData?: {
    elements: ExcalidrawElement[];
    appState: Partial<AppState>;
  };
}

export function ExcalidrawCanvas({
  boardId,
  onSave,
  collaborative = false,
  initialData,
}: ExcalidrawCanvasProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const { theme } = useTheme();
  const { addDrawing, updateDrawing, drawings } = useBoardStore();
  
  // Auto-save timer
  const saveTimerRef = useRef<NodeJS.Timeout>();
  
  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: AppState
  ) => {
    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    // Set new timer for auto-save (debounced)
    saveTimerRef.current = setTimeout(() => {
      const drawingData = {
        elements: elements as ExcalidrawElement[],
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          currentItemFontFamily: appState.currentItemFontFamily,
          zoom: appState.zoom,
          offsetLeft: appState.offsetLeft,
          offsetTop: appState.offsetTop,
        },
      };
      
      updateDrawing(boardId, drawingData);
      onSave?.(elements, appState);
    }, 1000); // Save after 1 second of inactivity
  }, [boardId, updateDrawing, onSave]);

  // Custom toolbar
  const renderTopRightUI = useCallback(() => {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => excalidrawAPI?.resetScene()}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Clear
        </button>
        <button
          onClick={async () => {
            if (!excalidrawAPI) return;
            const blob = await excalidrawAPI.exportToBlob({
              mimeType: 'image/png',
            });
            // Handle export
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `drawing-${Date.now()}.png`;
            a.click();
          }}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Export PNG
        </button>
      </div>
    );
  }, [excalidrawAPI]);

  return (
    <div className="w-full h-full">
      <Excalidraw
        ref={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
        initialData={initialData}
        onChange={handleChange}
        theme={theme === 'dark' ? 'dark' : 'light'}
        name={`Board-${boardId}`}
        UIOptions={{
          canvasActions: {
            saveToActiveFile: false,
            loadScene: false,
            export: {
              saveFileToDisk: true,
            },
            clearCanvas: true,
          },
        }}
        renderTopRightUI={renderTopRightUI}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ToggleTheme />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.ToolbarHint />
        </WelcomeScreen>
      </Excalidraw>
    </div>
  );
}
```

### 2. Dual Mode Board Component (src/components/DualModeBoard.tsx)

```typescript
import { useState } from 'react';
import { BoardCanvas } from './BoardCanvas';
import { ExcalidrawCanvas } from './ExcalidrawCanvas';
import { Pencil, Grid3x3 } from 'lucide-react';

type CanvasMode = 'flow' | 'draw';

export function DualModeBoard({ boardId }: { boardId: string }) {
  const [mode, setMode] = useState<CanvasMode>('flow');
  const { nodes, edges, drawings } = useBoardStore();

  return (
    <div className="relative w-full h-full">
      {/* Mode Switcher */}
      <div className="absolute top-4 left-4 z-20 bg-white rounded-lg shadow-lg p-1 flex">
        <button
          onClick={() => setMode('flow')}
          className={`flex items-center gap-2 px-3 py-2 rounded ${
            mode === 'flow' 
              ? 'bg-blue-500 text-white' 
              : 'hover:bg-gray-100'
          }`}
        >
          <Grid3x3 size={20} />
          <span>Nodes</span>
        </button>
        <button
          onClick={() => setMode('draw')}
          className={`flex items-center gap-2 px-3 py-2 rounded ${
            mode === 'draw' 
              ? 'bg-blue-500 text-white' 
              : 'hover:bg-gray-100'
          }`}
        >
          <Pencil size={20} />
          <span>Draw</span>
        </button>
      </div>

      {/* Canvas */}
      {mode === 'flow' ? (
        <BoardCanvas boardId={boardId} />
      ) : (
        <ExcalidrawCanvas 
          boardId={boardId}
          initialData={drawings[boardId]}
          collaborative={true}
        />
      )}
    </div>
  );
}
```

### 3. Excalidraw Node for ReactFlow (src/components/ExcalidrawNode.tsx)

```typescript
import { Handle, Position } from '@xyflow/react';
import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { ExcalidrawCanvas } from './ExcalidrawCanvas';

export function ExcalidrawNode({ data, id }: { data: any; id: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const generateThumbnail = async (elements: any[]) => {
    // Generate thumbnail from Excalidraw elements
    // This would use Excalidraw's export API
    // For now, using placeholder
    setThumbnail('/api/placeholder/200/150');
  };

  return (
    <div className="excalidraw-node bg-white rounded-lg shadow-lg overflow-hidden">
      <Handle type="target" position={Position.Top} />
      
      <div className="p-3 border-b flex justify-between items-center">
        <h3 className="font-medium">Drawing</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      
      <div className={`${isExpanded ? 'h-96' : 'h-48'} transition-all`}>
        {isExpanded ? (
          <ExcalidrawCanvas
            boardId={`node-${id}`}
            initialData={data.drawing}
            onSave={(elements) => {
              generateThumbnail(elements);
              // Update node data
            }}
          />
        ) : (
          <div className="p-4">
            {thumbnail ? (
              <img 
                src={thumbnail} 
                alt="Drawing preview" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <Pencil size={48} />
              </div>
            )}
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### 4. Collaborative Excalidraw with Yjs (src/components/CollaborativeExcalidraw.tsx)

```typescript
import { useEffect, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { collab } from '@excalidraw/excalidraw-embed';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useYjsProvider } from '../hooks/useYjsProvider';

export function CollaborativeExcalidraw({ roomId }: { roomId: string }) {
  const { ydoc, provider } = useYjsProvider(roomId, 'excalidraw');
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  useEffect(() => {
    if (!excalidrawAPI || !provider) return;

    // Initialize collaboration
    const portal = collab.initializeSocketIOCollaboration({
      excalidrawAPI,
      ydoc,
      provider,
      // Custom configuration
      onPointerUpdate: (payload) => {
        // Handle remote cursor updates
      },
    });

    return () => {
      portal.destroy();
    };
  }, [excalidrawAPI, provider, ydoc]);

  return (
    <Excalidraw
      ref={(api) => setExcalidrawAPI(api)}
      isCollaborating={true}
      onPointerUpdate={(payload) => {
        // Broadcast pointer position
        provider?.awareness.setLocalStateField('pointer', payload);
      }}
    />
  );
}
```

### 5. Drawing Tools Integration (src/components/DrawingTools.tsx)

```typescript
export function DrawingTools({ onToolSelect }: { onToolSelect: (tool: string) => void }) {
  const tools = [
    { id: 'selection', icon: MousePointer, label: 'Select' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'pencil', icon: Pencil, label: 'Free Draw' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'image', icon: Image, label: 'Image' },
  ];

  return (
    <div className="drawing-tools bg-white rounded-lg shadow-lg p-2 flex flex-col gap-1">
      {tools.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onToolSelect(id)}
          className="p-2 hover:bg-gray-100 rounded flex items-center gap-2"
          title={label}
        >
          <Icon size={20} />
        </button>
      ))}
    </div>
  );
}
```

### 6. Import/Export Handler (src/services/excalidrawService.ts)

```typescript
import { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import { AppState } from '@excalidraw/excalidraw/types/types';
import { exportToSvg, exportToBlob } from '@excalidraw/excalidraw';

export class ExcalidrawService {
  async exportDrawing(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    format: 'png' | 'svg' | 'json' = 'png'
  ) {
    switch (format) {
      case 'png':
        return await exportToBlob({
          elements,
          appState,
          mimeType: 'image/png',
          quality: 0.92,
        });
        
      case 'svg':
        return await exportToSvg({
          elements,
          appState,
          embedScene: true,
        });
        
      case 'json':
        return JSON.stringify({
          type: 'excalidraw',
          version: 2,
          source: 'ragboard',
          elements,
          appState,
        });
    }
  }

  async importDrawing(file: File): Promise<{ elements: ExcalidrawElement[]; appState: Partial<AppState> }> {
    const text = await file.text();
    
    try {
      const data = JSON.parse(text);
      if (data.type === 'excalidraw') {
        return {
          elements: data.elements || [],
          appState: data.appState || {},
        };
      }
    } catch (e) {
      throw new Error('Invalid Excalidraw file');
    }
    
    throw new Error('Unsupported file format');
  }

  convertToReactFlowNode(
    elements: readonly ExcalidrawElement[],
    position: { x: number; y: number }
  ) {
    // Convert Excalidraw drawing to ReactFlow node
    return {
      id: `excalidraw-${Date.now()}`,
      type: 'excalidraw',
      position,
      data: {
        drawing: {
          elements,
          appState: {},
        },
      },
    };
  }
}
```

### 7. Excalidraw Store Integration (src/store/boardStore.ts)

```typescript
interface BoardStore {
  // ... existing state
  drawings: Record<string, ExcalidrawData>;
  
  addDrawing: (boardId: string, drawing: ExcalidrawData) => void;
  updateDrawing: (boardId: string, drawing: ExcalidrawData) => void;
  deleteDrawing: (boardId: string) => void;
  exportAllDrawings: (boardId: string) => Promise<Blob>;
}

const useBoardStore = create<BoardStore>((set, get) => ({
  drawings: {},
  
  addDrawing: (boardId, drawing) =>
    set((state) => ({
      drawings: {
        ...state.drawings,
        [boardId]: drawing,
      },
    })),
    
  updateDrawing: (boardId, drawing) =>
    set((state) => ({
      drawings: {
        ...state.drawings,
        [boardId]: {
          ...state.drawings[boardId],
          ...drawing,
        },
      },
    })),
    
  exportAllDrawings: async (boardId) => {
    const { drawings } = get();
    const boardDrawing = drawings[boardId];
    
    if (!boardDrawing) return new Blob();
    
    const service = new ExcalidrawService();
    return await service.exportDrawing(
      boardDrawing.elements,
      boardDrawing.appState,
      'png'
    );
  },
}));
```

### 8. Annotation Layer (src/components/AnnotationLayer.tsx)

```typescript
import { useEffect, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';

export function AnnotationLayer({ 
  imageUrl, 
  onAnnotationComplete 
}: { 
  imageUrl: string; 
  onAnnotationComplete: (elements: any[]) => void;
}) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  useEffect(() => {
    if (!excalidrawAPI || !imageUrl) return;

    // Add image as background
    excalidrawAPI.addFiles([
      {
        id: 'background-image',
        dataURL: imageUrl,
        mimeType: 'image/png',
        created: Date.now(),
      },
    ]);

    // Create image element
    const imageElement = {
      type: 'image',
      id: 'background',
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      fileId: 'background-image',
      locked: true, // Prevent moving the background
    };

    excalidrawAPI.updateScene({
      elements: [imageElement],
    });
  }, [excalidrawAPI, imageUrl]);

  return (
    <div className="annotation-layer w-full h-full">
      <Excalidraw
        ref={(api) => setExcalidrawAPI(api)}
        UIOptions={{
          canvasActions: {
            loadScene: false,
          },
        }}
        onChange={(elements) => {
          // Filter out background image from annotations
          const annotations = elements.filter(el => el.id !== 'background');
          onAnnotationComplete(annotations);
        }}
      />
    </div>
  );
}
```

### 9. Backend Storage (backend/app/models/drawing.py)

```python
from sqlalchemy import Column, String, JSON, ForeignKey
from app.db.base import Base

class Drawing(Base):
    __tablename__ = "drawings"
    
    id = Column(String, primary_key=True)
    board_id = Column(String, ForeignKey("boards.id"))
    user_id = Column(String, ForeignKey("users.id"))
    elements = Column(JSON)  # Excalidraw elements
    app_state = Column(JSON)  # Excalidraw app state
    thumbnail_url = Column(String)
    
    # Relationships
    board = relationship("Board", back_populates="drawings")
    user = relationship("User")
```

### 10. Performance Optimization

```typescript
// Lazy load Excalidraw
const ExcalidrawCanvas = lazy(() => 
  import('./components/ExcalidrawCanvas').then(module => ({
    default: module.ExcalidrawCanvas
  }))
);

// Use virtualization for large drawings
import { FixedSizeList } from 'react-window';

export function DrawingGallery({ drawings }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={drawings.length}
      itemSize={200}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <DrawingThumbnail drawing={drawings[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

## Styling

```css
/* Excalidraw theme overrides */
.excalidraw-node .excalidraw {
  --color-primary: #3b82f6;
  --color-primary-darker: #2563eb;
  --color-primary-darkest: #1d4ed8;
}

.excalidraw-node.selected {
  box-shadow: 0 0 0 2px #3b82f6;
}

/* Custom toolbar styling */
.drawing-tools {
  position: fixed;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
}
```

## Testing

```typescript
describe('Excalidraw Integration', () => {
  it('saves drawing on change', async () => {
    const onSave = jest.fn();
    render(<ExcalidrawCanvas boardId="test" onSave={onSave} />);
    
    // Simulate drawing
    // Wait for debounce
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    }, { timeout: 2000 });
  });
  
  it('exports drawing as PNG', async () => {
    // Test export functionality
  });
});
```

## Migration Guide

1. **Add to existing boards**: Show mode switcher only if user has used Excalidraw
2. **Import existing drawings**: Support importing .excalidraw files
3. **Backward compatibility**: Keep ReactFlow as primary, Excalidraw as enhancement