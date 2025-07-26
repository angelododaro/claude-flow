import { useState, useEffect, useCallback, useRef } from 'react';
import wsService from '../services/websocket';

interface CollaborativeTextState {
  content: string;
  cursors: Map<string, { position: number; user: string; color: string }>;
  isConnected: boolean;
  collaborators: string[];
}

interface TextOperation {
  type: 'insert' | 'delete' | 'retain';
  content?: string;
  length?: number;
  position: number;
  userId: string;
  timestamp: number;
}

interface CollaborativeTextHook {
  content: string;
  cursors: Map<string, { position: number; user: string; color: string }>;
  isConnected: boolean;
  collaborators: string[];
  updateContent: (newContent: string, position?: number) => void;
  setCursorPosition: (position: number) => void;
  applyOperation: (operation: TextOperation) => void;
  disconnect: () => void;
}

export const useCollaborativeText = (
  nodeId: string,
  initialContent: string = '',
  userId: string
): CollaborativeTextHook => {
  const [state, setState] = useState<CollaborativeTextState>({
    content: initialContent,
    cursors: new Map(),
    isConnected: false,
    collaborators: [],
  });

  const operationQueue = useRef<TextOperation[]>([]);
  const localVersion = useRef(0);
  const serverVersion = useRef(0);

  // Transform operation against another operation (Operational Transform)
  const transformOperation = (op1: TextOperation, op2: TextOperation): TextOperation => {
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position <= op2.position) {
        return { ...op2, position: op2.position + (op1.content?.length || 0) };
      }
      return op2;
    }
    
    if (op1.type === 'delete' && op2.type === 'insert') {
      if (op1.position < op2.position) {
        return { ...op2, position: Math.max(op1.position, op2.position - (op1.length || 0)) };
      }
      return op2;
    }
    
    if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position <= op2.position) {
        return { ...op2, position: op2.position + (op1.content?.length || 0) };
      }
      return op2;
    }
    
    if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position < op2.position) {
        return { ...op2, position: Math.max(op1.position, op2.position - (op1.length || 0)) };
      }
      if (op1.position > op2.position) {
        return op2;
      }
      // Overlapping deletes - need more complex handling
      return op2;
    }
    
    return op2;
  };

  // Apply operation to content
  const applyOperationToContent = (content: string, operation: TextOperation): string => {
    switch (operation.type) {
      case 'insert':
        return content.slice(0, operation.position) + 
               (operation.content || '') + 
               content.slice(operation.position);
      case 'delete':
        return content.slice(0, operation.position) + 
               content.slice(operation.position + (operation.length || 0));
      case 'retain':
        return content;
      default:
        return content;
    }
  };

  // Send operation to server
  const sendOperation = useCallback((operation: TextOperation) => {
    if (wsService.isConnected()) {
      wsService.emit('text_operation', {
        nodeId,
        operation: {
          ...operation,
          clientVersion: localVersion.current,
        },
      });
      localVersion.current++;
    }
  }, [nodeId]);

  // Apply operation locally and to server
  const applyOperation = useCallback((operation: TextOperation) => {
    setState(prevState => {
      const newContent = applyOperationToContent(prevState.content, operation);
      return {
        ...prevState,
        content: newContent,
      };
    });

    if (operation.userId === userId) {
      sendOperation(operation);
    }
  }, [sendOperation, userId]);

  // Update content with operational transform
  const updateContent = useCallback((newContent: string, position: number = 0) => {
    const currentContent = state.content;
    
    if (newContent === currentContent) return;

    // Calculate the difference and create operations
    if (newContent.length > currentContent.length) {
      // Content was inserted
      const insertedText = newContent.slice(position, position + (newContent.length - currentContent.length));
      const operation: TextOperation = {
        type: 'insert',
        content: insertedText,
        position,
        userId,
        timestamp: Date.now(),
      };
      applyOperation(operation);
    } else if (newContent.length < currentContent.length) {
      // Content was deleted
      const deletedLength = currentContent.length - newContent.length;
      const operation: TextOperation = {
        type: 'delete',
        length: deletedLength,
        position,
        userId,
        timestamp: Date.now(),
      };
      applyOperation(operation);
    } else {
      // Content was replaced
      const operation: TextOperation = {
        type: 'delete',
        length: currentContent.length,
        position: 0,
        userId,
        timestamp: Date.now(),
      };
      applyOperation(operation);
      
      const insertOperation: TextOperation = {
        type: 'insert',
        content: newContent,
        position: 0,
        userId,
        timestamp: Date.now(),
      };
      applyOperation(insertOperation);
    }
  }, [state.content, userId, applyOperation]);

  // Set cursor position
  const setCursorPosition = useCallback((position: number) => {
    if (wsService.isConnected()) {
      wsService.emit('cursor_position', {
        nodeId,
        userId,
        position,
        timestamp: Date.now(),
      });
    }
  }, [nodeId, userId]);

  // Initialize collaborative session
  useEffect(() => {
    if (!wsService.isConnected()) {
      wsService.connect();
    }

    // Join collaborative editing session for this node
    wsService.emit('join_text_session', {
      nodeId,
      userId,
      initialContent: initialContent,
    });

    setState(prevState => ({
      ...prevState,
      isConnected: true,
    }));

    // Listen for remote operations
    const handleRemoteOperation = (data: {
      nodeId: string;
      operation: TextOperation & { clientVersion: number; serverVersion: number };
    }) => {
      if (data.nodeId !== nodeId || data.operation.userId === userId) return;

      // Transform remote operation against pending local operations
      let transformedOperation = data.operation;
      
      operationQueue.current.forEach(localOp => {
        transformedOperation = transformOperation(localOp, transformedOperation);
      });

      // Apply transformed operation
      setState(prevState => {
        const newContent = applyOperationToContent(prevState.content, transformedOperation);
        return {
          ...prevState,
          content: newContent,
        };
      });

      serverVersion.current = data.operation.serverVersion;
    };

    // Listen for cursor updates
    const handleCursorUpdate = (data: {
      nodeId: string;
      userId: string;
      position: number;
      user: string;
      color: string;
    }) => {
      if (data.nodeId !== nodeId || data.userId === userId) return;

      setState(prevState => ({
        ...prevState,
        cursors: new Map(prevState.cursors).set(data.userId, {
          position: data.position,
          user: data.user,
          color: data.color,
        }),
      }));
    };

    // Listen for collaborator updates
    const handleCollaboratorsUpdate = (data: {
      nodeId: string;
      collaborators: string[];
    }) => {
      if (data.nodeId !== nodeId) return;

      setState(prevState => ({
        ...prevState,
        collaborators: data.collaborators.filter(id => id !== userId),
      }));
    };

    // Listen for session state
    const handleSessionState = (data: {
      nodeId: string;
      content: string;
      version: number;
      collaborators: string[];
    }) => {
      if (data.nodeId !== nodeId) return;

      setState(prevState => ({
        ...prevState,
        content: data.content,
        collaborators: data.collaborators.filter(id => id !== userId),
      }));

      serverVersion.current = data.version;
      localVersion.current = data.version;
    };

    wsService.on('text_operation', handleRemoteOperation);
    wsService.on('cursor_position', handleCursorUpdate);
    wsService.on('collaborators_update', handleCollaboratorsUpdate);
    wsService.on('session_state', handleSessionState);

    return () => {
      wsService.off('text_operation', handleRemoteOperation);
      wsService.off('cursor_position', handleCursorUpdate);
      wsService.off('collaborators_update', handleCollaboratorsUpdate);
      wsService.off('session_state', handleSessionState);
      
      // Leave collaborative session
      wsService.emit('leave_text_session', { nodeId, userId });
    };
  }, [nodeId, userId, initialContent]);

  // Disconnect from collaborative session
  const disconnect = useCallback(() => {
    if (wsService.isConnected()) {
      wsService.emit('leave_text_session', { nodeId, userId });
    }
    
    setState(prevState => ({
      ...prevState,
      isConnected: false,
      cursors: new Map(),
      collaborators: [],
    }));
  }, [nodeId, userId]);

  return {
    content: state.content,
    cursors: state.cursors,
    isConnected: state.isConnected,
    collaborators: state.collaborators,
    updateContent,
    setCursorPosition,
    applyOperation,
    disconnect,
  };
};

export default useCollaborativeText;