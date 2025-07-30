'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc-client'
import { ArrowLeft, Save, Share2, Loader2 } from 'lucide-react'
import type { ExcalidrawElement, ExcalidrawImperativeAPI, AppState, BinaryFiles } from '@excalidraw/excalidraw/types/types'
import { useDebounce } from '@/hooks/useDebounce'
import { NodeLayer } from '@/components/NodeLayer'
import { NodeSidebar } from '@/components/NodeSidebar'
import { nodeRegistry } from '@ragboard/nodes'
import { NodeType } from '@ragboard/types'

// Dynamic import to avoid SSR issues
const Canvas = dynamic(
  () => import('@ragboard/canvas').then((mod) => mod.Canvas),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    ),
  }
)

export default function BoardPage() {
  const params = useParams()
  const router = useRouter()
  const boardId = params.id as string
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null)
  const [canvasData, setCanvasData] = useState<{
    elements: readonly ExcalidrawElement[]
    appState: AppState
    files: BinaryFiles
  } | null>(null)
  const [excalidrawViewportState, setExcalidrawViewportState] = useState<{
    zoom: { value: number }
    scrollX: number
    scrollY: number
  } | undefined>()

  const { data: board, isLoading } = trpc.board.get.useQuery({ id: boardId })
  const updateBoard = trpc.board.update.useMutation({
    onSuccess: () => {
      setHasChanges(false)
      setIsSaving(false)
    },
    onError: () => {
      setIsSaving(false)
    },
  })
  const createNode = trpc.node.create.useMutation()

  // Debounce canvas data for auto-save
  const debouncedCanvasData = useDebounce(canvasData, 2000)

  // Auto-save when canvas data changes
  useEffect(() => {
    if (debouncedCanvasData && hasChanges && !isSaving) {
      handleSave()
    }
  }, [debouncedCanvasData])

  const handleCanvasChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      setCanvasData({ elements, appState, files })
      setHasChanges(true)
      // Update viewport state for node layer
      setExcalidrawViewportState({
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      })
    },
    []
  )

  const handleSave = async () => {
    if (!excalidrawAPI.current || !hasChanges || isSaving) return

    setIsSaving(true)
    const elements = excalidrawAPI.current.getSceneElements()
    const appState = excalidrawAPI.current.getAppState()
    const files = excalidrawAPI.current.getFiles()

    updateBoard.mutate({
      id: boardId,
      data: {
        elements,
        appState,
        files,
      },
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Board not found</h2>
          <p className="mt-2 text-gray-600">The board you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/boards')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Back to boards
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/boards')}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">{board.name}</h1>
              {board.description && (
                <p className="text-sm text-gray-500">{board.description}</p>
              )}
            </div>
            {hasChanges && (
              <span className="text-sm text-gray-500">
                {isSaving ? 'Saving...' : '• Unsaved changes'}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-md transition-colors">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas with nodes */}
      <div className="flex-1 bg-gray-50 relative">
        {/* Node sidebar */}
        <NodeSidebar 
          boardId={boardId} 
          onNodeCreated={() => {
            // Force refresh nodes
            setHasChanges(true)
          }}
        />
        
        {/* Canvas */}
        <div 
          className="absolute inset-0"
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={async (e) => {
            e.preventDefault()
            const nodeType = e.dataTransfer.getData('nodeType') as NodeType
            if (!nodeType) return

            const renderer = nodeRegistry.get(nodeType)
            if (!renderer) return

            // Get drop position relative to canvas
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top

            // Convert to world coordinates
            const worldPos = excalidrawViewportState
              ? {
                  x: x / excalidrawViewportState.zoom.value + excalidrawViewportState.scrollX,
                  y: y / excalidrawViewportState.zoom.value + excalidrawViewportState.scrollY,
                }
              : { x, y }

            // Create node at drop position
            await createNode.mutateAsync({
              boardId,
              type: nodeType,
              position: {
                x: worldPos.x - renderer.defaultSize.width / 2,
                y: worldPos.y - renderer.defaultSize.height / 2,
              },
              size: renderer.defaultSize,
              data: renderer.defaultData(),
            })

            setHasChanges(true)
          }}
        >
          <Canvas
            initialData={board.data as any}
            onChange={handleCanvasChange}
            onReady={(api) => {
              excalidrawAPI.current = api
              // Set initial viewport state
              const appState = api.getAppState()
              setExcalidrawViewportState({
                zoom: appState.zoom,
                scrollX: appState.scrollX,
                scrollY: appState.scrollY,
              })
            }}
          />
          
          {/* Node layer overlay */}
          <NodeLayer
            boardId={boardId}
            excalidrawViewportState={excalidrawViewportState}
            onNodesChange={() => setHasChanges(true)}
          />
        </div>
      </div>
    </div>
  )
}