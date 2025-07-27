# Export Functionality Integration Guide

## Overview
Implement board export capabilities using html2canvas for image capture and jsPDF for PDF generation. This allows users to save and share their boards in various formats.

## Installation

```bash
npm install html2canvas jspdf file-saver
npm install --save-dev @types/file-saver
```

## Implementation Steps

### 1. Export Service (src/services/exportService.ts)

```typescript
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import { toPng, toJpeg, toSvg } from 'html-to-image';

export interface ExportOptions {
  format: 'png' | 'jpg' | 'pdf' | 'svg' | 'json';
  quality?: number; // 0-1 for jpg
  scale?: number; // Resolution multiplier
  background?: string;
  includeWatermark?: boolean;
}

export class ExportService {
  /**
   * Export ReactFlow canvas to various formats
   */
  async exportBoard(
    boardElement: HTMLElement,
    boardData: any,
    options: ExportOptions
  ): Promise<void> {
    const fileName = `board-${new Date().toISOString().split('T')[0]}`;

    switch (options.format) {
      case 'png':
        await this.exportAsPNG(boardElement, fileName, options);
        break;
      case 'jpg':
        await this.exportAsJPG(boardElement, fileName, options);
        break;
      case 'pdf':
        await this.exportAsPDF(boardElement, fileName, options);
        break;
      case 'svg':
        await this.exportAsSVG(boardElement, fileName, options);
        break;
      case 'json':
        await this.exportAsJSON(boardData, fileName);
        break;
    }
  }

  private async exportAsPNG(
    element: HTMLElement,
    fileName: string,
    options: ExportOptions
  ): Promise<void> {
    const dataUrl = await toPng(element, {
      quality: options.quality || 1,
      pixelRatio: options.scale || 2,
      backgroundColor: options.background || '#ffffff',
      filter: (node) => {
        // Exclude certain elements from export
        return !node.classList?.contains('no-export');
      },
    });

    if (options.includeWatermark) {
      const watermarkedUrl = await this.addWatermark(dataUrl);
      saveAs(watermarkedUrl, `${fileName}.png`);
    } else {
      saveAs(dataUrl, `${fileName}.png`);
    }
  }

  private async exportAsJPG(
    element: HTMLElement,
    fileName: string,
    options: ExportOptions
  ): Promise<void> {
    const dataUrl = await toJpeg(element, {
      quality: options.quality || 0.9,
      pixelRatio: options.scale || 2,
      backgroundColor: options.background || '#ffffff',
    });

    saveAs(dataUrl, `${fileName}.jpg`);
  }

  private async exportAsPDF(
    element: HTMLElement,
    fileName: string,
    options: ExportOptions
  ): Promise<void> {
    // Get element dimensions
    const rect = element.getBoundingClientRect();
    const scale = options.scale || 2;

    // Create canvas from element
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: options.background || '#ffffff',
      logging: false,
      width: rect.width,
      height: rect.height,
    });

    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add image to PDF
    const imgData = canvas.toDataURL('image/png');
    
    // Handle multi-page PDFs for large boards
    let position = 0;
    const pageHeight = pdf.internal.pageSize.height;

    if (imgHeight > pageHeight) {
      // Multi-page PDF
      while (position < imgHeight) {
        if (position > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(
          imgData,
          'PNG',
          0,
          position ? -position : 0,
          imgWidth,
          imgHeight
        );
        
        position += pageHeight;
      }
    } else {
      // Single page PDF
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    }

    // Add metadata
    pdf.setProperties({
      title: fileName,
      subject: 'RAGBOARD Export',
      author: 'RAGBOARD',
      keywords: 'board, export, ragboard',
      creator: 'RAGBOARD App',
    });

    pdf.save(`${fileName}.pdf`);
  }

  private async exportAsSVG(
    element: HTMLElement,
    fileName: string,
    options: ExportOptions
  ): Promise<void> {
    const dataUrl = await toSvg(element, {
      backgroundColor: options.background || '#ffffff',
    });

    // Convert data URL to blob
    const svgBlob = await (await fetch(dataUrl)).blob();
    saveAs(svgBlob, `${fileName}.svg`);
  }

  private async exportAsJSON(
    boardData: any,
    fileName: string
  ): Promise<void> {
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      board: boardData,
    };

    const blob = new Blob(
      [JSON.stringify(exportData, null, 2)],
      { type: 'application/json' }
    );
    
    saveAs(blob, `${fileName}.json`);
  }

  private async addWatermark(dataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        
        // Add watermark
        ctx.font = '24px Arial';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          'RAGBOARD',
          canvas.width - 20,
          canvas.height - 20
        );
        
        resolve(canvas.toDataURL());
      };
      img.src = dataUrl;
    });
  }
}

export const exportService = new ExportService();
```

### 2. Export Modal Component (src/components/ExportModal.tsx)

