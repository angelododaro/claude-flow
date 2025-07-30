'use client'

import { useEffect, useRef, useState } from 'react'
import { Excalidraw, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw'
import type { 
  ExcalidrawElement,
  AppState,
  BinaryFiles,
} from '@excalidraw/excalidraw/types/types'

interface CanvasProps {
  initialData?: {
    elements?: readonly ExcalidrawElement[]
    appState?: Partial<AppState>
    files?: BinaryFiles
  }
  onChange?: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles
  ) => void
  onReady?: (api: ExcalidrawImperativeAPI) => void
  theme?: 'light' | 'dark'
  viewModeEnabled?: boolean
  zenModeEnabled?: boolean
  gridModeEnabled?: boolean
}

export function Canvas({
  initialData,
  onChange,
  onReady,
  theme = 'light',
  viewModeEnabled = false,
  zenModeEnabled = false,
  gridModeEnabled = false,
}: CanvasProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)

  useEffect(() => {
    if (excalidrawAPI) {
      onReady?.(excalidrawAPI)
    }
  }, [excalidrawAPI, onReady])

  return (
    <div className="w-full h-full">
      <Excalidraw
        ref={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
        initialData={initialData}
        onChange={(elements, appState, files) => {
          onChange?.(elements, appState, files)
        }}
        theme={theme}
        name="RAGBOARD Canvas"
        UIOptions={{
          canvasActions: {
            export: {
              saveAsImage: true,
              saveToActiveFile: false,
            },
            loadScene: false,
            toggleTheme: true,
          },
        }}
        viewModeEnabled={viewModeEnabled}
        zenModeEnabled={zenModeEnabled}
        gridModeEnabled={gridModeEnabled}
      />
    </div>
  )
}

// Re-export types
export type { 
  ExcalidrawImperativeAPI, 
  ExcalidrawElement,
  AppState,
  BinaryFiles,
} from '@excalidraw/excalidraw/types/types'

// Export utilities
export { exportToBlob, exportToSvg } from '@excalidraw/excalidraw'

export default Canvas