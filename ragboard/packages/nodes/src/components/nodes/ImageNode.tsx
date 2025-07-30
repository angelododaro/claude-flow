import React, { useState } from 'react'
import { Image as ImageIcon, Upload } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import type { NodeProps, ImageNodeData } from '../../types'

export function ImageNode({ node, selected, onUpdate, onDelete, onStartConnection }: NodeProps<ImageNodeData>) {
  const [isUploadHovered, setIsUploadHovered] = useState(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        onUpdate({
          data: {
            ...node.data,
            url: event.target?.result as string,
            file,
          },
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUrlInput = () => {
    const url = prompt('Enter image URL:')
    if (url) {
      onUpdate({
        data: {
          ...node.data,
          url,
        },
      })
    }
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      title="Image"
      icon={<ImageIcon className="w-4 h-4 text-blue-600" />}
      onDelete={onDelete}
      onResize={(size) => onUpdate({ size })}
      onStartConnection={onStartConnection}
    >
      {node.data.url ? (
        <div className="space-y-2">
          <img
            src={node.data.url}
            alt={node.data.caption || 'Image'}
            className="w-full h-auto rounded-md"
          />
          <input
            type="text"
            placeholder="Add caption..."
            value={node.data.caption || ''}
            onChange={(e) =>
              onUpdate({
                data: {
                  ...node.data,
                  caption: e.target.value,
                },
              })
            }
            className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isUploadHovered ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setIsUploadHovered(true)
          }}
          onDragLeave={() => setIsUploadHovered(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsUploadHovered(false)
            const file = e.dataTransfer.files[0]
            if (file && file.type.startsWith('image/')) {
              const reader = new FileReader()
              reader.onload = (event) => {
                onUpdate({
                  data: {
                    ...node.data,
                    url: event.target?.result as string,
                    file,
                  },
                })
              }
              reader.readAsDataURL(file)
            }
          }}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-2">
            Drag and drop an image here, or click to upload
          </p>
          <div className="flex gap-2 justify-center">
            <label className="px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 cursor-pointer">
              Upload
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={handleUrlInput}
              className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300"
            >
              From URL
            </button>
          </div>
        </div>
      )}
    </BaseNode>
  )
}