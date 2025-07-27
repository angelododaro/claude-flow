# Video.js Enhanced Video Playback Integration Guide

## Overview
Replace basic HTML5 video elements with Video.js to provide professional video playback with consistent controls, plugins, and advanced features across all browsers.

## Installation

```bash
npm install video.js @types/video.js
npm install @videojs/themes  # Optional: Pre-built themes
```

## Implementation Steps

### 1. Video.js React Component (src/components/VideoPlayer.tsx)

```typescript
import { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/themes/dist/sea/index.css'; // Optional theme

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
  width?: number | string;
  height?: number | string;
  onReady?: (player: videojs.Player) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  playbackRates?: number[];
  sources?: videojs.Tech.SourceObject[];
}

export function VideoPlayer({
  src,
  poster,
  autoplay = false,
  controls = true,
  width = '100%',
  height = 'auto',
  onReady,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  playbackRates = [0.5, 1, 1.25, 1.5, 2],
  sources,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<videojs.Player | null>(null);

  useEffect(() => {
    // Initialize Video.js player
    if (!videoRef.current) return;

    const options: videojs.PlayerOptions = {
      autoplay,
      controls,
      responsive: true,
      fluid: true,
      playbackRates,
      sources: sources || [{ src, type: 'video/mp4' }],
      poster,
      controlBar: {
        volumePanel: {
          inline: false,
        },
        currentTimeDisplay: true,
        timeDivider: true,
        durationDisplay: true,
        progressControl: {
          seekBar: {
            mouseTimeDisplay: {
              timeTooltip: true,
            },
          },
        },
        remainingTimeDisplay: false,
        playbackRateMenuButton: {
          playbackRates,
        },
        pictureInPictureToggle: true,
        fullscreenToggle: true,
      },
    };

    const player = videojs(videoRef.current, options);
    playerRef.current = player;

    // Event handlers
    player.ready(() => {
      onReady?.(player);
    });

    player.on('play', () => {
      onPlay?.();
    });

    player.on('pause', () => {
      onPause?.();
    });

    player.on('ended', () => {
      onEnded?.();
    });

    player.on('timeupdate', () => {
      const currentTime = player.currentTime() || 0;
      const duration = player.duration() || 0;
      onTimeUpdate?.(currentTime, duration);
    });

    // Cleanup
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  // Update source when src changes
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !src) return;

    player.src({ src, type: 'video/mp4' });
  }, [src]);

  return (
    <div className="video-player-wrapper" style={{ width, height }}>
      <video
        ref={videoRef}
        className="video-js vjs-theme-sea vjs-big-play-centered"
      />
    </div>
  );
}
```

### 2. Enhanced Video Node (src/components/VideoNode.tsx)

```typescript
import { Handle, Position } from '@xyflow/react';
import { useState, useCallback } from 'react';
import { Play, Pause, Volume2, Maximize2 } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import videojs from 'video.js';

interface VideoNodeData {
  url: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  transcription?: string;
}

export function VideoNode({ data, selected }: { data: VideoNodeData; selected: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(data.duration || 0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [player, setPlayer] = useState<videojs.Player | null>(null);

  const handlePlayerReady = useCallback((player: videojs.Player) => {
    setPlayer(player);
    
    // Add custom plugin for keyboard shortcuts
    player.on('keydown', (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          player.paused() ? player.play() : player.pause();
          break;
        case 'ArrowLeft':
          player.currentTime(Math.max(0, player.currentTime() - 10));
          break;
        case 'ArrowRight':
          player.currentTime(Math.min(player.duration(), player.currentTime() + 10));
          break;
        case 'm':
          player.muted(!player.muted());
          break;
      }
    });
  }, []);

  const handleTimeUpdate = useCallback((current: number, total: number) => {
    setCurrentTime(current);
    setDuration(total);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (time: number) => {
    if (player) {
      player.currentTime(time);
    }
  };

  return (
    <div 
      className={`video-node bg-white rounded-lg shadow-lg overflow-hidden ${
        selected ? 'ring-2 ring-blue-500' : ''
      }`}
      style={{ width: 400 }}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Video Header */}
      <div className="p-3 border-b">
        <h3 className="font-medium truncate">{data.title || 'Video'}</h3>
        <div className="text-sm text-gray-500 mt-1">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Video Player */}
      <div className="relative">
        <VideoPlayer
          src={data.url}
          poster={data.thumbnail}
          onReady={handlePlayerReady}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          width="100%"
          height="225px"
        />
      </div>

      {/* Custom Controls */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-2">
          <button
            onClick={() => player?.paused() ? player.play() : player?.pause()}
            className="p-2 hover:bg-gray-100 rounded"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          
          <div className="flex-1">
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <button
            onClick={() => player?.requestFullscreen()}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <Maximize2 size={20} />
          </button>
        </div>
      </div>

      {/* Transcript Section */}
      {data.transcription && (
        <div className="border-t">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full p-3 text-left hover:bg-gray-50 flex justify-between items-center"
          >
            <span className="text-sm font-medium">Transcript</span>
            <span className="text-xs text-gray-500">
              {showTranscript ? 'Hide' : 'Show'}
            </span>
          </button>
          
          {showTranscript && (
            <div className="p-3 bg-gray-50 text-sm max-h-32 overflow-y-auto">
              {data.transcription}
            </div>
          )}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### 3. Video.js Plugins (src/components/video-plugins/)

#### Thumbnail Preview Plugin (src/components/video-plugins/thumbnailPreview.ts)

```typescript
import videojs from 'video.js';

