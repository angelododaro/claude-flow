export type WebSocketEvent = 
  | 'resource.created'
  | 'resource.updated'
  | 'resource.deleted'
  | 'resource.processing'
  | 'resource.processed'
  | 'chat.message'
  | 'chat.connected'
  | 'board.updated'
  | 'connection.created'
  | 'connection.deleted'
  | 'cursor_update'
  | 'presence_join'
  | 'presence_leave'
  | 'presence_update'
  | 'board_update'
  | 'resource_update'
  | 'connection_update'
  | 'selection_update'
  | 'user_activity'
  | 'notification'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'max_reconnect_failed'
  | 'send_failed';

interface WebSocketMessage {
  event: WebSocketEvent;
  data: any;
  timestamp: string;
}

interface CursorPosition {
  x: number;
  y: number;
  user_id: string;
  user_name: string;
  color: string;
  timestamp: number;
}

interface UserPresence {
  user_id: string;
  user_name: string;
  status: 'active' | 'idle' | 'away';
  color: string;
  last_seen: number;
  cursor?: CursorPosition;
}

// Browser-compatible EventEmitter implementation
class EventEmitter {
  private events: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: number | null = null;
  private isConnected = false;
  private currentBoardId: string | null = null;
  private presenceMap: Map<string, UserPresence> = new Map();
  private activityTimeout: number | null = null;
  private lastActivity: number = Date.now();
  private isActive: boolean = true;

  constructor(private wsUrl: string = 'ws://localhost:8000/ws') {
    super();
  }

  connect(boardId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.currentBoardId === boardId) {
      console.log('WebSocket already connected to this board');
      return;
    }

