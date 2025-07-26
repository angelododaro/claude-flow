import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow
} from '@xyflow/react';
import { useBoardStore } from '../store/boardStore';
import { ResourceNode } from './ResourceNode';
import { AIChatNode } from './AIChatNode';
import { FolderNode } from './FolderNode';
import { TextNode } from './TextNode';
import URLNode from './URLNode';
import { FrameNode } from './FrameNode';
import { ConnectionLine } from './ConnectionLine';
import { SidebarMenu } from './SidebarMenu';
import { AddResourceModal } from './AddResourceModal';
import { EmptyState } from './EmptyState';
import { AIChatFloating } from './AIChatFloating';
import { AIChatFullScreen } from './AIChatFullScreen';
import { AIChatFullScreenNew } from './AIChatFullScreenNew';
import { AIChatMinimized } from './AIChatMinimized';
import { BoardHeader } from './BoardHeader';
import { EnhancedMiniMap } from './EnhancedMiniMap';
import { SceneNavigator } from './SceneNavigator';
import { useUndoRedo, createNodeCommand, deleteNodeCommand, moveNodeCommand, updateNodeCommand } from '../hooks/useUndoRedo';
import { useKeyboardShortcuts, createCanvasShortcuts } from '../hooks/useKeyboardShortcuts';
import CursorTracker from './CursorTracker';
import PresenceIndicator from './PresenceIndicator';
import wsService from '../services/websocket';
import { Header } from './Header';
import { Resource, Folder, Connection, Node, Edge, FlowConnection, NodeTypes, EdgeTypes } from '../types';

// Define custom node types
const nodeTypes: NodeTypes = {
  resourceNode: ResourceNode,
  aiChatNode: AIChatNode,
  folderNode: FolderNode,
  textNode: TextNode,
  urlNode: URLNode,
  frameNode: FrameNode,
};

// Define custom edge types
const edgeTypes: EdgeTypes = {
  default: ConnectionLine,
};

interface Scene {
  id: string;
  name: string;
  position: { x: number; y: number; zoom: number };
  thumbnail?: string;
  createdAt: Date;
  nodeCount?: number;
}

