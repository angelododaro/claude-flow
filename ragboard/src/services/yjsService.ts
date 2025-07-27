import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import wsService from './websocket';

// Yjs document types for different data structures
export interface YjsNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
  width?: number;
  height?: number;
  selected?: boolean;
  dragging?: boolean;
}

export interface YjsEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  data?: any;
  selected?: boolean;
}

export interface YjsBoardData {
  nodes: Y.Array<YjsNode>;
  edges: Y.Array<YjsEdge>;
  boardMetadata: Y.Map<any>;
  selections: Y.Map<string[]>; // user_id -> selected node/edge ids
  cursors: Y.Map<{ x: number; y: number; timestamp: number }>; // user_id -> cursor position
}

class YjsCollaborationService {
  private ydoc: Y.Doc | null = null;
  private provider: WebsocketProvider | null = null;
  private boardId: string | null = null;
  private currentUserId: string | null = null;
  private isConnected: boolean = false;
  
  // Yjs data structures
  private nodes: Y.Array<YjsNode> | null = null;
  private edges: Y.Array<YjsEdge> | null = null;
  private boardMetadata: Y.Map<any> | null = null;
  private selections: Y.Map<string[]> | null = null;
  private cursors: Y.Map<{ x: number; y: number; timestamp: number }> | null = null;
  
  // Event listeners
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();
  
  // Batch update mechanism
  private batchTimeout: number | null = null;
  private pendingUpdates: Set<string> = new Set();

  async connect(boardId: string, userId: string, wsUrl?: string): Promise<void> {
    if (this.isConnected && this.boardId === boardId) {
      console.log('Already connected to this board');
      return;
    }

    // Disconnect from previous board if needed
    if (this.isConnected) {
      this.disconnect();
    }

    this.boardId = boardId;
    this.currentUserId = userId;

    // Create new Yjs document
    this.ydoc = new Y.Doc();
    
    // Initialize data structures
    this.nodes = this.ydoc.getArray<YjsNode>('nodes');
    this.edges = this.ydoc.getArray<YjsEdge>('edges');
    this.boardMetadata = this.ydoc.getMap('boardMetadata');
    this.selections = this.ydoc.getMap('selections');
    this.cursors = this.ydoc.getMap('cursors');

    // Set up WebSocket provider
    const websocketUrl = wsUrl || `ws://localhost:8000/yjs/${boardId}`;
    this.provider = new WebsocketProvider(websocketUrl, boardId, this.ydoc, {
      maxBackoffTime: 5000,
      awareness: {
        user: {
          id: userId,
          name: `User ${userId}`,
          color: this.generateUserColor(userId)
        }
      }
    });

    // Set up event listeners
    this.setupEventListeners();

    // Wait for initial sync
    await new Promise<void>((resolve) => {
      const checkSync = () => {
        if (this.provider?.synced) {
          this.isConnected = true;
          this.emit('connected', { boardId, userId });
          resolve();
        } else {
          setTimeout(checkSync, 100);
        }
      };
      checkSync();
    });

    console.log(`Connected to Yjs collaboration for board: ${boardId}`);
  }

  disconnect(): void {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    
    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
    }

    this.nodes = null;
    this.edges = null;
    this.boardMetadata = null;
    this.selections = null;
    this.cursors = null;
    this.isConnected = false;
    this.boardId = null;
    this.currentUserId = null;

