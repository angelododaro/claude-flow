import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { Type, X, Edit3, Eye, Maximize, Minimize, Sparkles, Download, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import { useBoardStore } from '../store/boardStore';
import { ResizableNodeWrapper } from './ResizableNodeWrapper';
import RichTextEditor from './RichTextEditor';

interface EnhancedTextNodeData {
  id: string;
  title: string;
  metadata?: {
    content?: string;
    richContent?: string;
    isRichText?: boolean;
    theme?: 'light' | 'dark';
  };
  onDelete: (id: string) => void;
}

type EnhancedTextNodeProps = Node<EnhancedTextNodeData>;

export const EnhancedTextNode: React.FC<{ data: EnhancedTextNodeData; selected?: boolean }> = ({ 
  data, 
  selected 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [content, setContent] = useState(data.metadata?.richContent || data.metadata?.content || '<p>Double-click to start writing...</p>');
  const [theme, setTheme] = useState<'light' | 'dark'>(data.metadata?.theme || 'light');
  const [isRichTextEnabled, setIsRichTextEnabled] = useState(data.metadata?.isRichText ?? true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const updateResource = useBoardStore((state) => state.updateResource);
  const setDraggedResource = useBoardStore((state) => state.setDraggedResource);

  const handleDragStart = (e: React.DragEvent) => {
    if (!isEditing) {
      setDraggedResource(data.id);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragEnd = () => {
    setDraggedResource(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setViewMode('edit');
  };

  const handleSave = useCallback(() => {
    updateResource(data.id, {
      metadata: {
        ...data.metadata,
        content: isRichTextEnabled ? undefined : stripHtml(content),
        richContent: isRichTextEnabled ? content : undefined,
        isRichText: isRichTextEnabled,
        theme,
      },
    });
    setIsEditing(false);
    setViewMode('preview');
  }, [content, data.id, data.metadata, updateResource, isRichTextEnabled, theme]);

  const handleCancel = useCallback(() => {
    setContent(data.metadata?.richContent || data.metadata?.content || '<p>Double-click to start writing...</p>');
    setIsEditing(false);
    setViewMode('preview');
  }, [data.metadata?.richContent, data.metadata?.content]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  const handleAIAssist = useCallback(async (selectedText: string) => {
    // This would integrate with an AI service
    // For now, we'll show a simple enhancement
    try {
      // Placeholder for AI integration
      const aiSuggestion = `Enhanced: ${selectedText}`;
      
      // In a real implementation, you would:
      // 1. Call an AI API with the selected text
      // 2. Get suggestions for improvement, expansion, or rewriting
      // 3. Offer the user options to accept or modify the suggestions
      
      alert(`AI Suggestion: ${aiSuggestion}`);
    } catch (error) {
      console.error('AI assistance error:', error);
    }
  }, []);

  const stripHtml = (html: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const convertToPlainText = () => {
    const plainText = stripHtml(content);
    setContent(plainText);
    setIsRichTextEnabled(false);
  };

  const convertToRichText = () => {
    const htmlContent = content.replace(/\n/g, '<br>');
    setContent(`<p>${htmlContent}</p>`);
    setIsRichTextEnabled(true);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const exportContent = () => {
    const exportData = {
      title: data.title,
      content: isRichTextEnabled ? content : content,
      type: isRichTextEnabled ? 'html' : 'text',
      createdAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importContent = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt,.md';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const result = e.target?.result as string;
            
            if (file.type === 'application/json') {
              const data = JSON.parse(result);
              setContent(data.content || result);
            } else {
              setContent(result);
            }
          } catch (error) {
            console.error('Import error:', error);
            alert('Error importing file');
          }
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  };

  // Auto-save functionality
  useEffect(() => {
    if (isEditing) {
      const autoSaveTimer = setTimeout(() => {
        handleSave();
      }, 30000); // Auto-save every 30 seconds

      return () => clearTimeout(autoSaveTimer);
    }
  }, [content, isEditing, handleSave]);

  return (
    <ResizableNodeWrapper 
      selected={selected} 
      minWidth={isExpanded ? 600 : 250} 
      minHeight={isExpanded ? 400 : 150}
    >
      <div
        ref={containerRef}
        className={clsx(
          'w-full h-full rounded-lg shadow-md transition-all',
          selected && 'ring-2 ring-purple-500',
          'hover:shadow-lg',
          theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
        )}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <Handle type="target" position={Position.Top} />
      
        {/* Header */}
        <div 
          className={clsx(
            'px-3 py-2 rounded-t-lg border-b flex items-center justify-between',
            theme === 'dark' 
              ? 'bg-yellow-900 border-yellow-700' 
              : 'bg-yellow-50 border-yellow-200'
          )}
          draggable={!isEditing}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-center gap-2">
            <Type className={clsx('w-4 h-4', theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600')} />
            <span className={clsx('text-sm font-medium', theme === 'dark' ? 'text-gray-200' : 'text-gray-700')}>
              {isRichTextEnabled ? 'Rich Text' : 'Plain Text'}
            </span>
            {data.metadata?.isRichText && (
              <Sparkles className="w-3 h-3 text-purple-500" title="AI Enhanced" />
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* View Mode Toggle */}
            {isEditing && (
              <>
                <button
                  onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
                  className={clsx(
                    'p-1 rounded transition-colors',
                    theme === 'dark' ? 'hover:bg-yellow-800' : 'hover:bg-yellow-100'
                  )}
                  title={viewMode === 'edit' ? 'Preview' : 'Edit'}
                >
                  {viewMode === 'edit' ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                </button>

                {/* Text Mode Toggle */}
                <button
                  onClick={isRichTextEnabled ? convertToPlainText : convertToRichText}
                  className={clsx(
                    'p-1 rounded transition-colors text-xs px-2',
                    theme === 'dark' ? 'hover:bg-yellow-800' : 'hover:bg-yellow-100'
                  )}
                  title={isRichTextEnabled ? 'Convert to Plain Text' : 'Convert to Rich Text'}
                >
                  {isRichTextEnabled ? 'Plain' : 'Rich'}
                </button>

                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className={clsx(
                    'p-1 rounded transition-colors',
                    theme === 'dark' ? 'hover:bg-yellow-800' : 'hover:bg-yellow-100'
                  )}
                  title="Toggle Theme"
                >
                  🎨
                </button>
              </>
            )}

            {/* Expand Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={clsx(
                'p-1 rounded transition-colors',
                theme === 'dark' ? 'hover:bg-yellow-800' : 'hover:bg-yellow-100'
              )}
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
            </button>

            {/* Import/Export */}
            {!isEditing && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    importContent();
                  }}
                  className={clsx(
                    'p-1 rounded transition-colors',
                    theme === 'dark' ? 'hover:bg-yellow-800' : 'hover:bg-yellow-100'
                  )}
                  title="Import Content"
                >
                  <Upload className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportContent();
                  }}
                  className={clsx(
                    'p-1 rounded transition-colors',
                    theme === 'dark' ? 'hover:bg-yellow-800' : 'hover:bg-yellow-100'
                  )}
                  title="Export Content"
                >
                  <Download className="w-3 h-3" />
                </button>
              </>
            )}

            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (data.onDelete) {
                  data.onDelete(data.id);
                }
              }}
              className={clsx(
                'p-1 rounded transition-colors',
                theme === 'dark' ? 'hover:bg-yellow-800' : 'hover:bg-yellow-100'
              )}
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 h-full overflow-auto">
          {isEditing && viewMode === 'edit' ? (
            <div className="h-full">
              {isRichTextEnabled ? (
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Start writing..."
                  className="h-full"
                  theme={theme}
                  onAIAssist={handleAIAssist}
                  showToolbar={isExpanded}
                  showBubbleMenu={true}
                  showFloatingMenu={true}
                  nodeId={data.id}
                  userId={`user-${Date.now()}`}
                  enableCollaboration={true}
                  enableAI={true}
                />
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className={clsx(
                    'w-full h-full p-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none',
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  )}
                  placeholder="Enter your text..."
                  autoFocus
                />
              )}
              
              {/* Save/Cancel Buttons */}
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={handleCancel}
                  className={clsx(
                    'px-3 py-1 text-sm rounded',
                    theme === 'dark' 
                      ? 'text-gray-400 hover:text-gray-200' 
                      : 'text-gray-600 hover:text-gray-800'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Save
                </button>
              </div>
              
              <div className={clsx('mt-2 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Press Ctrl+Enter to save, Esc to cancel • Auto-saves every 30s
              </div>
            </div>
          ) : (
            <div 
              className={clsx(
                'text-sm whitespace-pre-wrap min-h-[60px] cursor-pointer',
                isRichTextEnabled ? 'prose prose-sm max-w-none' : '',
                theme === 'dark' && isRichTextEnabled ? 'prose-invert' : '',
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              )}
              onClick={handleDoubleClick}
            >
              {isRichTextEnabled ? (
                <div dangerouslySetInnerHTML={{ __html: content }} />
              ) : (
                content || 'Double-click to edit...'
              )}
            </div>
          )}
        </div>

        <Handle type="source" position={Position.Bottom} />
      </div>
    </ResizableNodeWrapper>
  );
};

export default EnhancedTextNode;