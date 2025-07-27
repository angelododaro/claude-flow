// Complete working example of export functionality for ragboard

import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';
import { useBoardStore } from '../store/boardStore';

// Simple export function for immediate use
export async function exportBoardAsPNG(element: HTMLElement, filename = 'board') {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
  });
  
  canvas.toBlob((blob) => {
    if (blob) {
      saveAs(blob, `${filename}.png`);
    }
  });
}

// Export button component - drop into your BoardCanvas
export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const handleExport = async (format: 'png' | 'pdf') => {
    const board = boardRef.current?.closest('.react-flow') as HTMLElement;
    if (!board) return;

    setIsExporting(true);
    
    try {
      if (format === 'png') {
        await exportBoardAsPNG(board, `ragboard-${Date.now()}`);
      } else if (format === 'pdf') {
        const canvas = await html2canvas(board, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`ragboard-${Date.now()}.pdf`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-10" ref={boardRef}>
      <div className="flex gap-2">
        <button
          onClick={() => handleExport('png')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={20} />
          {isExporting ? 'Exporting...' : 'PNG'}
        </button>
        
        <button
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={20} />
          PDF
        </button>
      </div>
    </div>
  );
}

// Integration with existing BoardCanvas component
export function BoardCanvasWithExport() {
  const { nodes, edges } = useBoardStore();
  
  return (
    <div className="relative w-full h-full">
      <ExportButton />
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        // ... your existing ReactFlow props
      >
        {/* Your existing board content */}
      </ReactFlow>
    </div>
  );
}

// Advanced export with options
export function AdvancedExportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [options, setOptions] = useState({
    format: 'png' as 'png' | 'jpg' | 'pdf',
    quality: 0.9,
    scale: 2,
    background: '#ffffff',
  });

  const handleExport = async () => {
    const board = document.querySelector('.react-flow') as HTMLElement;
    if (!board) return;

    const canvas = await html2canvas(board, {
      backgroundColor: options.background,
      scale: options.scale,
      useCORS: true,
    });

    switch (options.format) {
      case 'png':
        canvas.toBlob((blob) => {
          if (blob) saveAs(blob, `ragboard-${Date.now()}.png`);
        });
        break;
        
      case 'jpg':
        canvas.toBlob(
          (blob) => {
            if (blob) saveAs(blob, `ragboard-${Date.now()}.jpg`);
          },
          'image/jpeg',
          options.quality
        );
        break;
        
      case 'pdf':
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF();
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`ragboard-${Date.now()}.pdf`);
        break;
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-bold mb-4">Export Board</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Format</label>
            <select
              value={options.format}
              onChange={(e) => setOptions({ ...options, format: e.target.value as any })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          {options.format === 'jpg' && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Quality: {Math.round(options.quality * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={options.quality}
                onChange={(e) => setOptions({ ...options, quality: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Scale: {options.scale}x
            </label>
            <input
              type="range"
              min="1"
              max="4"
              step="0.5"
              value={options.scale}
              onChange={(e) => setOptions({ ...options, scale: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Background</label>
            <input
              type="color"
              value={options.background}
              onChange={(e) => setOptions({ ...options, background: e.target.value })}
              className="w-full h-10"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleExport}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Export
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Usage in your main component:
/*
import { ExportButton } from './components/ExportButton';

function App() {
  return (
    <div className="app">
      <BoardCanvas>
        <ExportButton />
      </BoardCanvas>
    </div>
  );
}
*/