import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Play, Pause, Square, Upload, Loader2 } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import type { NodeProps, AudioNodeData } from '../../types'

export function AudioNode({ 
  node, 
  selected, 
  onUpdate, 
  onDelete, 
  onStartConnection 
}: NodeProps<AudioNodeData>) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        
        onUpdate({
          data: {
            ...node.data,
            url,
            file: blob,
            duration: recordingTime,
            recordedAt: new Date(),
          },
        })

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        setRecordingTime(0)
      }

      mediaRecorder.start()
      setIsRecording(true)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Failed to start recording:', error)
      alert('Unable to access microphone. Please check permissions.')
    }
  }, [recordingTime, node.data, onUpdate])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const togglePlayPause = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
    }
  }, [isPlaying])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file)
      onUpdate({
        data: {
          ...node.data,
          url,
          file,
          name: file.name,
        },
      })
    }
  }, [node.data, onUpdate])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(Math.floor(audioRef.current.currentTime))
    }
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      title="Audio"
      icon={<Mic className="w-4 h-4 text-red-600" />}
      onDelete={onDelete}
      onResize={(size) => onUpdate({ size })}
      onStartConnection={onStartConnection}
    >
      <div className="space-y-3">
        {!node.data.url ? (
          <>
            {/* Recording Controls */}
            <div className="flex flex-col items-center gap-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <Mic className="w-8 h-8" />
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center animate-pulse"
                  >
                    <Square className="w-6 h-6" />
                  </button>
                  <p className="text-lg font-mono">{formatTime(recordingTime)}</p>
                  <p className="text-xs text-gray-500">Recording...</p>
                </div>
              )}
            </div>

            {/* Upload Option */}
            {!isRecording && (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">or</p>
                <label className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm rounded-md cursor-pointer inline-block transition-colors">
                  <Upload className="w-4 h-4 inline mr-1" />
                  Upload Audio
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Audio Player */}
            <div className="bg-gray-50 rounded-lg p-3">
              <audio
                ref={audioRef}
                src={node.data.url}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={handleAudioTimeUpdate}
                onLoadedMetadata={(e) => {
                  const audio = e.target as HTMLAudioElement
                  if (!node.data.duration) {
                    onUpdate({
                      data: {
                        ...node.data,
                        duration: Math.floor(audio.duration),
                      },
                    })
                  }
                }}
                className="hidden"
              />

              {/* Custom Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlayPause}
                  className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" />
                  )}
                </button>

                {/* Progress Bar */}
                <div className="flex-1">
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-red-600 transition-all"
                      style={{
                        width: node.data.duration 
                          ? `${(currentTime / node.data.duration) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      {formatTime(currentTime)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(node.data.duration || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* File Info */}
              {node.data.name && (
                <p className="text-xs text-gray-600 mt-2 truncate">
                  {node.data.name}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (node.data.url && node.data.url.startsWith('blob:')) {
                    URL.revokeObjectURL(node.data.url)
                  }
                  onUpdate({ data: { url: undefined, file: undefined } })
                }}
                className="flex-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-sm rounded-md transition-colors"
              >
                New Recording
              </button>
              {node.data.url && (
                <a
                  href={node.data.url}
                  download={node.data.name || 'audio-recording.webm'}
                  className="flex-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-sm rounded-md transition-colors text-center"
                >
                  Download
                </a>
              )}
            </div>

            {/* Status */}
            {node.data.recordedAt && (
              <p className="text-xs text-gray-500 text-center">
                Recorded: {new Date(node.data.recordedAt).toLocaleString()}
              </p>
            )}
          </>
        )}
      </div>
    </BaseNode>
  )
}