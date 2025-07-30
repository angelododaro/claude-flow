'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { trpc } from '@/lib/trpc-client'
import { nodeRegistry } from '@ragboard/nodes'
import type { BaseNodeData, Position, Size } from '@ragboard/nodes'
import { NodeType } from '@ragboard/types'

interface NodeLayerProps {
  boardId: string
  excalidrawViewportState?: {
    zoom: { value: number }
    scrollX: number
    scrollY: number
  }
  onNodesChange?: () => void
}

interface DragState {
  nodeId: string
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

interface ConnectionState {
  fromNodeId: string
  fromPort: string
  tempLine?: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
}

export function NodeLayer({ boardId, excalidrawViewportState, onNodesChange }: NodeLayerProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null)
  const layerRef = useRef<HTMLDivElement>(null)

  // Fetch nodes and connections
  const { data: nodes, refetch: refetchNodes } = trpc.node.list.useQuery({ boardId })
  const { data: board } = trpc.board.get.useQuery({ id: boardId })

  // Mutations
  const updateNode = trpc.node.update.useMutation({
    onSuccess: () => {
      refetchNodes()
      onNodesChange?.()
    },
  })

  const deleteNode = trpc.node.delete.useMutation({
    onSuccess: () => {
      refetchNodes()
      onNodesChange?.()
    },
  })

  const createConnection = trpc.connection.create.useMutation({
    onSuccess: () => {
      refetchNodes()
      onNodesChange?.()
    },
  })

  // AI mutations
  const chatMutation = trpc.ai.chat.useMutation()
  const scrapeURLMutation = trpc.ai.scrapeURL.useMutation()
  const extractPDFMutation = trpc.ai.extractPDF.useMutation()

  // Transform node position based on Excalidraw viewport
  const transformPosition = useCallback(
    (position: Position): Position => {
      if (!excalidrawViewportState) return position
      const { zoom, scrollX, scrollY } = excalidrawViewportState
      return {
        x: (position.x - scrollX) * zoom.value,
        y: (position.y - scrollY) * zoom.value,
      }
    },
    [excalidrawViewportState]
  )

  // Inverse transform for mouse position to world coordinates
  const inverseTransformPosition = useCallback(
    (position: Position): Position => {
      if (!excalidrawViewportState) return position
      const { zoom, scrollX, scrollY } = excalidrawViewportState
      return {
        x: position.x / zoom.value + scrollX,
        y: position.y / zoom.value + scrollY,
      }
    },
    [excalidrawViewportState]
  )

  // Handle node drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.preventDefault()
      e.stopPropagation()
      
      const node = nodes?.find((n) => n.id === nodeId)
      if (!node) return

      const rect = layerRef.current?.getBoundingClientRect()
      if (!rect) return

