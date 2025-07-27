import { useEffect, useCallback, useRef, useState } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import yjsService, { YjsNode, YjsEdge } from '../services/yjsService';
import { useAuthContext } from '../contexts/AuthContext';

interface UseYjsCollaborationProps {
  boardId: string;
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}

interface CollaborationState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  collaborators: Map<string, any>;
  selections: Map<string, string[]>;
}

export const useYjsCollaboration = ({
  boardId,
  onNodesChange,
  onEdgesChange,
  initialNodes = [],
  initialEdges = []
}: UseYjsCollaborationProps) => {
  const { user } = useAuthContext();
  const reactFlow = useReactFlow();
  
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    isLoading: true,
    error: null,
    collaborators: new Map(),
    selections: new Map()
  });
  
  // Track if we're in the middle of applying remote changes
  const isApplyingRemoteChanges = useRef(false);
  const hasInitialized = useRef(false);
  
  // Convert between ReactFlow and Yjs formats
  const convertToYjsNode = useCallback((node: Node): YjsNode => ({
    id: node.id,
    type: node.type || 'default',
    position: node.position,
    data: node.data || {},
    width: node.width,
    height: node.height,
    selected: node.selected,
    dragging: node.dragging
  }), []);
  
  const convertFromYjsNode = useCallback((yjsNode: YjsNode): Node => ({
    id: yjsNode.id,
    type: yjsNode.type,
    position: yjsNode.position,
    data: yjsNode.data,
    width: yjsNode.width,
    height: yjsNode.height,
    selected: yjsNode.selected,
    dragging: yjsNode.dragging
  }), []);
  
  const convertToYjsEdge = useCallback((edge: Edge): YjsEdge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type,
    data: edge.data || {},
    selected: edge.selected
  }), []);
  
  const convertFromYjsEdge = useCallback((yjsEdge: YjsEdge): Edge => ({
    id: yjsEdge.id,
    source: yjsEdge.source,
    target: yjsEdge.target,
    sourceHandle: yjsEdge.sourceHandle,
    targetHandle: yjsEdge.targetHandle,
    type: yjsEdge.type,
    data: yjsEdge.data,
    selected: yjsEdge.selected
  }), []);
  
  // Initialize Yjs connection
  useEffect(() => {
    if (!user?.id || !boardId) return;
    
    const initializeCollaboration = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        
        // Connect to Yjs
        await yjsService.connect(boardId, user.id);
        
        setState(prev => ({ ...prev, isConnected: true, isLoading: false }));
        
        // Initialize with existing data if document is empty
        const existingNodes = yjsService.getNodes();
        const existingEdges = yjsService.getEdges();
        
        if (existingNodes.length === 0 && initialNodes.length > 0) {
          // Populate document with initial data
          initialNodes.forEach(node => {
            yjsService.addNode(convertToYjsNode(node));
          });
        }
        
        if (existingEdges.length === 0 && initialEdges.length > 0) {
          initialEdges.forEach(edge => {
            yjsService.addEdge(convertToYjsEdge(edge));
          });
        }
        
        hasInitialized.current = true;
        
      } catch (error) {
        console.error('Failed to initialize Yjs collaboration:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to connect to collaboration service',
          isLoading: false 
        }));
      }
    };
    
    initializeCollaboration();
    
    return () => {
      if (yjsService.isConnectedToBoard()) {
        yjsService.disconnect();
      }
      hasInitialized.current = false;
    };
  }, [boardId, user?.id, initialNodes, initialEdges, convertToYjsNode, convertToYjsEdge]);
  
  // Handle Yjs events
  useEffect(() => {
    const handleNodesChange = ({ nodes }: { nodes: YjsNode[] }) => {
      if (!hasInitialized.current) return;
      
      isApplyingRemoteChanges.current = true;
      const reactFlowNodes = nodes.map(convertFromYjsNode);
      onNodesChange(reactFlowNodes);
      
      // Allow some time for React Flow to process the changes
      setTimeout(() => {
        isApplyingRemoteChanges.current = false;
      }, 100);
    };
    
    const handleEdgesChange = ({ edges }: { edges: YjsEdge[] }) => {
      if (!hasInitialized.current) return;
      
      isApplyingRemoteChanges.current = true;
      const reactFlowEdges = edges.map(convertFromYjsEdge);
      onEdgesChange(reactFlowEdges);
      
      setTimeout(() => {
        isApplyingRemoteChanges.current = false;
      }, 100);
    };
    
    const handleSelectionsChange = (selections: Map<string, string[]>) => {
      setState(prev => ({ ...prev, selections }));
    };
    
    const handleConnected = () => {
      setState(prev => ({ ...prev, isConnected: true }));
    };
    
    const handleDisconnected = () => {
      setState(prev => ({ ...prev, isConnected: false }));
    };
    
    // Subscribe to Yjs events
    yjsService.on('nodesChange', handleNodesChange);
    yjsService.on('edgesChange', handleEdgesChange);
    yjsService.on('selectionsChange', handleSelectionsChange);
    yjsService.on('connected', handleConnected);
    yjsService.on('disconnected', handleDisconnected);
    
    return () => {
      yjsService.off('nodesChange', handleNodesChange);
      yjsService.off('edgesChange', handleEdgesChange);
      yjsService.off('selectionsChange', handleSelectionsChange);
      yjsService.off('connected', handleConnected);
      yjsService.off('disconnected', handleDisconnected);
    };
  }, [convertFromYjsNode, convertFromYjsEdge, onNodesChange, onEdgesChange]);
  
  // Collaboration methods
  const addNode = useCallback((node: Node) => {
    if (isApplyingRemoteChanges.current || !hasInitialized.current) return;
    yjsService.addNode(convertToYjsNode(node));
  }, [convertToYjsNode]);
  
  const updateNode = useCallback((nodeId: string, updates: Partial<Node>) => {
    if (isApplyingRemoteChanges.current || !hasInitialized.current) return;
    
    // Convert ReactFlow updates to Yjs format
    const yjsUpdates: Partial<YjsNode> = {};
    
    if (updates.position) yjsUpdates.position = updates.position;
    if (updates.data !== undefined) yjsUpdates.data = updates.data;
    if (updates.width !== undefined) yjsUpdates.width = updates.width;
    if (updates.height !== undefined) yjsUpdates.height = updates.height;
    if (updates.selected !== undefined) yjsUpdates.selected = updates.selected;
    if (updates.dragging !== undefined) yjsUpdates.dragging = updates.dragging;
    
    yjsService.updateNode(nodeId, yjsUpdates);
  }, []);
  
  const deleteNode = useCallback((nodeId: string) => {
    if (isApplyingRemoteChanges.current || !hasInitialized.current) return;
    yjsService.deleteNode(nodeId);
  }, []);
  
  const addEdge = useCallback((edge: Edge) => {
    if (isApplyingRemoteChanges.current || !hasInitialized.current) return;
    yjsService.addEdge(convertToYjsEdge(edge));
  }, [convertToYjsEdge]);
  
  const updateEdge = useCallback((edgeId: string, updates: Partial<Edge>) => {
    if (isApplyingRemoteChanges.current || !hasInitialized.current) return;
    
    const yjsUpdates: Partial<YjsEdge> = {};
    
    if (updates.source) yjsUpdates.source = updates.source;
    if (updates.target) yjsUpdates.target = updates.target;
    if (updates.sourceHandle !== undefined) yjsUpdates.sourceHandle = updates.sourceHandle;
    if (updates.targetHandle !== undefined) yjsUpdates.targetHandle = updates.targetHandle;
    if (updates.type !== undefined) yjsUpdates.type = updates.type;
    if (updates.data !== undefined) yjsUpdates.data = updates.data;
    if (updates.selected !== undefined) yjsUpdates.selected = updates.selected;
    
    yjsService.updateEdge(edgeId, yjsUpdates);
  }, []);
  
  const deleteEdge = useCallback((edgeId: string) => {
    if (isApplyingRemoteChanges.current || !hasInitialized.current) return;
    yjsService.deleteEdge(edgeId);
  }, []);
  
  const updateSelection = useCallback((selectedIds: string[]) => {
    if (isApplyingRemoteChanges.current || !hasInitialized.current) return;
    yjsService.updateSelection(selectedIds);
  }, []);
  
  const updateCursor = useCallback((x: number, y: number) => {
    if (!hasInitialized.current) return;
    yjsService.updateCursor(x, y);
  }, []);
  
  // Batch operations for better performance
  const batchNodeUpdates = useCallback((updates: Array<{ nodeId: string; updates: Partial<Node> }>) => {
    if (isApplyingRemoteChanges.current || !hasInitialized.current) return;
    
    updates.forEach(({ nodeId, updates: nodeUpdates }) => {
      updateNode(nodeId, nodeUpdates);
    });
  }, [updateNode]);
  
  const batchEdgeUpdates = useCallback((updates: Array<{ edgeId: string; updates: Partial<Edge> }>) => {
    if (isApplyingRemoteChanges.current || !hasInitialized.current) return;
    
    updates.forEach(({ edgeId, updates: edgeUpdates }) => {
      updateEdge(edgeId, edgeUpdates);
    });
  }, [updateEdge]);
  
  // Utility methods
  const getCollaborationState = useCallback(() => ({
    ...state,
    userCount: state.collaborators.size,
    isOwner: user?.id === boardId, // Simplified ownership check
  }), [state, user?.id, boardId]);
  
  const syncWithRemote = useCallback(async () => {
    if (!yjsService.isConnectedToBoard()) {
      try {
        await yjsService.connect(boardId, user?.id || '');
      } catch (error) {
        console.error('Failed to sync with remote:', error);
      }
    }
  }, [boardId, user?.id]);
  
  return {
    // State
    ...state,
    isInitialized: hasInitialized.current,
    
    // Node operations
    addNode,
    updateNode,
    deleteNode,
    batchNodeUpdates,
    
    // Edge operations
    addEdge,
    updateEdge,
    deleteEdge,
    batchEdgeUpdates,
    
    // Collaboration
    updateSelection,
    updateCursor,
    
    // Utilities
    getCollaborationState,
    syncWithRemote,
    
    // Raw service access for advanced use cases
    yjsService
  };
};