import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '../types';
import { Volume2, Play, Pause, Trash2, Download } from 'lucide-react';

export interface VoiceNoteData {
  id: string;
  audioUrl: string;
  duration: number;
  createdAt: Date;
  title?: string;
  transcription?: string;
}

export function VoiceNoteNode({ data, selected }: NodeProps<VoiceNoteData>) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = data.audioUrl;
    a.download = `voice-note-${data.id}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(data.id);
    }
  };

  const progress = (currentTime / data.duration) * 100;

  return (
    <div
      className={`bg-white rounded-lg shadow-lg p-4 min-w-[280px] border-2 transition-all ${
        selected ? 'border-blue-500 shadow-xl' : 'border-gray-200'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />

      <audio ref={audioRef} src={data.audioUrl} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-blue-500" />
          <span className="font-medium text-sm">Voice Note</span>
        </div>
        {isHovered && (
          <div className="flex gap-1">
            <button
              onClick={handleDownload}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        )}
      </div>

      {/* Title */}
      {data.title && (
        <div className="mb-2">
          <input
            type="text"
            value={data.title}
            onChange={(e) => {
              if (data.onUpdate) {
                data.onUpdate(data.id, { title: e.target.value });
              }
            }}
            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Add a title..."
          />
        </div>
      )}

      {/* Player Controls */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={togglePlayPause}
          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>
        
        <div className="flex-1">
          <div className="relative h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(data.duration)}</span>
          </div>
        </div>
      </div>

      {/* Transcription */}
      {data.transcription && (
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-700">
          <div className="font-medium mb-1">Transcription:</div>
          <div className="italic">{data.transcription}</div>
        </div>
      )}

      {/* Created Date */}
      <div className="mt-2 text-xs text-gray-400">
        {new Date(data.createdAt).toLocaleString()}
      </div>
    </div>
  );
}