```typescript
import { useState } from 'react';
import { Download, FileImage, FileText, FileJson } from 'lucide-react';
import { exportService, ExportOptions } from '../services/exportService';
import { useBoardStore } from '../store/boardStore';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardRef: React.RefObject<HTMLDivElement>;
}

export function ExportModal({ isOpen, onClose, boardRef }: ExportModalProps) {
  const { nodes, edges, viewport } = useBoardStore();
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'png',
    quality: 0.9,
    scale: 2,
    background: '#ffffff',
    includeWatermark: false,
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!boardRef.current) return;

    setIsExporting(true);
    try {
      const boardData = {
        nodes,
        edges,
        viewport,
      };

      await exportService.exportBoard(
        boardRef.current,
        boardData,
        exportOptions
      );

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Export Board</h2>

        {/* Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Export Format
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'png', icon: FileImage, label: 'PNG Image' },
              { value: 'jpg', icon: FileImage, label: 'JPG Image' },
              { value: 'pdf', icon: FileText, label: 'PDF Document' },
              { value: 'svg', icon: FileImage, label: 'SVG Vector' },
              { value: 'json', icon: FileJson, label: 'JSON Data' },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() =>
                  setExportOptions({ ...exportOptions, format: value as any })
                }
                className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-colors ${
                  exportOptions.format === value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Icon size={24} />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quality Settings (for JPG) */}
        {exportOptions.format === 'jpg' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Image Quality: {Math.round(exportOptions.quality! * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={exportOptions.quality}
              onChange={(e) =>
                setExportOptions({
                  ...exportOptions,
                  quality: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
          </div>
        )}

        {/* Resolution Settings */}
        {['png', 'jpg', 'pdf'].includes(exportOptions.format) && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Resolution Scale: {exportOptions.scale}x
            </label>
            <input
              type="range"
              min="1"
              max="4"
              step="0.5"
              value={exportOptions.scale}
              onChange={(e) =>
                setExportOptions({
                  ...exportOptions,
                  scale: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
          </div>
        )}

        {/* Background Color */}
        {exportOptions.format !== 'json' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Background Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={exportOptions.background}
                onChange={(e) =>
                  setExportOptions({
                    ...exportOptions,
                    background: e.target.value,
                  })
                }
                className="w-12 h-10 rounded border border-gray-300"
              />
              <button
                onClick={() =>
                  setExportOptions({
                    ...exportOptions,
                    background: 'transparent',
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Transparent
              </button>
            </div>
          </div>
        )}

        {/* Watermark Option */}
        {['png', 'jpg'].includes(exportOptions.format) && (
          <div className="mb-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={exportOptions.includeWatermark}
                onChange={(e) =>
                  setExportOptions({
                    ...exportOptions,
                    includeWatermark: e.target.checked,
                  })
                }
                className="rounded"
              />
              <span className="text-sm">Include watermark</span>
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isExporting ? (
              <>Exporting...</>
            ) : (
              <>
                <Download size={20} />
                Export
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Board Canvas Integration (src/components/BoardCanvas.tsx)

```typescript
export function BoardCanvas() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <>
      <div className="board-container relative">
        {/* Export button in toolbar */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download size={20} />
            Export
          </button>
        </div>

        {/* ReactFlow canvas */}
        <div ref={boardRef} className="w-full h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            // ... other props
          >
            {/* Your board content */}
          </ReactFlow>
        </div>
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        boardRef={boardRef}
      />
    </>
  );
}
```

### 4. Advanced Export Features (src/components/ExportAdvanced.tsx)

```typescript
export function ExportAdvanced() {
  const [exportArea, setExportArea] = useState<'full' | 'selection' | 'viewport'>('full');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  const exportSelection = async () => {
    // Create temporary container with only selected nodes
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    // Clone and render selected nodes
    const selectedElements = selectedNodes.map(id => 
      document.querySelector(`[data-node-id="${id}"]`)?.cloneNode(true)
    );

    selectedElements.forEach(el => {
      if (el) tempContainer.appendChild(el);
    });

    // Export the selection
    await exportService.exportBoard(tempContainer, {...}, options);

    // Cleanup
    document.body.removeChild(tempContainer);
  };

  return (
    <div className="export-advanced">
      <h3>Export Area</h3>
      <select 
        value={exportArea} 
        onChange={(e) => setExportArea(e.target.value as any)}
      >
        <option value="full">Full Board</option>
        <option value="selection">Selected Nodes</option>
        <option value="viewport">Current View</option>
      </select>

      {exportArea === 'selection' && (
        <NodeSelector
          nodes={nodes}
          selected={selectedNodes}
          onSelectionChange={setSelectedNodes}
        />
      )}
    </div>
  );
}
```

### 5. Backend Export API (backend/app/api/endpoints/board_export.py)

```python
from fastapi import APIRouter, Depends, BackgroundTasks
from app.services.export_service import generate_export

router = APIRouter()

@router.post("/boards/{board_id}/export")
async def export_board(
    board_id: str,
    format: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Generate board export with server-side rendering"""
    
    # For complex boards, generate export server-side
    if format == "pdf":
        task_id = str(uuid.uuid4())
        background_tasks.add_task(
            generate_pdf_export,
            board_id,
            task_id,
            current_user.id
        )
        return {"task_id": task_id, "status": "processing"}
    
    return {"error": "Format not supported server-side"}

@router.get("/export/status/{task_id}")
async def get_export_status(task_id: str):
    """Check export generation status"""
    status = await get_task_status(task_id)
    if status["completed"]:
        return {
            "status": "completed",
            "download_url": status["result_url"]
        }
    return {"status": "processing", "progress": status["progress"]}
```

## Performance Optimization

1. **Lazy Loading**: Load export libraries only when needed
```typescript
const exportModule = await import('../services/exportService');
```

2. **Web Workers**: Process large exports in background
3. **Chunking**: Export large boards in sections
4. **Caching**: Cache rendered canvases for quick re-export

## Testing

```typescript
describe('Export Service', () => {
  it('exports board as PNG', async () => {
    const element = document.createElement('div');
    const spy = jest.spyOn(saveAs, 'saveAs');
    
    await exportService.exportBoard(element, {}, {
      format: 'png',
      quality: 1,
      scale: 2,
    });
    
    expect(spy).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringContaining('.png')
    );
  });
});
```

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Limited SVG export
- Mobile: Reduced resolution for performance