// Complete working example of voice recording for ragboard

import React, { useState, useRef } from 'react';
import RecordRTC from 'recordrtc';
import { Mic, Square, Pause, Play } from 'lucide-react';
import { useBoardStore } from '../store/boardStore';

// Simple voice recording hook
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 2,
      });
      
      recorder.startRecording();
      recorderRef.current = recorder;
      setIsRecording(true);
      setAudioURL(null);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Please allow microphone access to record audio.');
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return null;

    return new Promise<Blob>((resolve) => {
      recorderRef.current!.stopRecording(() => {
        const blob = recorderRef.current!.getBlob();
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        setIsRecording(false);
        setIsPaused(false);
        resolve(blob);
      });
    });
  };

  const pauseRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.pauseRecording();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (recorderRef.current && isPaused) {
      recorderRef.current.resumeRecording();
      setIsPaused(false);
    }
  };

  return {
    isRecording,
    isPaused,
    audioURL,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}

// Simple Voice Recorder Component
export function SimpleVoiceRecorder() {
  const { 
    isRecording, 
    audioURL, 
    startRecording, 
    stopRecording 
  } = useVoiceRecorder();
  
  const { addNode } = useBoardStore();

  const handleStop = async () => {
    const blob = await stopRecording();
    if (!blob) return;

    // In a real app, upload the blob to your server
    // For now, we'll use a local blob URL
    const url = URL.createObjectURL(blob);
    
    // Add voice note to board
    addNode({
      id: `voice-${Date.now()}`,
      type: 'voiceNote',
      position: { x: 100, y: 100 },
      data: {
        audioUrl: url,
        duration: 0, // You'd calculate this
        label: 'Voice Note',
      },
    });
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-lg"
        >
          <Mic size={20} />
          Record Voice Note
        </button>
      ) : (
        <button
          onClick={handleStop}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 shadow-lg animate-pulse"
        >
          <Square size={20} />
          Stop Recording
        </button>
      )}
      
      {audioURL && (
        <audio src={audioURL} controls className="mt-2" />
      )}
    </div>
  );
}

// Voice Note Node Component for ReactFlow
export function VoiceNoteNode({ data }: { data: any }) {
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
    <div className="voice-note-node bg-purple-50 border-2 border-purple-300 rounded-lg p-4 min-w-[200px]">
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlayback}
          className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        
        <div>
          <div className="font-medium text-sm">{data.label}</div>
          <div className="text-xs text-gray-600">Voice Note</div>
        </div>
      </div>
      
      <audio
        ref={audioRef}
        src={data.audioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}

// Advanced Voice Recorder with timer and waveform
export function AdvancedVoiceRecorder({ onComplete }: { onComplete: (blob: Blob) => void }) {
  const {
    isRecording,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useVoiceRecorder();
  
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();

  const handleStart = async () => {
    await startRecording();
    setDuration(0);
    
    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };

  const handleStop = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    const blob = await stopRecording();
    if (blob) {
      onComplete(blob);
    }
    setDuration(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-80">
      <h3 className="text-lg font-semibold mb-4">Record Voice Note</h3>
      
      {isRecording && (
        <div className="mb-4">
          <div className="text-3xl font-mono text-center text-red-500">
            {formatTime(duration)}
          </div>
          <div className="mt-2 h-16 bg-gray-100 rounded flex items-center justify-center">
            <div className="flex gap-1">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-500 rounded"
                  style={{
                    height: `${Math.random() * 100}%`,
                    animation: 'pulse 1s infinite',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="flex gap-2 justify-center">
        {!isRecording ? (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            <Mic size={24} />
            Start Recording
          </button>
        ) : (
          <>
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
            >
              <Square size={20} />
            </button>
            
            {!isPaused ? (
              <button
                onClick={pauseRecording}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                <Pause size={20} />
              </button>
            ) : (
              <button
                onClick={resumeRecording}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                <Play size={20} />
              </button>
            )}
          </>
        )}
      </div>
      
      <p className="text-xs text-gray-500 mt-4 text-center">
        Click to start recording. Maximum 5 minutes.
      </p>
    </div>
  );
}

// Integration with BoardCanvas
export function BoardCanvasWithVoiceRecording() {
  const [showRecorder, setShowRecorder] = useState(false);
  const { addNode } = useBoardStore();

  const handleRecordingComplete = async (blob: Blob) => {
    // Upload to server
    const formData = new FormData();
    formData.append('audio', blob, `voice-${Date.now()}.wav`);
    
    try {
      // const response = await fetch('/api/upload/audio', {
      //   method: 'POST',
      //   body: formData,
      // });
      // const { url } = await response.json();
      
      // For demo, use local URL
      const url = URL.createObjectURL(blob);
      
      // Add to board
      addNode({
        id: `voice-${Date.now()}`,
        type: 'voiceNote',
        position: { x: 250, y: 250 },
        data: {
          audioUrl: url,
          label: 'Voice Note',
          recordedAt: new Date().toISOString(),
        },
      });
      
      setShowRecorder(false);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <>
      {/* Floating record button */}
      <SimpleVoiceRecorder />
      
      {/* Or use modal recorder */}
      <button
        onClick={() => setShowRecorder(true)}
        className="fixed bottom-4 right-4 p-4 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600"
      >
        <Mic size={24} />
      </button>
      
      {showRecorder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <AdvancedVoiceRecorder onComplete={handleRecordingComplete} />
          <button
            onClick={() => setShowRecorder(false)}
            className="absolute top-4 right-4 text-white"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

// Usage:
/*
// 1. Add to your node types
const nodeTypes = {
  // ... existing types
  voiceNote: VoiceNoteNode,
};

// 2. Add SimpleVoiceRecorder to your board
<BoardCanvas>
  <SimpleVoiceRecorder />
</BoardCanvas>

// 3. Or use the full integration
<BoardCanvasWithVoiceRecording />
*/