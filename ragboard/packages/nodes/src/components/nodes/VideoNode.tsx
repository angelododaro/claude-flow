import React, { useState, useRef, useCallback } from 'react'
import { Video, Play, Pause, Upload, Link } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import type { NodeProps, VideoNodeData } from '../../types'

export function VideoNode({ 
  node, 
  selected, 
  onUpdate, 
  onDelete, 
  onStartConnection 
}: NodeProps<VideoNodeData>) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file)
      onUpdate({
        data: {
          ...node.data,
          url,
          file,
          platform: 'local',
          name: file.name,
        },
      })
    }
  }, [node.data, onUpdate])

  const handleUrlSubmit = useCallback(() => {
    if (!urlInput) return

    // Detect platform
    let platform: 'youtube' | 'vimeo' | 'local' = 'local'
    let embedUrl = urlInput

    if (urlInput.includes('youtube.com') || urlInput.includes('youtu.be')) {
      platform = 'youtube'
      // Extract video ID
      const match = urlInput.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
      if (match) {
        embedUrl = `https://www.youtube.com/embed/${match[1]}`
      }
    } else if (urlInput.includes('vimeo.com')) {
      platform = 'vimeo'
      // Extract video ID
      const match = urlInput.match(/vimeo\.com\/(\d+)/)
      if (match) {
        embedUrl = `https://player.vimeo.com/video/${match[1]}`
      }
    }

    onUpdate({
      data: {
        ...node.data,
        url: embedUrl,
        originalUrl: urlInput,
        platform,
      },
    })

    setUrlInput('')
    setShowUrlInput(false)
  }, [urlInput, node.data, onUpdate])

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file)
      onUpdate({
        data: {
          ...node.data,
          url,
          file,
          platform: 'local',
          name: file.name,
        },
      })
    }
  }, [node.data, onUpdate])

  const renderVideo = () => {
    if (!node.data.url) return null

    if (node.data.platform === 'youtube' || node.data.platform === 'vimeo') {
      return (
        <iframe
          src={node.data.url}
          className="w-full h-48 rounded-md"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      )
    }

    return (
      <div className="relative group">
        <video
          ref={videoRef}
          src={node.data.url}
          className="w-full h-48 object-cover rounded-md bg-black"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          controls
        />
        <div
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-md"
          onClick={togglePlayPause}
        >
          {isPlaying ? (
            <Pause className="w-12 h-12 text-white" />
          ) : (
            <Play className="w-12 h-12 text-white" />
          )}
        </div>
      </div>
    )
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      title="Video"
      icon={<Video className="w-4 h-4 text-purple-600" />}
      onDelete={onDelete}
      onResize={(size) => onUpdate({ size })}
      onStartConnection={onStartConnection}
    >
      {!node.data.url ? (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-3">
            Drop a video file or add from URL
          </p>
          <div className="flex gap-2 justify-center">
            <label className="px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 cursor-pointer">
              Upload
              <input
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setShowUrlInput(true)}
              className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300 flex items-center gap-1"
            >
              <Link className="w-3 h-3" />
              URL
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {renderVideo()}
          
          {node.data.name && (
            <p className="text-xs text-gray-600 truncate">{node.data.name}</p>
          )}

          <div className="flex gap-2 text-xs">
            <button
              onClick={() => onUpdate({ data: { ...node.data, url: undefined } })}
              className="flex-1 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Remove
            </button>
            {node.data.platform !== 'local' && node.data.originalUrl && (
              <a
                href={node.data.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-center"
              >
                Open Original
              </a>
            )}
          </div>
        </div>
      )}

      {/* URL Input Modal */}
      {showUrlInput && (
        <div className="absolute inset-0 bg-white rounded-lg p-4 flex flex-col">
          <h4 className="font-medium mb-2">Add Video from URL</h4>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="YouTube, Vimeo, or direct video URL"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
            autoFocus
            onKeyPress={(e) => e.key === 'Enter' && handleUrlSubmit()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleUrlSubmit}
              className="flex-1 px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowUrlInput(false)
                setUrlInput('')
              }}
              className="flex-1 px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </BaseNode>
  )
}