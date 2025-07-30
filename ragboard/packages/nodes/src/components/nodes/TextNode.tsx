import React, { useState } from 'react'
import { Type } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import type { NodeProps, TextNodeData } from '../../types'

export function TextNode({ node, selected, onUpdate, onDelete, onStartConnection }: NodeProps<TextNodeData>) {
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(node.data.content)

  const handleSave = () => {
    onUpdate({ data: { ...node.data, content } })
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setContent(node.data.content)
      setIsEditing(false)
    }
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      title="Text"
      icon={<Type className="w-4 h-4 text-gray-600" />}
      onDelete={onDelete}
      onResize={(size) => onUpdate({ size })}
      onStartConnection={onStartConnection}
    >
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            className="w-full h-32 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
            >
              Save
            </button>
            <button
              onClick={() => {
                setContent(node.data.content)
                setIsEditing(false)
              }}
              className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className="prose prose-sm max-w-none cursor-text"
          onClick={() => setIsEditing(true)}
        >
          {node.data.content || (
            <p className="text-gray-400 italic">Click to add text...</p>
          )}
        </div>
      )}
    </BaseNode>
  )
}