const Plugin = videojs.getPlugin('plugin');

export class ThumbnailPreview extends Plugin {
  constructor(player: videojs.Player, options: any) {
    super(player, options);
    
    this.setupThumbnails();
  }

  setupThumbnails() {
    const progressControl = this.player.controlBar.progressControl;
    const seekBar = progressControl.seekBar;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'vjs-thumbnail-preview';
    tooltip.style.display = 'none';
    
    seekBar.el().appendChild(tooltip);
    
    seekBar.on('mousemove', (e: MouseEvent) => {
      const duration = this.player.duration();
      const seekBarRect = seekBar.el().getBoundingClientRect();
      const position = (e.clientX - seekBarRect.left) / seekBarRect.width;
      const time = position * duration;
      
      // Get thumbnail for this time
      const thumbnailUrl = this.getThumbnailUrl(time);
      
      tooltip.style.backgroundImage = `url(${thumbnailUrl})`;
      tooltip.style.left = `${e.clientX - seekBarRect.left}px`;
      tooltip.style.display = 'block';
    });
    
    seekBar.on('mouseout', () => {
      tooltip.style.display = 'none';
    });
  }
  
  getThumbnailUrl(time: number): string {
    // Calculate which thumbnail sprite to use
    const interval = 10; // seconds per thumbnail
    const index = Math.floor(time / interval);
    return `${this.options.baseUrl}/thumb_${index}.jpg`;
  }
}

videojs.registerPlugin('thumbnailPreview', ThumbnailPreview);
```

#### Chapter Markers Plugin (src/components/video-plugins/chapterMarkers.ts)

```typescript
export interface Chapter {
  time: number;
  title: string;
}

export class ChapterMarkers extends Plugin {
  chapters: Chapter[];
  
  constructor(player: videojs.Player, options: { chapters: Chapter[] }) {
    super(player, options);
    this.chapters = options.chapters;
    
    player.ready(() => {
      this.addChapterMarkers();
    });
  }
  
  addChapterMarkers() {
    const progressControl = this.player.controlBar.progressControl;
    const seekBar = progressControl.seekBar;
    const duration = this.player.duration();
    
    this.chapters.forEach(chapter => {
      const marker = document.createElement('div');
      marker.className = 'vjs-chapter-marker';
      marker.style.left = `${(chapter.time / duration) * 100}%`;
      marker.title = chapter.title;
      
      marker.addEventListener('click', () => {
        this.player.currentTime(chapter.time);
      });
      
      seekBar.el().appendChild(marker);
    });
  }
}

