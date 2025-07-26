import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import { lowlight } from 'lowlight';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Quote,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Type,
  Sparkles,
  Download,
  Upload,
  Palette
} from 'lucide-react';
import { clsx } from 'clsx';
import { aiWritingAssistant, AIWritingRequest } from '../services/aiWritingAssistant';
import useCollaborativeText from '../hooks/useCollaborativeText';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  showToolbar?: boolean;
  showBubbleMenu?: boolean;
  showFloatingMenu?: boolean;
  onAIAssist?: (selectedText: string) => void;
  theme?: 'light' | 'dark';
  nodeId?: string; // For collaborative editing
  userId?: string; // For collaborative editing
  enableCollaboration?: boolean;
  enableAI?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = 'Start writing...',
  editable = true,
  className = '',
  showToolbar = true,
  showBubbleMenu = true,
  showFloatingMenu = true,
  onAIAssist,
  theme = 'light',
  nodeId,
  userId,
  enableCollaboration = false,
  enableAI = true
}) => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [isAILoading, setIsAILoading] = useState(false);
  const [selectedAIAction, setSelectedAIAction] = useState<string>('improve');
  
  // Collaborative editing
  const collaborative = useCollaborativeText(
    nodeId || 'default',
    content,
    userId || 'anonymous'
  );
  
  // Use collaborative content if collaboration is enabled
  const currentContent = enableCollaboration ? collaborative.content : content;
  const handleContentChange = enableCollaboration ? collaborative.updateContent : onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We're using CodeBlockLowlight instead
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-purple-600 underline hover:text-purple-800 cursor-pointer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg shadow-md',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300 w-full my-4',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border border-gray-300',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 bg-gray-100 p-2 font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto',
        },
      }),
      Typography,
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      handleContentChange(html);
    },
    editorProps: {
      attributes: {
        class: clsx(
          'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl max-w-none',
          'focus:outline-none p-4 min-h-[200px]',
          theme === 'dark' ? 'prose-invert' : '',
          className
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && currentContent !== editor.getHTML()) {
      editor.commands.setContent(currentContent);
    }
  }, [currentContent, editor]);

  // Update cursor position for collaborative editing
  useEffect(() => {
    if (enableCollaboration && editor) {
      const handleSelectionUpdate = () => {
        const { from } = editor.state.selection;
        collaborative.setCursorPosition(from);
      };

      editor.on('selectionUpdate', handleSelectionUpdate);
      return () => {
        editor.off('selectionUpdate', handleSelectionUpdate);
      };
    }
  }, [editor, enableCollaboration, collaborative]);

  const addLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    setLinkUrl(previousUrl || '');
    setIsLinkModalOpen(true);
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    }
    setIsLinkModalOpen(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    if (!editor) return;

    const url = window.prompt('Image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const handleAIAssist = useCallback(async (action?: string) => {
    if (!editor || !enableAI) return;

    const aiAction = action || selectedAIAction;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    const targetContent = selectedText || editor.getText();
    
    if (onAIAssist) {
      onAIAssist(targetContent);
      return;
    }

    // Use built-in AI assistant
    setIsAILoading(true);
    setIsAIModalOpen(true);
    
    try {
      const request: AIWritingRequest = {
        action: aiAction as any,
        content: targetContent,
        tone: 'professional',
      };
      
      const response = await aiWritingAssistant.assistWithWriting(request);
      
      if (response.success) {
        setAiSuggestions(response.suggestions);
      }
    } catch (error) {
      console.error('AI assistance error:', error);
    } finally {
      setIsAILoading(false);
    }
  }, [editor, onAIAssist, selectedAIAction, enableAI]);

  const applyAISuggestion = useCallback((suggestion: any) => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    
    if (from !== to) {
      // Replace selected text
      editor.chain().focus().deleteSelection().insertContent(suggestion.content).run();
    } else {
      // Replace all content
      editor.chain().focus().selectAll().deleteSelection().insertContent(suggestion.content).run();
    }
    
    setIsAIModalOpen(false);
    setAiSuggestions([]);
  }, [editor]);

  const exportToMarkdown = useCallback(() => {
    if (!editor) return;

    // Simple HTML to Markdown conversion
    const html = editor.getHTML();
    const markdown = html
      .replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n')
      .replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n')
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n\n')
      .replace(/<ul><li>(.*?)<\/li><\/ul>/g, '- $1\n')
      .replace(/<ol><li>(.*?)<\/li><\/ol>/g, '1. $1\n')
      .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]*>/g, ''); // Remove remaining HTML tags

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    a.click();
    URL.revokeObjectURL(url);
  }, [editor]);

  const importFromMarkdown = useCallback(() => {
    if (!editor) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const markdown = e.target?.result as string;
          // Simple Markdown to HTML conversion (for demo purposes)
          const html = markdown
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>')
            .replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
          
          editor.commands.setContent(`<p>${html}</p>`);
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={clsx('border rounded-lg', theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white')}>
      {/* Toolbar */}
      {showToolbar && (
        <div className={clsx(
          'flex flex-wrap items-center gap-1 p-2 border-b',
          theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'
        )}>
          {/* Text Formatting */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().focus().toggleBold().run()}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('bold') ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!editor.can().chain().focus().toggleItalic().run()}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('italic') ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              disabled={!editor.can().chain().focus().toggleStrike().run()}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('strike') ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Strikethrough"
            >
              <Strikethrough className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              disabled={!editor.can().chain().focus().toggleCode().run()}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('code') ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Inline Code"
            >
              <Code className="w-4 h-4" />
            </button>
          </div>

          {/* Headings */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('heading', { level: 1 }) ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('heading', { level: 2 }) ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('heading', { level: 3 }) ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Heading 3"
            >
              <Heading3 className="w-4 h-4" />
            </button>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('bulletList') ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('orderedList') ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Ordered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('blockquote') ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Quote"
            >
              <Quote className="w-4 h-4" />
            </button>
          </div>

          {/* Links and Media */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
            <button
              onClick={addLink}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                editor.isActive('link') ? 'bg-purple-100 dark:bg-purple-800' : ''
              )}
              title="Add Link"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            <button
              onClick={addImage}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              title="Add Image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              title="Insert Table"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().chain().focus().undo().run()}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().chain().focus().redo().run()}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>

          {/* AI Features */}
          {enableAI && (
            <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
              <select
                value={selectedAIAction}
                onChange={(e) => setSelectedAIAction(e.target.value)}
                className="text-xs p-1 rounded border dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="improve">Improve</option>
                <option value="expand">Expand</option>
                <option value="summarize">Summarize</option>
                <option value="rewrite">Rewrite</option>
                <option value="proofread">Proofread</option>
                <option value="complete">Complete</option>
              </select>
              <button
                onClick={() => handleAIAssist()}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-purple-600"
                title="AI Assist"
                disabled={isAILoading}
              >
                <Sparkles className={clsx('w-4 h-4', isAILoading && 'animate-spin')} />
              </button>
            </div>
          )}

          {/* Import/Export */}
          <div className="flex items-center gap-1">
            <button
              onClick={importFromMarkdown}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              title="Import Markdown"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={exportToMarkdown}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              title="Export Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Collaboration Status */}
      {enableCollaboration && collaborative.isConnected && (
        <div className={clsx(
          'px-3 py-1 border-b text-xs flex items-center justify-between',
          theme === 'dark' ? 'border-gray-600 bg-gray-700 text-gray-300' : 'border-gray-200 bg-blue-50 text-blue-700'
        )}>
          <span>
            🟢 Collaborative editing • {collaborative.collaborators.length} other{collaborative.collaborators.length !== 1 ? 's' : ''} online
          </span>
          {collaborative.collaborators.length > 0 && (
            <div className="flex items-center gap-1">
              {Array.from(collaborative.cursors.entries()).map(([userId, cursor]) => (
                <div
                  key={userId}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cursor.color }}
                  title={cursor.user}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor Content */}
      <div className="relative">
        <EditorContent editor={editor} />
        
        {/* Collaborative Cursors */}
        {enableCollaboration && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from(collaborative.cursors.entries()).map(([userId, cursor]) => (
              <div
                key={userId}
                className="absolute w-0.5 h-5 opacity-75"
                style={{
                  backgroundColor: cursor.color,
                  left: `${cursor.position}px`, // This would need proper position calculation
                  top: '0px',
                }}
              >
                <div
                  className="absolute -top-6 -left-2 px-1 py-0.5 text-xs text-white rounded whitespace-nowrap"
                  style={{ backgroundColor: cursor.color }}
                >
                  {cursor.user}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bubble Menu */}
        {showBubbleMenu && (
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100 }}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-1 flex items-center gap-1"
          >
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={clsx(
                'p-1 rounded text-sm',
                editor.isActive('bold') ? 'bg-purple-100 dark:bg-purple-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <Bold className="w-3 h-3" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={clsx(
                'p-1 rounded text-sm',
                editor.isActive('italic') ? 'bg-purple-100 dark:bg-purple-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <Italic className="w-3 h-3" />
            </button>
            <button
              onClick={addLink}
              className="p-1 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <LinkIcon className="w-3 h-3" />
            </button>
            {enableAI && (
              <button
                onClick={() => handleAIAssist()}
                className="p-1 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-purple-600"
                disabled={isAILoading}
              >
                <Sparkles className={clsx('w-3 h-3', isAILoading && 'animate-spin')} />
              </button>
            )}
          </BubbleMenu>
        )}

        {/* Floating Menu */}
        {showFloatingMenu && (
          <FloatingMenu
            editor={editor}
            tippyOptions={{ duration: 100 }}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-1 flex items-center gap-1"
          >
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className="p-1 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Heading1 className="w-3 h-3" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className="p-1 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Heading2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className="p-1 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <List className="w-3 h-3" />
            </button>
          </FloatingMenu>
        )}
      </div>

      {/* Link Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Add Link</h3>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Enter URL..."
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={setLink}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Suggestions Modal */}
      {isAIModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-[90%] max-w-4xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">AI Writing Suggestions</h3>
              <button
                onClick={() => setIsAIModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {isAILoading ? (
              <div className="flex items-center justify-center py-8">
                <Sparkles className="w-6 h-6 animate-spin text-purple-600 mr-2" />
                <span>AI is analyzing your content...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {aiSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{suggestion.title}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </span>
                        <button
                          onClick={() => applyAISuggestion(suggestion)}
                          className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                    <div 
                      className="prose prose-sm max-w-none dark:prose-invert mb-2"
                      dangerouslySetInnerHTML={{ __html: suggestion.content }}
                    />
                    {suggestion.reasoning && (
                      <p className="text-xs text-gray-500 italic">{suggestion.reasoning}</p>
                    )}
                  </div>
                ))}
                
                {aiSuggestions.length === 0 && !isAILoading && (
                  <div className="text-center py-8 text-gray-500">
                    No suggestions available. Try selecting some text first.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;