import React, { useCallback, useEffect } from 'react'
import { Type } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import type { NodeProps, TextNodeData } from '../../types'

// Lexical imports
import { $getRoot, $getSelection, EditorState } from 'lexical'
import { $isRangeSelection } from 'lexical'
import { 
  InitialConfigType,
  LexicalComposer 
} from '@lexical/react/LexicalComposer'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { 
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode
} from '@lexical/rich-text'
import { LinkNode } from '@lexical/link'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary'

// Toolbar component
function Toolbar() {
  const [editor] = useLexicalComposerContext()
  
  const formatBold = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.formatText('bold')
      }
    })
  }, [editor])

  const formatItalic = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.formatText('italic')
      }
    })
  }, [editor])

  const formatCode = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.formatText('code')
      }
    })
  }, [editor])

  return (
    <div className="flex items-center gap-1 p-2 border-b border-gray-200">
      <button
        onClick={formatBold}
        className="px-2 py-1 text-sm font-bold hover:bg-gray-100 rounded"
        title="Bold"
      >
        B
      </button>
      <button
        onClick={formatItalic}
        className="px-2 py-1 text-sm italic hover:bg-gray-100 rounded"
        title="Italic"
      >
        I
      </button>
      <button
        onClick={formatCode}
        className="px-2 py-1 text-sm font-mono hover:bg-gray-100 rounded"
        title="Code"
      >
        {'</>'}
      </button>
    </div>
  )
}

export function LexicalTextNode({ node, selected, onUpdate, onDelete, onStartConnection }: NodeProps<TextNodeData>) {
  const theme = {
    text: {
      bold: 'font-bold',
      italic: 'italic',
      code: 'font-mono bg-gray-100 px-1 rounded',
    },
    heading: {
      h1: 'text-2xl font-bold mb-2',
      h2: 'text-xl font-bold mb-2',
      h3: 'text-lg font-bold mb-1',
    },
    list: {
      ul: 'list-disc list-inside',
      ol: 'list-decimal list-inside',
      listitem: 'ml-4',
    },
    quote: 'border-l-4 border-gray-300 pl-4 italic',
    code: 'font-mono bg-gray-100 p-2 rounded block',
    link: 'text-blue-600 underline',
  }

  const initialConfig: InitialConfigType = {
    namespace: 'TextNode',
    theme,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      LinkNode,
      HorizontalRuleNode,
    ],
    onError: (error: Error) => {
      console.error('Lexical error:', error)
    },
    editorState: node.data.content ? 
      (() => {
        try {
          return node.data.content
        } catch {
          return undefined
        }
      })() : undefined,
  }

  const onChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot()
      const content = root.getTextContent()
      
      // Store both the serialized state and plain text
      onUpdate({
        data: {
          ...node.data,
          content: JSON.stringify(editorState.toJSON()),
          plainText: content,
        },
      })
    })
  }, [node.data, onUpdate])

  return (
    <BaseNode
      node={node}
      selected={selected}
      title="Rich Text"
      icon={<Type className="w-4 h-4 text-indigo-600" />}
      onDelete={onDelete}
      onResize={(size) => onUpdate({ size })}
      onStartConnection={onStartConnection}
      className="flex flex-col"
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        <LexicalComposer initialConfig={initialConfig}>
          {node.data.format === 'rich' && <Toolbar />}
          
          <div className="flex-1 overflow-auto">
            {node.data.format === 'rich' ? (
              <RichTextPlugin
                contentEditable={
                  <ContentEditable 
                    className="p-3 focus:outline-none min-h-full"
                    spellCheck
                  />
                }
                placeholder={
                  <div className="absolute top-3 left-3 text-gray-400 pointer-events-none">
                    Start writing...
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            ) : (
              <PlainTextPlugin
                contentEditable={
                  <ContentEditable 
                    className="p-3 focus:outline-none min-h-full font-mono text-sm"
                    spellCheck
                  />
                }
                placeholder={
                  <div className="absolute top-3 left-3 text-gray-400 pointer-events-none font-mono text-sm">
                    Start typing...
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            )}
            
            <OnChangePlugin onChange={onChange} />
            <HistoryPlugin />
            {node.data.format === 'rich' && <MarkdownShortcutPlugin />}
          </div>
        </LexicalComposer>
      </div>

      {/* Format Toggle */}
      <div className="border-t border-gray-200 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Format:</span>
          <div className="flex gap-1">
            <button
              onClick={() => onUpdate({ data: { ...node.data, format: 'plain' } })}
              className={`px-2 py-1 text-xs rounded ${
                node.data.format === 'plain' 
                  ? 'bg-gray-200 text-gray-900' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Plain
            </button>
            <button
              onClick={() => onUpdate({ data: { ...node.data, format: 'rich' } })}
              className={`px-2 py-1 text-xs rounded ${
                node.data.format === 'rich' 
                  ? 'bg-gray-200 text-gray-900' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Rich
            </button>
            <button
              onClick={() => onUpdate({ data: { ...node.data, format: 'markdown' } })}
              className={`px-2 py-1 text-xs rounded ${
                node.data.format === 'markdown' 
                  ? 'bg-gray-200 text-gray-900' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Markdown
            </button>
          </div>
        </div>
      </div>
    </BaseNode>
  )
}