    // Disconnect from previous board if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect();
    }

    this.currentBoardId = boardId;
    const token = localStorage.getItem('auth_token') || localStorage.getItem('access_token');
    
    if (!token) {
      console.error('No authentication token found. WebSocket connection cannot be established.');
      this.emit('error', { message: 'Authentication required for collaboration features' });
      return;
    }

    const url = `${this.wsUrl}/board/${boardId}?token=${encodeURIComponent(token)}`;

    try {
      console.log(`Connecting to WebSocket at: ${this.wsUrl}/board/${boardId}`);
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.emit('error', { message: 'Failed to establish WebSocket connection', error });
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message:', message);
        
        // Handle different message types
        switch (message.type) {
          case 'connection':
            // Update presence map with initial data
            if (message.data.presence) {
              this.presenceMap.clear();
              message.data.presence.forEach((presence: UserPresence) => {
                this.presenceMap.set(presence.user_id, presence);
              });
            }
            this.emit('connected', message.data);
            break;
            
          case 'presence_join':
            this.presenceMap.set(message.data.presence.user_id, message.data.presence);
            this.emit('presence_join', message.data);
            break;
            
          case 'presence_leave':
            this.presenceMap.delete(message.data.user_id);
            this.emit('presence_leave', message.data);
            break;
            
          case 'presence_update':
            this.presenceMap.set(message.data.user_id, message.data);
            this.emit('presence_update', message.data);
            break;
            
          case 'cursor_update':
            // Update cursor position in presence map
            const presence = this.presenceMap.get(message.data.user_id);
            if (presence) {
              presence.cursor = message.data;
              this.presenceMap.set(message.data.user_id, presence);
            }
            this.emit('cursor_update', message.data);
            break;
            
          case 'selection_update':
            this.emit('selection_update', message.data);
            break;
            
          case 'user_activity':
            this.emit('user_activity', message.data);
            break;
            
          case 'notification':
            this.emit('notification', message.data);
            break;
            
          default:
            this.emit(message.type, message.data);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.isConnected = false;
      this.stopHeartbeat();
      this.emit('disconnected');
      
      if (!event.wasClean) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Please refresh the page to restore collaboration.');
      this.emit('max_reconnect_failed', {
        message: 'Failed to reconnect after multiple attempts. Collaboration features disabled.',
        attempts: this.reconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000); // Cap at 30 seconds
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected && this.currentBoardId) {
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
        this.connect(this.currentBoardId);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping', {});
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(type: string, data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({ type, data });
        this.ws.send(message);
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        this.emit('send_failed', { type, data, error: error.message });
      }
    } else {
      console.warn(`WebSocket is not connected (state: ${this.ws?.readyState}). Cannot send message:`, { type, data });
      this.emit('send_failed', { 
        type, 
        data, 
        reason: this.ws?.readyState === WebSocket.CONNECTING ? 'connecting' : 'disconnected' 
      });
      
      // Attempt to reconnect if we have a board ID
      if (this.currentBoardId && this.ws?.readyState !== WebSocket.CONNECTING) {
        console.log('Attempting to reconnect due to failed send...');
        this.connect(this.currentBoardId);
      }
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    
    // Clear activity timeout
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
      this.activityTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.currentBoardId = null;
    this.presenceMap.clear();
    this.isActive = true;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Subscribe to specific events
  onResourceCreated(callback: (data: any) => void): void {
    this.on('resource.created', callback);
  }

  onResourceUpdated(callback: (data: any) => void): void {
    this.on('resource.updated', callback);
  }

  onResourceProcessing(callback: (data: any) => void): void {
    this.on('resource.processing', callback);
  }

  onResourceProcessed(callback: (data: any) => void): void {
    this.on('resource.processed', callback);
  }

  onChatMessage(callback: (data: any) => void): void {
    this.on('chat.message', callback);
  }

  onBoardUpdated(callback: (data: any) => void): void {
    this.on('board_update', callback);
  }

  // Cursor and presence methods
  sendCursorPosition(x: number, y: number): void {
    this.send('cursor_move', { x, y });
  }

  updatePresenceStatus(status: 'active' | 'idle' | 'away'): void {
    this.send('presence_update', { status });
  }

  sendBoardUpdate(data: any): void {
    this.send('board_update', data);
  }

  sendResourceUpdate(resourceId: string, updates: any): void {
    this.send('resource_update', { resource_id: resourceId, ...updates });
  }

  sendConnectionUpdate(connectionId: string, updates: any): void {
    this.send('connection_update', { connection_id: connectionId, ...updates });
  }

  sendSelectionUpdate(selection: any): void {
    this.send('selection_update', { selection });
  }

  sendActivity(activityType: string, details: any = {}): void {
    this.send('activity', { activity_type: activityType, details });
    this.updateActivity();
  }

  private updateActivity(): void {
    this.lastActivity = Date.now();
    
    // Clear previous timeout
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }
    
    // Mark as idle after 30 seconds of no activity
    this.activityTimeout = window.setTimeout(() => {
      if (this.isActive) {
        this.isActive = false;
        this.updatePresenceStatus('idle');
      }
    }, 30000);
    
    // If we were idle, mark as active
    if (!this.isActive) {
      this.isActive = true;
      this.updatePresenceStatus('active');
    }
  }

  // Enhanced presence methods
  onSelectionUpdate(callback: (data: any) => void): void {
    this.on('selection_update', callback);
  }

  onUserActivity(callback: (data: any) => void): void {
    this.on('user_activity', callback);
  }

  onNotification(callback: (data: any) => void): void {
    this.on('notification', callback);
  }

  getPresence(): Map<string, UserPresence> {
    return new Map(this.presenceMap);
  }

  onCursorUpdate(callback: (cursor: CursorPosition) => void): void {
    this.on('cursor_update', callback);
  }

  onPresenceJoin(callback: (data: any) => void): void {
    this.on('presence_join', callback);
  }

  onPresenceLeave(callback: (data: any) => void): void {
    this.on('presence_leave', callback);
  }

  onPresenceUpdate(callback: (presence: UserPresence) => void): void {
    this.on('presence_update', callback);
  }
}

// Create singleton instance
const wsService = new WebSocketService();

// Export types for external use
export type { CursorPosition, UserPresence };
export default wsService;