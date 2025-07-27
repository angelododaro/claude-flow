# RecordRTC Media Recording Integration Guide

## Overview
Add in-browser audio/video recording capabilities to ragboard using RecordRTC. This enables users to create voice notes, screen recordings, and video messages directly within the board.

## Installation

```bash
npm install recordrtc
```

## Implementation Steps

### 1. Create Recording Hook (src/hooks/useMediaRecorder.ts)

```typescript
import { useState, useRef, useCallback } from 'react';
import RecordRTC, { RecordRTCPromisesHandler } from 'recordrtc';

interface UseMediaRecorderOptions {
  type: 'audio' | 'video' | 'screen';
  mimeType?: string;
  maxDuration?: number; // in seconds
}

export function useMediaRecorder(options: UseMediaRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const recorderRef = useRef<RecordRTCPromisesHandler | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Get media stream based on type
      let stream: MediaStream;
      
      if (options.type === 'audio') {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true 
        });
      } else if (options.type === 'video') {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: { 
            width: 1280, 
            height: 720 
          } 
        });
      } else if (options.type === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            width: 1920, 
            height: 1080 
          },
          audio: true
        });
      } else {
        throw new Error('Invalid recording type');
      }

      streamRef.current = stream;

      // Configure RecordRTC
      const recorder = new RecordRTCPromisesHandler(stream, {
        type: options.type === 'audio' ? 'audio' : 'video',
        mimeType: options.mimeType || (
          options.type === 'audio' ? 'audio/wav' : 'video/webm'
        ),
        disableLogs: true,
        numberOfAudioChannels: 2,
        bufferSize: 16384,
        videoBitsPerSecond: 128000,
      });

      recorderRef.current = recorder;
      await recorder.startRecording();
      setIsRecording(true);
      setDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          if (options.maxDuration && newDuration >= options.maxDuration) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);

    } catch (err) {
      setError(err.message);
      console.error('Recording error:', err);
    }
  }, [options]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) return null;

    try {
      await recorderRef.current.stopRecording();
      const blob = await recorderRef.current.getBlob();
      
      // Clean up
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);

      return blob;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const pauseRecording = useCallback(async () => {
    if (recorderRef.current && isRecording && !isPaused) {
      await recorderRef.current.pauseRecording();
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(async () => {
    if (recorderRef.current && isRecording && isPaused) {
      await recorderRef.current.resumeRecording();
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  return {
    isRecording,
    isPaused,
    duration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
```

### 2. Audio Recording Component (src/components/AudioRecorder.tsx)

```typescript
import { useState } from 'react';
import { Mic, Square, Pause, Play } from 'lucide-react';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { uploadFile } from '../services/api';

interface AudioRecorderProps {
  onRecordingComplete: (url: string, duration: number) => void;
}

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [isUploading, setIsUploading] = useState(false);
  
  const {
    isRecording,
    isPaused,
    duration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useMediaRecorder({ 
    type: 'audio',
    maxDuration: 300 // 5 minutes max
  });

  const handleStop = async () => {
    const blob = await stopRecording();
    if (!blob) return;

    setIsUploading(true);
    try {
      // Upload to backend
      const formData = new FormData();
      formData.append('file', blob, `recording-${Date.now()}.wav`);
      formData.append('type', 'audio');
      
      const response = await uploadFile(formData);
      onRecordingComplete(response.url, duration);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-recorder bg-white rounded-lg p-4 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Audio Recording</h3>
        {isRecording && (
          <span className="text-red-500 font-mono">
            {formatDuration(duration)}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            <Mic size={20} />
            Start Recording
          </button>
        ) : (
          <>
            <button
              onClick={handleStop}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
            >
              <Square size={20} />
              Stop
            </button>
            
            {!isPaused ? (
              <button
                onClick={pauseRecording}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                <Pause size={20} />
                Pause
              </button>
            ) : (
              <button
                onClick={resumeRecording}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                <Play size={20} />
                Resume
              </button>
            )}
          </>
        )}
      </div>

      {isRecording && (
        <div className="mt-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 transition-all duration-1000 ease-linear"
              style={{ width: `${(duration / 300) * 100}%` }}
            />
          </div>
        </div>
      )}

      {isUploading && (
        <div className="mt-4 text-gray-600">
          Uploading recording...
        </div>
      )}
    </div>
  );
}
```

### 3. Screen Recording Component (src/components/ScreenRecorder.tsx)

```typescript
export function ScreenRecorder({ onRecordingComplete }: RecorderProps) {
  const {
    isRecording,
    duration,
    error,
    startRecording,
    stopRecording,
  } = useMediaRecorder({ 
    type: 'screen',
    mimeType: 'video/webm;codecs=vp9',
    maxDuration: 600 // 10 minutes max
  });

  const [preview, setPreview] = useState<string | null>(null);

  const handleStart = async () => {
    setPreview(null);
    await startRecording();
  };

  const handleStop = async () => {
    const blob = await stopRecording();
    if (!blob) return;

    // Create preview
    const url = URL.createObjectURL(blob);
    setPreview(url);

    // Upload in background
    const formData = new FormData();
    formData.append('file', blob, `screen-${Date.now()}.webm`);
    formData.append('type', 'screen-recording');
    
    const response = await uploadFile(formData);
    onRecordingComplete(response.url, duration);
  };

  return (
    <div className="screen-recorder">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={isRecording ? handleStop : handleStart}
          className={`px-6 py-3 rounded-lg font-medium ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isRecording ? (
            <>Stop Screen Recording ({formatDuration(duration)})</>
          ) : (
            <>Start Screen Recording</>
          )}
        </button>

        {isRecording && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span>Recording...</span>
          </div>
        )}
      </div>

      {preview && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Preview:</h4>
          <video 
            src={preview} 
            controls 
            className="w-full max-w-2xl rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  );
}
```

### 4. Voice Note Node (src/components/VoiceNoteNode.tsx)

```typescript
import { Handle, Position } from '@xyflow/react';
import { Volume2 } from 'lucide-react';
import { useState } from 'react';

