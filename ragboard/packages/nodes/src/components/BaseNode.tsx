import React, { useRef, useState, useCallback } from 'react'
import { X, Maximize2, Link } from 'lucide-react'
import { clsx } from 'clsx'
import type { BaseNodeData, NodeProps } from '../types'

interface BaseNodeProps {
  node: BaseNodeData
  selected: boolean
  children: React.ReactNode
  title?: string
  icon?: React.ReactNode
  className?: string
  resizable?: boolean
  onDelete?: () => void
  onResize?: (size: { width: number; height: number }) => void
  onStartConnection?: () => void
}

export function BaseNode({
  node,
  selected,
  children,
  title,
  icon,
  className,
  resizable = true,
  onDelete,
  onResize,
  onStartConnection,
}: BaseNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [startSize, setStartSize] = useState(node.size)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      setStartSize(node.size)
      setStartPos({ x: e.clientX, y: e.clientY })
    },
    [node.size]
  )

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return

      const deltaX = e.clientX - startPos.x
      const deltaY = e.clientY - startPos.y

      const newSize = {
        width: Math.max(200, startSize.width + deltaX),
        height: Math.max(100, startSize.height + deltaY),
      }

      onResize?.(newSize)
    },
    [isResizing, startPos, startSize, onResize]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  return (
    <div
      ref={nodeRef}
      className={clsx(
        'absolute bg-white rounded-lg shadow-lg border-2 transition-all',
        selected ? 'border-purple-500 shadow-xl' : 'border-gray-200',
        node.dragging && 'opacity-50',
        className
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.size.width,
        height: node.size.height,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {icon}
          {title && <h3 className="text-sm font-medium text-gray-900">{title}</h3>}
        </div>
        <div className="flex items-center gap-1">
          {onStartConnection && (
            <button
              onClick={onStartConnection}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Connect to another node"
            >
              <Link className="w-4 h-4 text-gray-500" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 hover:bg-red-50 rounded transition-colors"
              title="Delete node"
            >
              <X className="w-4 h-4 text-gray-500 hover:text-red-600" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 h-[calc(100%-52px)] overflow-auto">{children}</div>

      {/* Resize Handle */}
      {resizable && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
          onMouseDown={handleResizeStart}
        >
          <Maximize2 className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
        </div>
      )}

      {/* Connection Points */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-purple-500 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-crosshair" />
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-purple-500 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-crosshair" />
      <div className="absolute top-1/2 -left-2 transform -translate-y-1/2 w-4 h-4 bg-purple-500 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-crosshair" />
      <div className="absolute top-1/2 -right-2 transform -translate-y-1/2 w-4 h-4 bg-purple-500 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-crosshair" />
    </div>
  )
}