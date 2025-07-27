import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  width?: number | string;
  height?: number | string;
  controls?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  className?: string;
  onReady?: (player: any) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: any) => void;
}

export function VideoPlayer({
  src,
  poster,
  width = '100%',
  height = 'auto',
  controls = true,
  autoplay = false,
  muted = false,
  loop = false,
  preload = 'metadata',
  className = '',
  onReady,
  onPlay,
  onPause,
  onEnded,
  onError,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current && videoRef.current) {
      const player = videojs(videoRef.current, {
        controls,
        autoplay,
        muted,
        loop,
        preload,
        fluid: true,
        responsive: true,
        sources: [{
          src,
          type: src.endsWith('.mp4') ? 'video/mp4' : 
                src.endsWith('.webm') ? 'video/webm' : 
                src.endsWith('.ogg') ? 'video/ogg' : 'video/mp4'
        }],
        poster,
        controlBar: {
          playToggle: true,
          volumePanel: {
            inline: false,
          },
          currentTimeDisplay: true,
          timeDivider: true,
          durationDisplay: true,
          progressControl: true,
          remainingTimeDisplay: false,
          fullscreenToggle: true,
          playbackRateMenuButton: {
            playbackRates: [0.5, 1, 1.5, 2]
          },
        },
      });

      playerRef.current = player;

      // Set up event listeners
      if (onReady) {
        player.ready(() => onReady(player));
      }
      if (onPlay) {
        player.on('play', onPlay);
      }
      if (onPause) {
        player.on('pause', onPause);
      }
      if (onEnded) {
        player.on('ended', onEnded);
      }
      if (onError) {
        player.on('error', onError);
      }

      // Add quality selector if multiple sources
      player.ready(() => {
        player.controlBar.addClass('vjs-control-bar-visible');
      });
    }

    // Update source if it changes
    const player = playerRef.current;
    if (player && src) {
      player.src({
        src,
        type: src.endsWith('.mp4') ? 'video/mp4' : 
              src.endsWith('.webm') ? 'video/webm' : 
              src.endsWith('.ogg') ? 'video/ogg' : 'video/mp4'
      });
    }
  }, [src, controls, autoplay, muted, loop, preload, poster, onReady, onPlay, onPause, onEnded, onError]);

  // Dispose of player on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`video-player-wrapper ${className}`} style={{ width, height }}>
      <video
        ref={videoRef}
        className="video-js vjs-default-skin vjs-big-play-centered"
        playsInline
      />
    </div>
  );
}