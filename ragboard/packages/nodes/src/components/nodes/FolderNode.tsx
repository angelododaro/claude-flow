import React, { useState } from 'react'
import { Folder, FolderOpen, Plus, X, Edit2 } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import type { NodeProps, FolderNodeData } from '../../types'

export function FolderNode({ 
  node, 
  selected, 
  onUpdate, 
  onDelete, 
  onStartConnection,
  nodes = []
}: NodeProps<FolderNodeData> & {
  nodes?: Array<{ id: string; type: string; data: any }>
}) {
  const [isOpen, setIsOpen] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(node.data.name)

  const handleNameSubmit = () => {
    if (nameInput.trim()) {
      onUpdate({
        data: {
          ...node.data,
          name: nameInput.trim(),
        },
      })
    } else {
      setNameInput(node.data.name)
    }
    setIsEditingName(false)
  }

  const handleAddNode = (nodeId: string) => {
    if (!node.data.nodeIds.includes(nodeId)) {
      onUpdate({
        data: {
          ...node.data,
          nodeIds: [...node.data.nodeIds, nodeId],
        },
      })
    }
  }

  const handleRemoveNode = (nodeId: string) => {
    onUpdate({
      data: {
        ...node.data,
        nodeIds: node.data.nodeIds.filter(id => id !== nodeId),
      },
    })
  }

  const containedNodes = nodes.filter(n => node.data.nodeIds.includes(n.id))

  const getNodeIcon = (type: string) => {
    const icons: Record<string, string> = {
      TEXT: '📝',
      AI_CHAT: '🤖',
      IMAGE: '🖼️',
      VIDEO: '🎥',
      AUDIO: '🎵',
      DOCUMENT: '📄',
      URL: '🌐',
      FOLDER: '📁',
    }
    return icons[type] || '📌'
  }

  const getNodeTitle = (n: any) => {
    if (n.data.name) return n.data.name
    if (n.data.title) return n.data.title
    if (n.data.content) return n.data.content.slice(0, 30) + '...'
    if (n.type === 'AI_CHAT' && n.data.messages?.length > 0) {
      return n.data.messages[0].content.slice(0, 30) + '...'
    }
    return `${n.type} Node`
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      title=""
      icon={isOpen ? <FolderOpen className="w-4 h-4 text-yellow-600" /> : <Folder className="w-4 h-4 text-yellow-600" />}
      onDelete={onDelete}
      onResize={(size) => onUpdate({ size })}
      onStartConnection={onStartConnection}
      className="min-h-[200px]"
    >
      <div className="space-y-2">
        {/* Folder Header */}
        <div className="flex items-center justify-between -mt-2">
          {isEditingName ? (
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
              className="flex-1 px-2 py-1 text-sm font-medium border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex-1 flex items-center gap-2 text-left hover:bg-gray-50 px-2 py-1 rounded transition-colors"
            >
              <span className="font-medium text-gray-900">{node.data.name}</span>
              <span className="text-xs text-gray-500">({containedNodes.length})</span>
            </button>
          )}
          
          <button
            onClick={() => setIsEditingName(true)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Rename folder"
          >
            <Edit2 className="w-3 h-3 text-gray-500" />
          </button>
        </div>

        {/* Color Picker */}
        <div className="flex gap-1">
          {['#FEF3C7', '#FEE2E2', '#DBEAFE', '#D1FAE5', '#E9D5FF'].map((color) => (
            <button
              key={color}
              onClick={() => onUpdate({ data: { ...node.data, color } })}
              className={`w-6 h-6 rounded border-2 ${
                node.data.color === color ? 'border-gray-400' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              title="Change folder color"
            />
          ))}
        </div>

        {/* Node List */}
        {isOpen && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {containedNodes.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">
                Drag nodes here to group them
              </p>
            ) : (
              containedNodes.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between gap-2 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-sm transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span>{getNodeIcon(n.type)}</span>
                    <span className="truncate text-gray-700">
                      {getNodeTitle(n)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveNode(n.id)}
                    className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                    title="Remove from folder"
                  >
                    <X className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Drop Zone */}
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center transition-colors hover:border-yellow-400 hover:bg-yellow-50"
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('border-yellow-400', 'bg-yellow-50')
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('border-yellow-400', 'bg-yellow-50')
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('border-yellow-400', 'bg-yellow-50')
            // In a real implementation, you would handle the dropped node ID here
            // For now, this is just UI
          }}
        >
          <Plus className="w-4 h-4 text-gray-400 mx-auto" />
          <p className="text-xs text-gray-500 mt-1">Drop nodes here</p>
        </div>
      </div>
    </BaseNode>
  )
}