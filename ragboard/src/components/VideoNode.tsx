import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '../types';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  X,
  GripVertical,
  Youtube,
  Video
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Resource } from '../types';
import { ResizableNodeWrapper } from './ResizableNodeWrapper';
import { useBoardStore } from '../store/boardStore';
import { VideoPlayer } from './VideoPlayer';

export interface VideoNodeData extends Resource {
  onDelete?: (id: string) => void;
  isSelected?: boolean;
}

// Helper function to extract YouTube video ID
const getYouTubeVideoId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

// Helper function to get YouTube thumbnail
const getYouTubeThumbnail = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

// Helper function to check if URL is a YouTube video
const isYouTubeVideo = (url: string): boolean => {
  return url.includes('youtube.com') || url.includes('youtu.be');
};

// Helper function to check if URL is a direct video file
const isDirectVideoFile = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

// Helper function to format duration
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VideoNode = memo<NodeProps<VideoNodeData>>(({ data, selected }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const setDraggedResource = useBoardStore((state) => state.setDraggedResource);

  const videoUrl = data.url || data.metadata?.url || '';
  const videoId = isYouTubeVideo(videoUrl) ? getYouTubeVideoId(videoUrl) : null;
  const isYouTube = !!videoId;
  const isDirect = isDirectVideoFile(videoUrl);

  const handleDragStart = (e: React.DragEvent) => {
    setDraggedResource(data.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedResource(null);
  };

  // Video control handlers
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoaded(true);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (showControls) {
      timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    
    return () => clearTimeout(timeout);
  }, [showControls]);

  const renderVideoPlayer = () => {
    if (isYouTube && videoId) {
      // YouTube iframe embed
      const youtubeUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&controls=1&rel=0`;
      
      return (
        <div className="relative w-full h-full min-h-[200px]">
          <iframe
            src={youtubeUrl}
            className="w-full h-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={data.title}
          />
          <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
            <Youtube className="w-3 h-3" />
            YouTube
          </div>
        </div>
      );
    }

    if (isDirect) {
      // Direct video file using Video.js player
      return (
        <div 
          className="relative w-full h-full min-h-[200px]"
          ref={containerRef}
        >
          <VideoPlayer
            src={videoUrl}
            poster={data.metadata?.thumbnail}
            controls={true}
            muted={isMuted}
            preload="metadata"
            className="rounded-lg"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onReady={(player) => {
              // Store player reference if needed
              if (player) {
                setIsLoaded(true);
              }
            }}
            onError={(error) => {
              console.error('Video playback error:', error);
            }}
          />
          
          {/* Video type indicator */}
          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
            <Video className="w-3 h-3" />
            Video
          </div>
        </div>
      );
    }

    // Fallback for unsupported video URLs
    return (
      <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Unsupported video format</p>
          <a 
            href={videoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm underline"
          >
            Open video link
          </a>
        </div>
      </div>
    );
  };

  const getThumbnail = () => {
    if (isYouTube && videoId) {
      return getYouTubeThumbnail(videoId);
    }
    return data.metadata?.thumbnail;
  };

  const getVideoDuration = () => {
    if (data.metadata?.duration) {
      return data.metadata.duration;
    }
    if (duration > 0) {
      return formatDuration(duration);
    }
    return null;
  };

  return (
    <ResizableNodeWrapper selected={selected} minWidth={300} minHeight={250}>
      <Handle type="target" position={Position.Top} className="!bg-purple-600" />
      
      <div
        className={clsx(
          'bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-200 w-full h-full',
          selected && 'ring-2 ring-purple-600 ring-offset-2',
          'hover:shadow-xl'
        )}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-3 border-b bg-gray-50"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              {isYouTube ? (
                <Youtube className="w-5 h-5 text-white" />
              ) : (
                <Video className="w-5 h-5 text-white" />
              )}
            </div>
          </div>
          {data.onDelete && (
            <button
              onClick={() => data.onDelete?.(data.id)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Video Player */}
        <div className="flex-1">
          {renderVideoPlayer()}
        </div>

        {/* Video Info */}
        <div className="p-3 border-t">
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
            {data.title}
          </h3>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {isYouTube ? 'YouTube' : 'Video'}
              {isLoaded && !isYouTube && (
                <span className="ml-1">• {Math.round((videoRef.current?.videoWidth || 0) / (videoRef.current?.videoHeight || 1) * 1000) / 1000}:1</span>
              )}
            </span>
            {getVideoDuration() && (
              <span>{getVideoDuration()}</span>
            )}
          </div>
          {data.metadata?.description && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
              {data.metadata.description}
            </p>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-purple-600" />
    </ResizableNodeWrapper>
  );
});

VideoNode.displayName = 'VideoNode';