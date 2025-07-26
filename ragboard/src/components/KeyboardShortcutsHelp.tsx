import React, { useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Editing',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Y'], description: 'Redo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo (Alternative)' },
      { keys: ['Delete'], description: 'Delete selected' },
      { keys: ['Backspace'], description: 'Delete selected' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: ['Ctrl', 'A'], description: 'Select all' },
      { keys: ['Shift', 'Click'], description: 'Multi-select nodes' },
      { keys: ['Escape'], description: 'Clear selection' },
    ],
  },
  {
    title: 'Clipboard',
    shortcuts: [
      { keys: ['Ctrl', 'C'], description: 'Copy selected' },
      { keys: ['Ctrl', 'V'], description: 'Paste' },
      { keys: ['Ctrl', 'X'], description: 'Cut selected' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', '+'], description: 'Zoom in' },
      { keys: ['Ctrl', '-'], description: 'Zoom out' },
      { keys: ['Ctrl', '0'], description: 'Fit view' },
      { keys: ['Ctrl', 'M'], description: 'Toggle mini map' },
    ],
  },
  {
    title: 'Adding Nodes',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'T'], description: 'Add text node' },
      { keys: ['Ctrl', 'Shift', 'F'], description: 'Add folder' },
      { keys: ['Ctrl', 'Shift', 'C'], description: 'Add chat node' },
    ],
  },
  {
    title: 'Other',
    shortcuts: [
      { keys: ['Ctrl', 'F'], description: 'Search' },
      { keys: ['Ctrl', 'S'], description: 'Save' },
      { keys: ['?'], description: 'Show this help' },
    ],
  },
];

export const KeyboardShortcutsHelp: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-all z-20"
        title="Keyboard shortcuts (Press ? for help)"
      >
        <Keyboard className="w-5 h-5 text-gray-700" />
      </button>

      {/* Help Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Keyboard className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {shortcutGroups.map((group) => (
                  <div key={group.title} className="space-y-3">
                    <h3 className="font-medium text-gray-900 text-lg border-b border-gray-100 pb-2">
                      {group.title}
                    </h3>
                    <div className="space-y-2">
                      {group.shortcuts.map((shortcut, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 flex-1">
                            {shortcut.description}
                          </span>
                          <div className="flex items-center gap-1 ml-3">
                            {shortcut.keys.map((key, keyIndex) => (
                              <React.Fragment key={keyIndex}>
                                {keyIndex > 0 && (
                                  <span className="text-xs text-gray-400 mx-0.5">+</span>
                                )}
                                <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-700">
                                  {key}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tips */}
              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Tips:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Drag nodes around the canvas to position them</li>
                  <li>• Use Shift+Click to select multiple nodes</li>
                  <li>• Double-click text nodes to edit them inline</li>
                  <li>• Connect nodes by dragging from one node's handle to another</li>
                  <li>• Use frames to group related nodes together</li>
                  <li>• Right-click for context menus (coming soon)</li>
                </ul>
              </div>

              {/* Platform-specific note */}
              <div className="mt-4 text-xs text-gray-500 text-center">
                <p>
                  On Mac, use ⌘ (Cmd) instead of Ctrl for most shortcuts
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};