export const BoardCanvas: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<'closed' | 'minimized' | 'floating' | 'fullscreen'>('closed');
  const [boardId] = useState(() => new URLSearchParams(window.location.search).get('board_id') || 'default');
  const [boardName, setBoardName] = useState('Untitled Board');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<Node[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [currentUserId] = useState(() => 'user-' + Math.random().toString(36).substr(2, 9));
  const [isCollaborationEnabled, setIsCollaborationEnabled] = useState(false);
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  
  // Undo/Redo functionality
  const undoRedo = useUndoRedo<Node>();

  // Initialize WebSocket connection for real-time collaboration
  useEffect(() => {
    wsService.connect(boardId);
    setIsCollaborationEnabled(true);
    
    // Set up WebSocket event listeners for board updates
    const handleBoardUpdate = (data: any) => {
      console.log('Board update received:', data);
      // Handle real-time board state updates
      if (data.resources) {
        // Update resources state with incoming changes
        // This would need integration with the board store
      }
      if (data.connections) {
        // Update connections/edges
      }
    };

    const handleResourceUpdate = (data: any) => {
      console.log('Resource update received:', data);
      if (data.resource_id && data.position) {
        // Update specific resource position
        updateResource(data.resource_id, { position: data.position });
      }
    };

    const handleConnectionUpdate = (data: any) => {
      console.log('Connection update received:', data);
      // Handle connection updates
    };
    
    // Set up legacy event listeners for backward compatibility
    wsService.onResourceCreated((data) => {
      console.log('Resource created:', data);
      // Refresh resources or add new resource to state
    });
    
    wsService.onResourceProcessed((data) => {
      console.log('Resource processed:', data);
      // Update resource with processed data
    });

    // Set up collaboration event listeners
    wsService.onBoardUpdated(handleBoardUpdate);
    wsService.on('resource_update', handleResourceUpdate);
    wsService.on('connection_update', handleConnectionUpdate);
    
    return () => {
      wsService.disconnect();
      setIsCollaborationEnabled(false);
    };
  }, [boardId, updateResource]);

  const {
    resources,
    aiChats,
    addResource,
    updateResource,
    deleteResource,
    createAIChat,
    toggleFolder,
    addConnection,
    connectResourceToChat,
  } = useBoardStore();

  // Convert store data to ReactFlow nodes
  React.useEffect(() => {
    const resourceNodes: Node[] = Array.from(resources.values()).map((resource) => ({
      id: resource.id,
      type: resource.type === 'folder' ? 'folderNode' : 
            resource.type === 'text' ? 'textNode' : 
            resource.type === 'url' ? 'urlNode' : 'resourceNode',
      position: resource.position,
      data: {
        ...resource,
        onDelete: deleteResource,
        onToggle: resource.type === 'folder' ? toggleFolder : undefined,
      },
    }));

    const chatNodes: Node[] = Array.from(aiChats.values()).map((chat) => ({
      id: chat.id,
      type: 'aiChatNode',
      position: chat.position,
      data: {
        ...chat,
        onClick: (id: string) => {
          setSelectedChatId(id);
          setChatMode('floating');
        },
      },
    }));

    setNodes([...resourceNodes, ...chatNodes]);
  }, [resources, aiChats, deleteResource, toggleFolder, setNodes]);

  // Handle connections
  const onConnect = useCallback(
    (params: FlowConnection) => {
      if (!params.source || !params.target) return;

      // Check if connecting to AI chat
      const targetChat = aiChats.get(params.target);
      if (targetChat) {
        connectResourceToChat(params.target, params.source);
      }

      // Add visual connection
      setEdges((eds) => addEdge({ ...params, type: 'default' }, eds));
      addConnection({
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle || undefined,
        targetHandle: params.targetHandle || undefined,
      });
    },
    [aiChats, connectResourceToChat, addConnection, setEdges]
  );

  // Handle node drag with undo/redo
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
      const oldPositions = draggedNodes.map(n => {
        const oldNode = nodes.find(existing => existing.id === n.id);
        return { id: n.id, position: oldNode?.position || { x: 0, y: 0 } };
      });
      
      // Update positions
      draggedNodes.forEach(draggedNode => {
        updateResource(draggedNode.id, { position: draggedNode.position });
      });
      
      // Create undo command for multiple nodes
      if (draggedNodes.length === 1) {
        const oldPosition = oldPositions[0];
        const command = moveNodeCommand(
          node.id,
          oldPosition.position,
          node.position,
          (nodeId, position) => updateResource(nodeId, { position })
        );
        undoRedo.execute(command);
      }
    },
    [updateResource, nodes, undoRedo]
  );

  // Handle adding resources with undo/redo
  const handleAddResource = useCallback((type: string) => {
    if (type === 'chat') {
      // Create AI chat node
      const chatId = createAIChat({ x: 300, y: 300 });
      setSelectedChatId(chatId);
      setChatMode('minimized');
    } else if (type === 'folder') {
      // Create folder
      const folder: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'> & { type: 'folder'; isExpanded: boolean; children: string[] } = {
        type: 'folder',
        title: 'New Folder',
        position: { x: 200, y: 200 },
        isExpanded: true,
        children: [],
      };
      const resourceId = addResource(folder);
      
      // Create undo command
      const command = createNodeCommand(
        { id: resourceId, ...folder } as any,
        () => addResource(folder),
        (nodeId) => deleteResource(nodeId)
      );
      undoRedo.execute(command);
    } else if (type === 'text') {
      // Create text box directly on board
      const textBox: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'text',
        title: 'New Text',
        position: { x: Math.random() * 500 + 100, y: Math.random() * 300 + 100 },
        metadata: {
          content: 'Double-click to edit this text...',
        },
      };
      const resourceId = addResource(textBox);
      
      // Create undo command
      const command = createNodeCommand(
        { id: resourceId, ...textBox } as any,
        () => addResource(textBox),
        (nodeId) => deleteResource(nodeId)
      );
      undoRedo.execute(command);
    } else if (type === 'frame') {
      // Create frame
      const frame: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'frame' as any,
        title: 'New Frame',
        position: { x: 200, y: 200 },
        metadata: {
          width: 400,
          height: 300,
          children: [],
        },
      };
      const resourceId = addResource(frame);
      
      // Create undo command
      const command = createNodeCommand(
        { id: resourceId, ...frame } as any,
        () => addResource(frame),
        (nodeId) => deleteResource(nodeId)
      );
      undoRedo.execute(command);
    } else {
      // Open modal for other types
      setModalType(type);
      setModalOpen(true);
    }
  }, [createAIChat, addResource, deleteResource, setSelectedChatId, setChatMode, undoRedo]);

  // Handle modal add with undo/redo
  const handleModalAdd = useCallback((data: any) => {
    const resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'> = {
      ...data,
      position: { x: Math.random() * 500 + 100, y: Math.random() * 300 + 100 },
    };
    const resourceId = addResource(resource);
    
    // Create undo command
    const command = createNodeCommand(
      { id: resourceId, ...resource } as any,
      () => addResource(resource),
      (nodeId) => deleteResource(nodeId)
    );
    undoRedo.execute(command);
  }, [addResource, deleteResource, undoRedo]);

  // Handle drop
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = {
        x: event.clientX,
        y: event.clientY,
      };

      const newResource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'> = {
        type: type as any,
        title: `New ${type}`,
        position,
      };

      addResource(newResource);
    },
    [addResource]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Enhanced keyboard shortcuts and actions
  const deleteSelectedNodes = useCallback(() => {
    selectedNodes.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        const command = deleteNodeCommand(
          node,
          (id) => deleteResource(id),
          (restoredNode) => {
            // This would need proper restoration logic
            console.log('Restore node:', restoredNode);
          }
        );
        undoRedo.execute(command);
      }
    });
    setSelectedNodes([]);
  }, [selectedNodes, nodes, deleteResource, undoRedo]);

  const selectAllNodes = useCallback(() => {
    setSelectedNodes(nodes.map(n => n.id));
  }, [nodes]);

  const copySelectedNodes = useCallback(() => {
    const nodesToCopy = nodes.filter(n => selectedNodes.includes(n.id));
    setClipboard([...nodesToCopy]);
  }, [nodes, selectedNodes]);

  const pasteNodes = useCallback(() => {
    clipboard.forEach((node, index) => {
      const newResource = {
        ...node.data,
        position: {
          x: node.position.x + 50 + (index * 20),
          y: node.position.y + 50 + (index * 20),
        },
      };
      const resourceId = addResource(newResource);
      
      const command = createNodeCommand(
        { id: resourceId, ...newResource } as any,
        () => addResource(newResource),
        (nodeId) => deleteResource(nodeId)
      );
      undoRedo.execute(command);
    });
  }, [clipboard, addResource, deleteResource, undoRedo]);

  const cutSelectedNodes = useCallback(() => {
    copySelectedNodes();
    deleteSelectedNodes();
  }, [copySelectedNodes, deleteSelectedNodes]);

  // Scene management
  const handleSceneCreate = useCallback((scene: Omit<Scene, 'id' | 'createdAt'>) => {
    const newScene: Scene = {
      ...scene,
      id: `scene-${Date.now()}`,
      createdAt: new Date(),
    };
    setScenes(prev => [...prev, newScene]);
  }, []);

  const handleSceneDelete = useCallback((sceneId: string) => {
    setScenes(prev => prev.filter(s => s.id !== sceneId));
    if (currentSceneId === sceneId) {
      setCurrentSceneId(null);
    }
  }, [currentSceneId]);

  const handleSceneUpdate = useCallback((sceneId: string, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updates } : s));
  }, []);

  const handleSceneSelect = useCallback((sceneId: string) => {
    setCurrentSceneId(sceneId);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: createCanvasShortcuts({
      undo: undoRedo.canUndo ? undoRedo.undo : undefined,
      redo: undoRedo.canRedo ? undoRedo.redo : undefined,
      deleteSelected: selectedNodes.length > 0 ? deleteSelectedNodes : undefined,
      selectAll: selectAllNodes,
      copy: selectedNodes.length > 0 ? copySelectedNodes : undefined,
      paste: clipboard.length > 0 ? pasteNodes : undefined,
      cut: selectedNodes.length > 0 ? cutSelectedNodes : undefined,
      zoomIn: () => reactFlowInstance.zoomIn(),
      zoomOut: () => reactFlowInstance.zoomOut(),
      fitView: () => reactFlowInstance.fitView(),
      addTextNode: () => handleAddResource('text'),
      addFolderNode: () => handleAddResource('folder'),
      addChatNode: () => handleAddResource('chat'),
    }),
    enabled: true,
  });

  // Node selection
  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    setSelectedNodes(nodes.map(n => n.id));
  }, []);

  return (
    <div className="w-full h-screen bg-gray-50 relative">
      {/* Board Header */}
      <BoardHeader
        boardName={boardName}
        onBoardNameChange={setBoardName}
      />
      
      <div className="pt-14 h-full">
        <SidebarMenu onAddResource={handleAddResource} />
        
        <div className="ml-16 h-full" ref={reactFlowWrapper}>
          <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          multiSelectionKeyCode="Shift"
          deleteKeyCode="Delete"
        >
          <Background variant="dots" gap={20} size={1} />
          <Controls />
          <EnhancedMiniMap />
          </ReactFlow>
          
          {/* Real-time collaboration features */}
          {isCollaborationEnabled && (
            <>
              <CursorTracker 
                containerRef={reactFlowWrapper}
                currentUserId={currentUserId}
              />
              <PresenceIndicator currentUserId={currentUserId} />
            </>
          )}
          
          {/* Scene Navigator */}
          <SceneNavigator
            scenes={scenes}
            currentSceneId={currentSceneId}
            onSceneCreate={handleSceneCreate}
            onSceneDelete={handleSceneDelete}
            onSceneUpdate={handleSceneUpdate}
            onSceneSelect={handleSceneSelect}
          />
        </div>
      </div>

      <AddResourceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleModalAdd}
        type={modalType}
      />
      
      {/* Chat Components */}
      {selectedChatId && chatMode === 'minimized' && (
        <AIChatMinimized
          chatId={selectedChatId}
          onFullScreen={() => setChatMode('floating')}
          onClose={() => {
            setChatMode('closed');
            setSelectedChatId(null);
          }}
        />
      )}
      
      {selectedChatId && chatMode === 'floating' && (
        <AIChatFloating
          chatId={selectedChatId}
          onClose={() => {
            setChatMode('closed');
            setSelectedChatId(null);
          }}
          onFullScreen={() => setChatMode('fullscreen')}
        />
      )}
      
      {selectedChatId && chatMode === 'fullscreen' && (
        <AIChatFullScreenNew
          chatId={selectedChatId}
          onClose={() => {
            setChatMode('closed');
            setSelectedChatId(null);
          }}
          onMinimize={() => setChatMode('minimized')}
        />
      )}
    </div>
  );
};