    this.emit('disconnected');
    console.log('Disconnected from Yjs collaboration');
  }

  private setupEventListeners(): void {
    if (!this.ydoc || !this.nodes || !this.edges) return;

    // Listen for node changes
    this.nodes.observe((event) => {
      this.handleNodesChange(event);
    });

    // Listen for edge changes
    this.edges.observe((event) => {
      this.handleEdgesChange(event);
    });

    // Listen for selection changes
    this.selections?.observe((event) => {
      this.handleSelectionsChange(event);
    });

    // Listen for cursor changes
    this.cursors?.observe((event) => {
      this.handleCursorsChange(event);
    });

    // Listen for board metadata changes
    this.boardMetadata?.observe((event) => {
      this.handleBoardMetadataChange(event);
    });

    // Provider events
    this.provider?.on('status', (event: { status: string }) => {
      console.log('Yjs provider status:', event.status);
      this.emit('status', event.status);
    });

    this.provider?.on('sync', (isSynced: boolean) => {
      console.log('Yjs sync status:', isSynced);
      this.emit('sync', isSynced);
    });
  }

  // Node operations
  addNode(node: YjsNode): void {
    if (!this.nodes) return;
    
    this.ydoc?.transact(() => {
      this.nodes?.push([node]);
    });

    // Notify about activity
    wsService.sendActivity('editing', {
      action: 'node_added',
      node_id: node.id,
      node_type: node.type
    });
  }

  updateNode(nodeId: string, updates: Partial<YjsNode>): void {
    if (!this.nodes) return;

    this.ydoc?.transact(() => {
      const nodeIndex = this.findNodeIndex(nodeId);
      if (nodeIndex !== -1) {
        const currentNode = this.nodes?.get(nodeIndex);
        if (currentNode) {
          const updatedNode = { ...currentNode, ...updates };
          this.nodes?.delete(nodeIndex, 1);
          this.nodes?.insert(nodeIndex, [updatedNode]);
        }
      }
    });

    // Batch update notifications to prevent flooding
    this.batchActivityUpdate('node_updated', nodeId);
  }

  deleteNode(nodeId: string): void {
    if (!this.nodes) return;

    this.ydoc?.transact(() => {
      const nodeIndex = this.findNodeIndex(nodeId);
      if (nodeIndex !== -1) {
        this.nodes?.delete(nodeIndex, 1);
      }
    });

    wsService.sendActivity('editing', {
      action: 'node_deleted',
      node_id: nodeId
    });
  }

  // Edge operations
  addEdge(edge: YjsEdge): void {
    if (!this.edges) return;
    
    this.ydoc?.transact(() => {
      this.edges?.push([edge]);
    });

    wsService.sendActivity('editing', {
      action: 'edge_added',
      edge_id: edge.id,
      source: edge.source,
      target: edge.target
    });
  }

  updateEdge(edgeId: string, updates: Partial<YjsEdge>): void {
    if (!this.edges) return;

    this.ydoc?.transact(() => {
      const edgeIndex = this.findEdgeIndex(edgeId);
      if (edgeIndex !== -1) {
        const currentEdge = this.edges?.get(edgeIndex);
        if (currentEdge) {
          const updatedEdge = { ...currentEdge, ...updates };
          this.edges?.delete(edgeIndex, 1);
          this.edges?.insert(edgeIndex, [updatedEdge]);
        }
      }
    });

    this.batchActivityUpdate('edge_updated', edgeId);
  }

  deleteEdge(edgeId: string): void {
    if (!this.edges) return;

    this.ydoc?.transact(() => {
      const edgeIndex = this.findEdgeIndex(edgeId);
      if (edgeIndex !== -1) {
        this.edges?.delete(edgeIndex, 1);
      }
    });

    wsService.sendActivity('editing', {
      action: 'edge_deleted',
      edge_id: edgeId
    });
  }

  // Selection operations
  updateSelection(selectedIds: string[]): void {
    if (!this.selections || !this.currentUserId) return;

    this.selections.set(this.currentUserId, selectedIds);
    
    // Also send via WebSocket for immediate feedback
    wsService.sendSelectionUpdate({ selection: selectedIds });
  }

  // Cursor operations
  updateCursor(x: number, y: number): void {
    if (!this.cursors || !this.currentUserId) return;

    this.cursors.set(this.currentUserId, {
      x,
      y,
      timestamp: Date.now()
    });
  }

  // Board metadata operations
  updateBoardMetadata(key: string, value: any): void {
    if (!this.boardMetadata) return;
    
    this.boardMetadata.set(key, value);
  }

  // Getters
  getNodes(): YjsNode[] {
    return this.nodes?.toArray() || [];
  }

  getEdges(): YjsEdge[] {
    return this.edges?.toArray() || [];
  }

  getSelections(): Map<string, string[]> {
    const selections = new Map<string, string[]>();
    if (this.selections) {
      this.selections.forEach((value, key) => {
        selections.set(key, value);
      });
    }
    return selections;
  }

  getCursors(): Map<string, { x: number; y: number; timestamp: number }> {
    const cursors = new Map<string, { x: number; y: number; timestamp: number }>();
    if (this.cursors) {
      this.cursors.forEach((value, key) => {
        cursors.set(key, value);
      });
    }
    return cursors;
  }

  getBoardMetadata(): Map<string, any> {
    const metadata = new Map<string, any>();
    if (this.boardMetadata) {
      this.boardMetadata.forEach((value, key) => {
        metadata.set(key, value);
      });
    }
    return metadata;
  }

  // Utility methods
  private findNodeIndex(nodeId: string): number {
    if (!this.nodes) return -1;
    
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes.get(i)?.id === nodeId) {
        return i;
      }
    }
    return -1;
  }

  private findEdgeIndex(edgeId: string): number {
    if (!this.edges) return -1;
    
    for (let i = 0; i < this.edges.length; i++) {
      if (this.edges.get(i)?.id === edgeId) {
        return i;
      }
    }
    return -1;
  }

  private generateUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8C471'
    ];
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }

  private batchActivityUpdate(action: string, itemId: string): void {
    this.pendingUpdates.add(`${action}:${itemId}`);
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = window.setTimeout(() => {
      if (this.pendingUpdates.size > 0) {
        wsService.sendActivity('editing', {
          action: 'batch_update',
          updates: Array.from(this.pendingUpdates)
        });
        this.pendingUpdates.clear();
      }
      this.batchTimeout = null;
    }, 100); // Batch updates for 100ms
  }

  // Event handlers
  private handleNodesChange(event: Y.YArrayEvent<YjsNode>): void {
    const changes = {
      added: event.changes.added.map(item => item.content),
      deleted: event.changes.deleted.map(item => item.content),
      retained: event.changes.delta
    };
    
    this.emit('nodesChange', {
      nodes: this.getNodes(),
      changes
    });
  }

  private handleEdgesChange(event: Y.YArrayEvent<YjsEdge>): void {
    const changes = {
      added: event.changes.added.map(item => item.content),
      deleted: event.changes.deleted.map(item => item.content),
      retained: event.changes.delta
    };
    
    this.emit('edgesChange', {
      edges: this.getEdges(),
      changes
    });
  }

  private handleSelectionsChange(event: Y.YMapEvent<string[]>): void {
    this.emit('selectionsChange', this.getSelections());
  }

  private handleCursorsChange(event: Y.YMapEvent<{ x: number; y: number; timestamp: number }>): void {
    this.emit('cursorsChange', this.getCursors());
  }

  private handleBoardMetadataChange(event: Y.YMapEvent<any>): void {
    this.emit('boardMetadataChange', this.getBoardMetadata());
  }

  // Event emitter methods
  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Status getters
  isConnectedToBoard(): boolean {
    return this.isConnected;
  }

  getCurrentBoardId(): string | null {
    return this.boardId;
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  getConnectionStatus(): string {
    return this.provider?.ws?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected';
  }
}

// Global service instance
const yjsService = new YjsCollaborationService();

export default yjsService;