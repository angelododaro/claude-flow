import React, { useState, useCallback } from 'react'
import { FileText, Upload, Download, Eye, X } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import type { NodeProps, DocumentNodeData } from '../../types'

export function DocumentNode({ 
  node, 
  selected, 
  onUpdate, 
  onDelete, 
  onStartConnection,
  onProcessDocument 
}: NodeProps<DocumentNodeData> & {
  onProcessDocument?: (file: File) => Promise<{ text: string; pageCount: number }>
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.includes('pdf') && !file.type.includes('text')) {
      alert('Please upload a PDF or text file')
      return
    }

    setIsUploading(true)
    
    try {
      // Create a data URL for the file
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        
        // Update node with file info
        const updatedData: DocumentNodeData = {
          ...node.data,
          url: dataUrl,
          name: file.name,
          fileType: file.type.includes('pdf') ? 'pdf' : 'txt',
          size: file.size,
        }

        // Process the document if handler provided
        if (onProcessDocument) {
          try {
            const result = await onProcessDocument(file)
            updatedData.extractedText = result.text
            updatedData.pageCount = result.pageCount
          } catch (error) {
            console.error('Failed to process document:', error)
          }
        }

        onUpdate({ data: updatedData })
      }
      
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Failed to upload document:', error)
      alert('Failed to upload document')
    } finally {
      setIsUploading(false)
    }
  }, [node.data, onUpdate, onProcessDocument])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const downloadDocument = () => {
    if (node.data.url) {
      const link = document.createElement('a')
      link.href = node.data.url
      link.download = node.data.name || 'document'
      link.click()
    }
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      title="Document"
      icon={<FileText className="w-4 h-4 text-blue-600" />}
      onDelete={onDelete}
      onResize={(size) => onUpdate({ size })}
      onStartConnection={onStartConnection}
    >
      {!node.data.url ? (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-2">
            Drag and drop a document here
          </p>
          <label className="inline-block">
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
              className="hidden"
              disabled={isUploading}
            />
            <span className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer inline-block">
              {isUploading ? 'Uploading...' : 'Choose File'}
            </span>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Document Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">
                  {node.data.name || 'Untitled Document'}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{node.data.fileType?.toUpperCase()}</span>
                  {node.data.size && <span>{formatFileSize(node.data.size)}</span>}
                  {node.data.pageCount && <span>{node.data.pageCount} pages</span>}
                </div>
              </div>
              <button
                onClick={() => {
                  onUpdate({ data: { ...node.data, url: undefined, extractedText: undefined } })
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Remove document"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-sm"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? 'Hide' : 'Preview'}
            </button>
            <button
              onClick={downloadDocument}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          {/* Preview */}
          {showPreview && node.data.extractedText && (
            <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
              <p className="text-xs text-gray-600 whitespace-pre-wrap">
                {node.data.extractedText.slice(0, 500)}
                {node.data.extractedText.length > 500 && '...'}
              </p>
            </div>
          )}

          {/* Status */}
          {node.data.extractedText && (
            <p className="text-xs text-green-600 text-center">
              ✓ Content indexed for search
            </p>
          )}
        </div>
      )}
    </BaseNode>
  )
}