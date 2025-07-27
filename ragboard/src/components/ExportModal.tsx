import React, { useState } from 'react';
import { X, Download, FileImage, FileText, FileJson } from 'lucide-react';
import { ExportOptions } from '../services/exportService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions & { metadata?: { title?: string; description?: string } }) => void;
  boardTitle?: string;
}

export function ExportModal({ isOpen, onClose, onExport, boardTitle = 'Untitled Board' }: ExportModalProps) {
  const [format, setFormat] = useState<'png' | 'jpg' | 'pdf'>('png');
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(95);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [title, setTitle] = useState(boardTitle);
  const [description, setDescription] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport({
        format,
        scale,
        quality: quality / 100,
        includeMetadata,
        metadata: {
          title,
          description,
        },
      });
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Export Board</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setFormat('png')}
                className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                  format === 'png' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileImage className="w-6 h-6 mb-1" />
                <span className="text-sm">PNG</span>
              </button>
              <button
                onClick={() => setFormat('jpg')}
                className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                  format === 'jpg' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileImage className="w-6 h-6 mb-1" />
                <span className="text-sm">JPG</span>
              </button>
              <button
                onClick={() => setFormat('pdf')}
                className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                  format === 'pdf' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className="w-6 h-6 mb-1" />
                <span className="text-sm">PDF</span>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              File Name
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter file name"
            />
          </div>

          {/* Description (for PDF) */}
          {format === 'pdf' && (
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Add a description for the PDF metadata"
              />
            </div>
          )}

          {/* Quality Slider (for JPG) */}
          {format === 'jpg' && (
            <div>
              <label htmlFor="quality" className="block text-sm font-medium text-gray-700 mb-1">
                Quality: {quality}%
              </label>
              <input
                id="quality"
                type="range"
                min="10"
                max="100"
                step="5"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          {/* Scale Slider */}
          <div>
            <label htmlFor="scale" className="block text-sm font-medium text-gray-700 mb-1">
              Resolution Scale: {scale}x
            </label>
            <input
              id="scale"
              type="range"
              min="1"
              max="4"
              step="0.5"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher scale = better quality but larger file size
            </p>
          </div>

          {/* Include Metadata (for PDF) */}
          {format === 'pdf' && (
            <div className="flex items-center">
              <input
                id="includeMetadata"
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeMetadata" className="ml-2 text-sm text-gray-700">
                Include metadata page with board statistics
              </label>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || !title.trim()}
            className="flex-1 px-4 py-2 text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}