export function VoiceNoteNode({ data }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="voice-note-node bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
      <Handle type="target" position={Position.Top} />
      
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlayback}
          className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600"
        >
          <Volume2 size={24} />
        </button>
        
        <div>
          <div className="font-medium">{data.label || 'Voice Note'}</div>
          <div className="text-sm text-gray-600">
            Duration: {formatDuration(data.duration)}
          </div>
        </div>
      </div>
      
      <audio
        ref={audioRef}
        src={data.audioUrl}
        onEnded={() => setIsPlaying(false)}
      />
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### 5. Integration with Board (src/components/BoardCanvas.tsx)

```typescript
const nodeTypes = {
  // ... existing node types
  voiceNote: VoiceNoteNode,
  screenRecording: ScreenRecordingNode,
};

export function BoardCanvas() {
  const [showRecorder, setShowRecorder] = useState<'audio' | 'screen' | null>(null);
  
  const handleRecordingComplete = (url: string, duration: number, type: string) => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type: type === 'audio' ? 'voiceNote' : 'screenRecording',
      position: { x: 100, y: 100 },
      data: {
        label: `${type === 'audio' ? 'Voice Note' : 'Screen Recording'}`,
        url,
        duration,
      },
    };
    
    addNode(newNode);
    setShowRecorder(null);
  };

  return (
    <>
      <div className="board-toolbar">
        <button onClick={() => setShowRecorder('audio')}>
          <Mic /> Voice Note
        </button>
        <button onClick={() => setShowRecorder('screen')}>
          <Monitor /> Screen Recording
        </button>
      </div>

      {showRecorder === 'audio' && (
        <Modal onClose={() => setShowRecorder(null)}>
          <AudioRecorder 
            onRecordingComplete={(url, duration) => 
              handleRecordingComplete(url, duration, 'audio')
            }
          />
        </Modal>
      )}

      {showRecorder === 'screen' && (
        <Modal onClose={() => setShowRecorder(null)}>
          <ScreenRecorder
            onRecordingComplete={(url, duration) => 
              handleRecordingComplete(url, duration, 'screen')
            }
          />
        </Modal>
      )}
    </>
  );
}
```

### 6. Backend Processing (backend/app/services/media_processor.py)

```python
from moviepy.editor import VideoFileClip
import whisper
from celery import shared_task

@shared_task
def process_audio_recording(file_path: str, recording_id: str):
    """Process audio recording - transcribe and generate waveform"""
    # Load Whisper model
    model = whisper.load_model("base")
    
    # Transcribe audio
    result = model.transcribe(file_path)
    
    # Store transcription
    await store_transcription(recording_id, result["text"])
    
    # Generate waveform data for visualization
    waveform = generate_waveform(file_path)
    await store_waveform(recording_id, waveform)
    
    return {
        "transcription": result["text"],
        "duration": result["duration"],
        "language": result["language"]
    }

@shared_task
def process_screen_recording(file_path: str, recording_id: str):
    """Process screen recording - extract thumbnail and metadata"""
    clip = VideoFileClip(file_path)
    
    # Extract thumbnail at 10% of video
    thumbnail_time = clip.duration * 0.1
    thumbnail_path = f"/tmp/thumb_{recording_id}.jpg"
    clip.save_frame(thumbnail_path, t=thumbnail_time)
    
    # Upload thumbnail
    thumbnail_url = await upload_to_s3(thumbnail_path)
    
    # Extract metadata
    metadata = {
        "duration": clip.duration,
        "fps": clip.fps,
        "size": (clip.w, clip.h),
        "thumbnail": thumbnail_url
    }
    
    await store_metadata(recording_id, metadata)
    return metadata
```

## Browser Compatibility

```typescript
// src/utils/browserSupport.ts
export function checkMediaSupport() {
  const support = {
    audio: false,
    video: false,
    screen: false,
  };

  if (navigator.mediaDevices) {
    support.audio = true;
    support.video = true;
    
    if ('getDisplayMedia' in navigator.mediaDevices) {
      support.screen = true;
    }
  }

  return support;
}
```

## Error Handling

1. **Permission Denied**: Guide user to grant permissions
2. **No Microphone**: Show helpful error message
3. **Storage Full**: Warn before recording
4. **Network Error**: Store locally and retry upload

## Performance Optimization

1. **Chunk Upload**: For large recordings
2. **Web Workers**: Process audio in background
3. **Compression**: Reduce file size before upload
4. **Progressive Upload**: Start upload while recording

## Security Considerations

1. **HTTPS Required**: MediaDevices API requires secure context
2. **Permission Management**: Clear permission indicators
3. **Privacy**: Option to blur sensitive info in screen recordings
4. **Auto-stop**: Limit recording duration to prevent abuse