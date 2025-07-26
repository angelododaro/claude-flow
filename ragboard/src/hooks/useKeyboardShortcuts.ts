import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  modifiers?: {
    ctrl?: boolean;
    cmd?: boolean; // For Mac
    shift?: boolean;
    alt?: boolean;
  };
  action: () => void;
  description?: string;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  preventDefault = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check if we're in an input field
      const target = event.target as HTMLElement;
      const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      
      shortcuts.forEach((shortcut) => {
        if (shortcut.enabled === false) return;

        const modifiers = shortcut.modifiers || {};
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        
        // Check modifiers
        const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
        const modifiersMatch =
          (modifiers.ctrl || modifiers.cmd ? ctrlOrCmd : !ctrlOrCmd) &&
          (modifiers.shift ? event.shiftKey : !event.shiftKey) &&
          (modifiers.alt ? event.altKey : !event.altKey);

        // Check key
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (modifiersMatch && keyMatch) {
          // Skip if in input field and not explicitly allowed
          if (isInputField && !modifiers.ctrl && !modifiers.cmd) return;
          
          if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }
          
          shortcut.action();
        }
      });
    },
    [shortcuts, enabled, preventDefault]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);
}

// Common shortcuts for board canvas
export const createCanvasShortcuts = (actions: {
  undo?: () => void;
  redo?: () => void;
  deleteSelected?: () => void;
  selectAll?: () => void;
  copy?: () => void;
  paste?: () => void;
  cut?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  fitView?: () => void;
  toggleMiniMap?: () => void;
  addTextNode?: () => void;
  addFolderNode?: () => void;
  addChatNode?: () => void;
  search?: () => void;
  save?: () => void;
}): KeyboardShortcut[] => {
  const shortcuts: KeyboardShortcut[] = [];

  if (actions.undo) {
    shortcuts.push({
      key: 'z',
      modifiers: { ctrl: true },
      action: actions.undo,
      description: 'Undo',
    });
  }

  if (actions.redo) {
    shortcuts.push({
      key: 'y',
      modifiers: { ctrl: true },
      action: actions.redo,
      description: 'Redo',
    });
    shortcuts.push({
      key: 'z',
      modifiers: { ctrl: true, shift: true },
      action: actions.redo,
      description: 'Redo',
    });
  }

  if (actions.deleteSelected) {
    shortcuts.push({
      key: 'Delete',
      action: actions.deleteSelected,
      description: 'Delete selected',
    });
    shortcuts.push({
      key: 'Backspace',
      action: actions.deleteSelected,
      description: 'Delete selected',
    });
  }

  if (actions.selectAll) {
    shortcuts.push({
      key: 'a',
      modifiers: { ctrl: true },
      action: actions.selectAll,
      description: 'Select all',
    });
  }

  if (actions.copy) {
    shortcuts.push({
      key: 'c',
      modifiers: { ctrl: true },
      action: actions.copy,
      description: 'Copy',
    });
  }

  if (actions.paste) {
    shortcuts.push({
      key: 'v',
      modifiers: { ctrl: true },
      action: actions.paste,
      description: 'Paste',
    });
  }

  if (actions.cut) {
    shortcuts.push({
      key: 'x',
      modifiers: { ctrl: true },
      action: actions.cut,
      description: 'Cut',
    });
  }

  if (actions.zoomIn) {
    shortcuts.push({
      key: '+',
      modifiers: { ctrl: true },
      action: actions.zoomIn,
      description: 'Zoom in',
    });
    shortcuts.push({
      key: '=',
      modifiers: { ctrl: true },
      action: actions.zoomIn,
      description: 'Zoom in',
    });
  }

  if (actions.zoomOut) {
    shortcuts.push({
      key: '-',
      modifiers: { ctrl: true },
      action: actions.zoomOut,
      description: 'Zoom out',
    });
  }

  if (actions.fitView) {
    shortcuts.push({
      key: '0',
      modifiers: { ctrl: true },
      action: actions.fitView,
      description: 'Fit view',
    });
  }

  if (actions.toggleMiniMap) {
    shortcuts.push({
      key: 'm',
      modifiers: { ctrl: true },
      action: actions.toggleMiniMap,
      description: 'Toggle mini map',
    });
  }

  if (actions.addTextNode) {
    shortcuts.push({
      key: 't',
      modifiers: { ctrl: true, shift: true },
      action: actions.addTextNode,
      description: 'Add text node',
    });
  }

  if (actions.addFolderNode) {
    shortcuts.push({
      key: 'f',
      modifiers: { ctrl: true, shift: true },
      action: actions.addFolderNode,
      description: 'Add folder',
    });
  }

  if (actions.addChatNode) {
    shortcuts.push({
      key: 'c',
      modifiers: { ctrl: true, shift: true },
      action: actions.addChatNode,
      description: 'Add chat',
    });
  }

  if (actions.search) {
    shortcuts.push({
      key: 'f',
      modifiers: { ctrl: true },
      action: actions.search,
      description: 'Search',
    });
  }

  if (actions.save) {
    shortcuts.push({
      key: 's',
      modifiers: { ctrl: true },
      action: actions.save,
      description: 'Save',
    });
  }

  return shortcuts;
};