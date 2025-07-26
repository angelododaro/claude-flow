import { useCallback, useRef, useState } from 'react';

interface Command<T> {
  execute: () => void;
  undo: () => void;
  description?: string;
}

interface UndoRedoState<T> {
  canUndo: boolean;
  canRedo: boolean;
  execute: (command: Command<T>) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  history: Command<T>[];
  currentIndex: number;
}

export function useUndoRedo<T>(maxHistorySize: number = 50): UndoRedoState<T> {
  const [history, setHistory] = useState<Command<T>[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const isExecutingRef = useRef(false);

  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < history.length - 1;

  const execute = useCallback((command: Command<T>) => {
    if (isExecutingRef.current) return;
    
    try {
      isExecutingRef.current = true;
      command.execute();
      
      // Remove any commands after current index (we're branching)
      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(command);
      
      // Limit history size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      } else {
        setCurrentIndex(currentIndex + 1);
      }
      
      setHistory(newHistory);
    } finally {
      isExecutingRef.current = false;
    }
  }, [history, currentIndex, maxHistorySize]);

  const undo = useCallback(() => {
    if (!canUndo || isExecutingRef.current) return;
    
    try {
      isExecutingRef.current = true;
      const command = history[currentIndex];
      command.undo();
      setCurrentIndex(currentIndex - 1);
    } finally {
      isExecutingRef.current = false;
    }
  }, [history, currentIndex, canUndo]);

  const redo = useCallback(() => {
    if (!canRedo || isExecutingRef.current) return;
    
    try {
      isExecutingRef.current = true;
      const command = history[currentIndex + 1];
      command.execute();
      setCurrentIndex(currentIndex + 1);
    } finally {
      isExecutingRef.current = false;
    }
  }, [history, currentIndex, canRedo]);

  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  return {
    canUndo,
    canRedo,
    execute,
    undo,
    redo,
    clear,
    history,
    currentIndex,
  };
}

// Specific command creators for board operations
export const createNodeCommand = <T extends { id: string; position: { x: number; y: number } }>(
  node: T,
  onAdd: (node: T) => void,
  onRemove: (nodeId: string) => void
): Command<T> => ({
  execute: () => onAdd(node),
  undo: () => onRemove(node.id),
  description: `Add node ${node.id}`,
});

export const deleteNodeCommand = <T extends { id: string }>(
  node: T,
  onRemove: (nodeId: string) => void,
  onRestore: (node: T) => void
): Command<T> => ({
  execute: () => onRemove(node.id),
  undo: () => onRestore(node),
  description: `Delete node ${node.id}`,
});

export const moveNodeCommand = <T extends { id: string; position: { x: number; y: number } }>(
  nodeId: string,
  oldPosition: { x: number; y: number },
  newPosition: { x: number; y: number },
  onMove: (nodeId: string, position: { x: number; y: number }) => void
): Command<T> => ({
  execute: () => onMove(nodeId, newPosition),
  undo: () => onMove(nodeId, oldPosition),
  description: `Move node ${nodeId}`,
});

export const updateNodeCommand = <T extends { id: string }>(
  nodeId: string,
  oldData: Partial<T>,
  newData: Partial<T>,
  onUpdate: (nodeId: string, data: Partial<T>) => void
): Command<T> => ({
  execute: () => onUpdate(nodeId, newData),
  undo: () => onUpdate(nodeId, oldData),
  description: `Update node ${nodeId}`,
});

export const createEdgeCommand = <E extends { id: string; source: string; target: string }>(
  edge: E,
  onAdd: (edge: E) => void,
  onRemove: (edgeId: string) => void
): Command<E> => ({
  execute: () => onAdd(edge),
  undo: () => onRemove(edge.id),
  description: `Connect ${edge.source} to ${edge.target}`,
});

export const deleteEdgeCommand = <E extends { id: string }>(
  edge: E,
  onRemove: (edgeId: string) => void,
  onRestore: (edge: E) => void
): Command<E> => ({
  execute: () => onRemove(edge.id),
  undo: () => onRestore(edge),
  description: `Disconnect edge ${edge.id}`,
});