videojs.registerPlugin('chapterMarkers', ChapterMarkers);
```

### 4. Video Gallery Component (src/components/VideoGallery.tsx)

```typescript
export function VideoGallery({ videos }: { videos: VideoData[] }) {
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [playlist, setPlaylist] = useState<VideoData[]>(videos);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleVideoEnd = () => {
    // Auto-play next video
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedVideo(playlist[currentIndex + 1]);
    }
  };

  return (
    <div className="video-gallery">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Player */}
        <div className="lg:col-span-2">
          {selectedVideo ? (
            <VideoPlayer
              key={selectedVideo.id}
              src={selectedVideo.url}
              poster={selectedVideo.thumbnail}
              onEnded={handleVideoEnd}
              sources={[
                { src: selectedVideo.url, type: 'video/mp4' },
                { src: selectedVideo.url.replace('.mp4', '.webm'), type: 'video/webm' },
              ]}
            />
          ) : (
            <div className="bg-gray-100 rounded-lg aspect-video flex items-center justify-center">
              <p className="text-gray-500">Select a video to play</p>
            </div>
          )}
        </div>

        {/* Playlist */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {playlist.map((video, index) => (
            <button
              key={video.id}
              onClick={() => {
                setSelectedVideo(video);
                setCurrentIndex(index);
              }}
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                selectedVideo?.id === video.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex gap-3">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-24 h-16 object-cover rounded"
                />
                <div className="flex-1">
                  <h4 className="font-medium line-clamp-1">{video.title}</h4>
                  <p className="text-sm text-gray-500">
                    {formatDuration(video.duration)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 5. Video Processing Integration (src/services/videoProcessing.ts)

```typescript
export class VideoProcessingService {
  async generateThumbnails(videoUrl: string): Promise<string[]> {
    // Call backend API to generate thumbnails
    const response = await api.post('/videos/generate-thumbnails', {
      url: videoUrl,
      interval: 10, // seconds
    });
    
    return response.data.thumbnails;
  }
  
  async extractChapters(videoUrl: string): Promise<Chapter[]> {
    // Use AI to detect scene changes and generate chapters
    const response = await api.post('/videos/extract-chapters', {
      url: videoUrl,
    });
    
    return response.data.chapters;
  }
  
  async generateSubtitles(videoUrl: string, language = 'en'): Promise<string> {
    // Generate WebVTT subtitles
    const response = await api.post('/videos/generate-subtitles', {
      url: videoUrl,
      language,
    });
    
    return response.data.vttUrl;
  }
}
```

### 6. Adaptive Streaming Support (src/components/VideoPlayerAdvanced.tsx)

```typescript
import 'videojs-contrib-quality-levels';
import 'videojs-hls-quality-selector';

export function VideoPlayerAdvanced({ manifestUrl }: { manifestUrl: string }) {
  useEffect(() => {
    const player = videojs(videoRef.current, {
      html5: {
        vhs: {
          overrideNative: true,
        },
      },
    });
    
    // Enable quality selector for HLS
    player.hlsQualitySelector({
      displayCurrentQuality: true,
    });
    
    // Load HLS manifest
    player.src({
      src: manifestUrl,
      type: 'application/x-mpegURL',
    });
  }, [manifestUrl]);
  
  return <video ref={videoRef} className="video-js" />;
}
```

### 7. Video Analytics (src/hooks/useVideoAnalytics.ts)

```typescript
export function useVideoAnalytics(videoId: string) {
  const trackEvent = useCallback((event: string, data: any) => {
    // Send to analytics service
    analytics.track('video_event', {
      videoId,
      event,
      ...data,
    });
  }, [videoId]);
  
  const setupAnalytics = useCallback((player: videojs.Player) => {
    let watchTime = 0;
    let lastTime = 0;
    
    player.on('play', () => {
      trackEvent('play', { timestamp: player.currentTime() });
    });
    
    player.on('pause', () => {
      trackEvent('pause', { 
        timestamp: player.currentTime(),
        watchTime: watchTime,
      });
    });
    
    player.on('ended', () => {
      trackEvent('complete', { 
        totalWatchTime: watchTime,
        completion: (watchTime / player.duration()) * 100,
      });
    });
    
    player.on('timeupdate', () => {
      const currentTime = player.currentTime();
      if (currentTime > lastTime) {
        watchTime += currentTime - lastTime;
      }
      lastTime = currentTime;
    });
    
    // Track quality changes
    player.on('qualitychange', (e: any) => {
      trackEvent('quality_change', { 
        quality: e.detail.quality,
      });
    });
  }, [trackEvent]);
  
  return { setupAnalytics };
}
```

## Styling (src/styles/video-player.css)

```css
/* Custom Video.js theme */
.video-js.vjs-theme-ragboard {
  font-family: inherit;
}

.vjs-theme-ragboard .vjs-control-bar {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
}

.vjs-theme-ragboard .vjs-progress-control .vjs-progress-holder {
  height: 6px;
  margin-top: -3px;
}

.vjs-theme-ragboard .vjs-play-progress {
  background-color: #3b82f6;
}

/* Chapter markers */
.vjs-chapter-marker {
  position: absolute;
  width: 3px;
  height: 100%;
  background-color: #fbbf24;
  cursor: pointer;
  z-index: 1;
}

.vjs-chapter-marker:hover {
  background-color: #f59e0b;
}

/* Thumbnail preview */
.vjs-thumbnail-preview {
  position: absolute;
  bottom: 30px;
  width: 160px;
  height: 90px;
  background-size: cover;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  transform: translateX(-50%);
}
```

## Performance Optimization

1. **Lazy Load Video.js**: Only load when video nodes are present
2. **Preload Strategy**: Use 'metadata' for faster initial load
3. **Adaptive Bitrate**: Implement HLS/DASH for large videos
4. **Web Workers**: Offload analytics to worker threads

## Accessibility

1. **Captions**: Auto-load WebVTT files
2. **Keyboard Controls**: Full keyboard navigation
3. **Screen Reader**: Proper ARIA labels
4. **Audio Descriptions**: Support for described video tracks