      setSelectedNodeId(nodeId)
      setDragState({
        nodeId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left - transformPosition(node.position as Position).x,
        offsetY: e.clientY - rect.top - transformPosition(node.position as Position).y,
      })
    },
    [nodes, transformPosition]
  )

  // Handle global mouse move for dragging
  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = layerRef.current?.getBoundingClientRect()
      if (!rect) return

      const newPosition = inverseTransformPosition({
        x: e.clientX - rect.left - dragState.offsetX,
        y: e.clientY - rect.top - dragState.offsetY,
      })

      updateNode.mutate({
        id: dragState.nodeId,
        position: newPosition,
      })
    }

    const handleMouseUp = () => {
      setDragState(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, updateNode, inverseTransformPosition])

  // Handle connection drawing
  useEffect(() => {
    if (!connectionState) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = layerRef.current?.getBoundingClientRect()
      if (!rect) return

      const fromNode = nodes?.find((n) => n.id === connectionState.fromNodeId)
      if (!fromNode) return

      const fromPos = transformPosition(fromNode.position as Position)
      
      setConnectionState({
        ...connectionState,
        tempLine: {
          x1: fromPos.x + (fromNode.size as Size).width / 2,
          y1: fromPos.y + (fromNode.size as Size).height / 2,
          x2: e.clientX - rect.left,
          y2: e.clientY - rect.top,
        },
      })
    }

    const handleMouseUp = () => {
      setConnectionState(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [connectionState, nodes, transformPosition])

  // Handle node update
  const handleNodeUpdate = useCallback(
    (nodeId: string, updates: Partial<BaseNodeData>) => {
      updateNode.mutate({
        id: nodeId,
        ...updates,
      })
    },
    [updateNode]
  )

  // Handle node delete
  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      deleteNode.mutate({ id: nodeId })
      setSelectedNodeId(null)
    },
    [deleteNode]
  )

  // Handle connection start
  const handleStartConnection = useCallback((nodeId: string, port: string) => {
    setConnectionState({
      fromNodeId: nodeId,
      fromPort: port,
    })
  }, [])

  // Handle connection end
  const handleEndConnection = useCallback(
    (nodeId: string, port: string) => {
      if (!connectionState || connectionState.fromNodeId === nodeId) {
        setConnectionState(null)
        return
      }

      createConnection.mutate({
        fromNodeId: connectionState.fromNodeId,
        toNodeId: nodeId,
        fromPort: connectionState.fromPort,
        toPort: port,
      })

      setConnectionState(null)
    },
    [connectionState, createConnection]
  )

  // Handle AI chat
  const handleChat = useCallback(
    async (nodeId: string, messages: any[]) => {
      const result = await chatMutation.mutateAsync({
        boardId,
        nodeId,
        messages,
        options: {
          useRAG: true,
        },
      })

      return {
        answer: result.answer,
        sources: result.sources,
      }
    },
    [boardId, chatMutation]
  )

  // Handle URL scraping
  const handleScrapeURL = useCallback(
    async (url: string) => {
      const result = await scrapeURLMutation.mutateAsync({ url })
      return result
    },
    [scrapeURLMutation]
  )

  // Handle PDF processing
  const handleProcessDocument = useCallback(
    async (file: File) => {
      // Convert file to base64
      return new Promise<{ text: string; pageCount: number }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const base64 = e.target?.result as string
            const result = await extractPDFMutation.mutateAsync({ base64 })
            resolve(result)
          } catch (error) {
            reject(error)
          }
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    },
    [extractPDFMutation]
  )

  // Render connections
  const renderConnections = () => {
    if (!nodes) return null

    const connections: JSX.Element[] = []

    nodes.forEach((node) => {
      node.fromConnections?.forEach((conn) => {
        const fromPos = transformPosition(node.position as Position)
        const toNode = nodes.find((n) => n.id === conn.toNodeId)
        if (!toNode) return

        const toPos = transformPosition(toNode.position as Position)

        connections.push(
          <line
            key={conn.id}
            x1={fromPos.x + (node.size as Size).width / 2}
            y1={fromPos.y + (node.size as Size).height / 2}
            x2={toPos.x + (toNode.size as Size).width / 2}
            y2={toPos.y + (toNode.size as Size).height / 2}
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray={conn.data?.style === 'dashed' ? '5,5' : undefined}
            opacity={0.8}
          />
        )
      })
    })

    // Render temporary connection line
    if (connectionState?.tempLine) {
      connections.push(
        <line
          key="temp-connection"
          x1={connectionState.tempLine.x1}
          y1={connectionState.tempLine.y1}
          x2={connectionState.tempLine.x2}
          y2={connectionState.tempLine.y2}
          stroke="#6366f1"
          strokeWidth={2}
          strokeDasharray="5,5"
          opacity={0.5}
        />
      )
    }

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      >
        {connections}
      </svg>
    )
  }

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: 'none' }}
    >
      {/* Connections layer */}
      {renderConnections()}

      {/* Nodes layer */}
      <div className="relative w-full h-full">
        {nodes?.map((node) => {
          const renderer = nodeRegistry.get(node.type as NodeType)
          if (!renderer) return null

          const transformedPosition = transformPosition(node.position as Position)
          const scale = excalidrawViewportState?.zoom.value || 1

          return (
            <div
              key={node.id}
              className="absolute"
              style={{
                left: transformedPosition.x,
                top: transformedPosition.y,
                width: (node.size as Size).width * scale,
                height: (node.size as Size).height * scale,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => handleMouseDown(e, node.id)}
            >
              <renderer.component
                node={node as any}
                selected={selectedNodeId === node.id}
                onUpdate={(updates) => handleNodeUpdate(node.id, updates)}
                onDelete={() => handleNodeDelete(node.id)}
                onStartConnection={(port) => handleStartConnection(node.id, port)}
                onEndConnection={(port) => handleEndConnection(node.id, port)}
                onChat={node.type === NodeType.AI_CHAT ? (messages) => handleChat(node.id, messages) : undefined}
                onScrapeURL={node.type === NodeType.URL ? handleScrapeURL : undefined}
                onProcessDocument={node.type === NodeType.DOCUMENT ? handleProcessDocument : undefined}
                nodes={node.type === NodeType.FOLDER ? nodes : undefined}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}