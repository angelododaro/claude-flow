import { useCallback, useRef, useState } from 'react';
import * as Y from 'yjs';
import yjsService from '../services/yjsService';

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  stackSize: number;
  position: number;
}

interface UseYjsHistoryProps {
  maxStackSize?: number;
  captureTimeout?: number;
}

export const useYjsHistory = ({
  maxStackSize = 100,
  captureTimeout = 500
}: UseYjsHistoryProps = {}) => {
  const [historyState, setHistoryState] = useState<HistoryState>({
    canUndo: false,
    canRedo: false,
    stackSize: 0,
    position: 0
  });

  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const captureTimeoutRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize undo manager when Yjs service is connected
  const initializeHistory = useCallback(() => {
    if (isInitializedRef.current || !yjsService.isConnectedToBoard()) {
      return;
    }

    try {
      // Get Yjs document and arrays
      const ydoc = (yjsService as any).ydoc;
      const nodes = (yjsService as any).nodes;
      const edges = (yjsService as any).edges;
      const boardMetadata = (yjsService as any).boardMetadata;

      if (!ydoc || !nodes || !edges) {
        console.warn('Yjs document not ready for history initialization');
        return;
      }

      // Create undo manager for collaborative structures
      undoManagerRef.current = new Y.UndoManager([nodes, edges, boardMetadata], {
        captureTimeout,
        deleteFilter: () => true, // Allow all deletions to be undoable
      });

      // Listen for stack changes
      const updateHistoryState = () => {
        if (undoManagerRef.current) {
          setHistoryState({
            canUndo: undoManagerRef.current.undoStack.length > 0,
            canRedo: undoManagerRef.current.redoStack.length > 0,
            stackSize: undoManagerRef.current.undoStack.length + undoManagerRef.current.redoStack.length,
            position: undoManagerRef.current.undoStack.length
          });
        }
      };

      // Set up event listeners
      undoManagerRef.current.on('stack-item-added', updateHistoryState);
      undoManagerRef.current.on('stack-item-popped', updateHistoryState);
      undoManagerRef.current.on('stack-cleared', updateHistoryState);

      // Initial state update
      updateHistoryState();
      isInitializedRef.current = true;

      console.log('Yjs history manager initialized');
    } catch (error) {
      console.error('Failed to initialize Yjs history:', error);
    }
  }, [captureTimeout]);

  // Cleanup history manager
  const cleanupHistory = useCallback(() => {
    if (undoManagerRef.current) {
      undoManagerRef.current.destroy();
      undoManagerRef.current = null;
    }
    
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }

    isInitializedRef.current = false;
    setHistoryState({
      canUndo: false,
      canRedo: false,
      stackSize: 0,
      position: 0
    });
  }, []);

  // Perform undo operation
  const undo = useCallback(() => {
    if (!undoManagerRef.current || !historyState.canUndo) {
      console.warn('Cannot undo: no undo manager or nothing to undo');
      return false;
    }

    try {
      undoManagerRef.current.undo();
      return true;
    } catch (error) {
      console.error('Failed to undo:', error);
      return false;
    }
  }, [historyState.canUndo]);

  // Perform redo operation
  const redo = useCallback(() => {
    if (!undoManagerRef.current || !historyState.canRedo) {
      console.warn('Cannot redo: no undo manager or nothing to redo');
      return false;
    }

    try {
      undoManagerRef.current.redo();
      return true;
    } catch (error) {
      console.error('Failed to redo:', error);
      return false;
    }
  }, [historyState.canRedo]);

  // Clear all history
  const clearHistory = useCallback(() => {
    if (!undoManagerRef.current) {
      return;
    }

    try {
      undoManagerRef.current.clear();
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }, []);

  // Manually capture current state (useful for explicit checkpoints)
  const captureState = useCallback(() => {
    if (!undoManagerRef.current) {
      return;
    }

    try {
      // Capture timeout forces a new undo stack item
      undoManagerRef.current.stopCapturing();
    } catch (error) {
      console.error('Failed to capture state:', error);
    }
  }, []);

  // Start capturing changes (resume after stop)
  const startCapturing = useCallback(() => {
    if (!undoManagerRef.current) {
      return;
    }

    try {
      (undoManagerRef.current as any).capturing = true;
    } catch (error) {
      console.error('Failed to start capturing:', error);
    }
  }, []);

  // Stop capturing changes temporarily
  const stopCapturing = useCallback(() => {
    if (!undoManagerRef.current) {
      return;
    }

    try {
      undoManagerRef.current.stopCapturing();
    } catch (error) {
      console.error('Failed to stop capturing:', error);
    }
  }, []);

  // Get history stack information
  const getHistoryInfo = useCallback(() => {
    if (!undoManagerRef.current) {
      return {
        undoStack: [],
        redoStack: [],
        totalOperations: 0
      };
    }

    return {
      undoStack: undoManagerRef.current.undoStack.length,
      redoStack: undoManagerRef.current.redoStack.length,
      totalOperations: undoManagerRef.current.undoStack.length + undoManagerRef.current.redoStack.length
    };
  }, []);

  // Batch operations (prevent intermediate undo steps)
  const withBatch = useCallback(async (operation: () => Promise<void> | void) => {
    if (!undoManagerRef.current) {
      await operation();
      return;
    }

    try {
      stopCapturing();
      await operation();
      captureState();
    } catch (error) {
      console.error('Error in batched operation:', error);
    } finally {
      startCapturing();
    }
  }, [stopCapturing, captureState, startCapturing]);

  return {
    // State
    ...historyState,
    isInitialized: isInitializedRef.current,
    
    // Operations
    undo,
    redo,
    clearHistory,
    captureState,
    
    // Control
    startCapturing,
    stopCapturing,
    withBatch,
    
    // Setup
    initializeHistory,
    cleanupHistory,
    
    // Info
    getHistoryInfo,
  };
};