'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { nodeRegistry } from '@ragboard/nodes'
import { NodeType } from '@ragboard/types'
import { trpc } from '@/lib/trpc-client'

interface NodeSidebarProps {
  boardId: string
  onNodeCreated?: () => void
}

export function NodeSidebar({ boardId, onNodeCreated }: NodeSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [draggedNodeType, setDraggedNodeType] = useState<NodeType | null>(null)

  const createNode = trpc.node.create.useMutation({
    onSuccess: () => {
      onNodeCreated?.()
    },
  })

  // Get all registered node types
  const nodeTypes = Object.values(NodeType).map((type) => {
    const renderer = nodeRegistry.get(type)
    return renderer ? { type, renderer } : null
  }).filter(Boolean) as Array<{ type: NodeType; renderer: any }>

  // Filter node types based on search
  const filteredNodeTypes = nodeTypes.filter(({ renderer }) =>
    renderer.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, nodeType: NodeType) => {
    setDraggedNodeType(nodeType)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('nodeType', nodeType)
  }

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedNodeType(null)
  }

  // Handle click to create node at center
  const handleNodeClick = (nodeType: NodeType) => {
    const renderer = nodeRegistry.get(nodeType)
    if (!renderer) return

    // Create node at center of viewport
    createNode.mutate({
      boardId,
      type: nodeType,
      position: { x: window.innerWidth / 2 - renderer.defaultSize.width / 2, y: window.innerHeight / 2 - renderer.defaultSize.height / 2 },
      size: renderer.defaultSize,
      data: renderer.defaultData(),
    })
  }

  return (
    <div
      className={`absolute left-0 top-0 bottom-0 bg-white border-r border-gray-200 shadow-lg transition-all duration-300 z-20 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-4 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        {!isCollapsed && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Nodes</h3>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </>
        )}
      </div>

      {/* Node list */}
      <div className="p-4 space-y-2 overflow-y-auto h-[calc(100%-120px)]">
        {filteredNodeTypes.map(({ type, renderer }) => {
          const Icon = renderer.icon

          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => handleDragStart(e, type)}
              onDragEnd={handleDragEnd}
              onClick={() => handleNodeClick(type)}
              className={`flex items-center p-3 rounded-lg cursor-move hover:bg-purple-50 transition-colors ${
                draggedNodeType === type ? 'bg-purple-100 shadow-md' : 'bg-gray-50'
              }`}
              title={isCollapsed ? renderer.displayName : undefined}
            >
              <Icon className="w-5 h-5 text-gray-600 flex-shrink-0" />
              {!isCollapsed && (
                <span className="ml-3 text-sm font-medium text-gray-900">
                  {renderer.displayName}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Instructions */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            Drag nodes to canvas or click to add
          </p>
        </div>
      )}
    </div>
  )
}