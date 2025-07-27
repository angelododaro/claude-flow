import React, { useState } from 'react';
import { Mic, Square, Pause, Play, X, Upload } from 'lucide-react';
import { useMediaRecorder } from '../hooks/useMediaRecorder';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  onCancel?: () => void;
  maxDuration?: number; // in seconds
  className?: string;
}

export function AudioRecorder({ 
  onRecordingComplete, 
  onCancel,
  maxDuration = 300, // 5 minutes default
  className = ''
}: AudioRecorderProps) {
  const [isUploading, setIsUploading] = useState(false);
  
  const {
    isRecording,
    isPaused,
    recordingTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    error,
  } = useMediaRecorder({ type: 'audio' });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    await startRecording();
  };

  const handleStop = async () => {
    setIsUploading(true);
    const blob = await stopRecording();
    if (blob) {
      onRecordingComplete(blob, recordingTime);
    }
    setIsUploading(false);
  };

  const handleCancel = () => {
    cancelRecording();
    onCancel?.();
  };

  // Auto-stop if max duration reached
  React.useEffect(() => {
    if (isRecording && recordingTime >= maxDuration) {
      handleStop();
    }
  }, [recordingTime, maxDuration, isRecording]);

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-4">Voice Recording</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error.message}
          </div>
        )}
        
        {/* Recording indicator */}
        {isRecording && (
          <div className="mb-6">
            <div className="flex items-center justify-center mb-2">
              <div className={`w-3 h-3 rounded-full mr-2 ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-sm text-gray-600">
                {isPaused ? 'Paused' : 'Recording'}
              </span>
            </div>
            <div className="text-2xl font-mono font-bold text-gray-800">
              {formatTime(recordingTime)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Max duration: {formatTime(maxDuration)}
            </div>
          </div>
        )}
        
        {/* Waveform visualization (placeholder) */}
        {isRecording && (
          <div className="mb-6 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="flex gap-1 items-center h-full py-2">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 bg-blue-500 rounded-full transition-all duration-300 ${
                    isPaused ? 'opacity-50' : 'animate-pulse'
                  }`}
                  style={{
                    height: `${Math.random() * 100}%`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isRecording ? (
            <>
              <button
                onClick={handleStart}
                className="p-4 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                title="Start recording"
              >
                <Mic className="w-6 h-6" />
              </button>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="p-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full transition-colors"
                  title="Cancel"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="p-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full transition-colors"
                title="Cancel recording"
              >
                <X className="w-5 h-5" />
              </button>
              
              {isPaused ? (
                <button
                  onClick={resumeRecording}
                  className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                  title="Resume recording"
                >
                  <Play className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={pauseRecording}
                  className="p-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full transition-colors"
                  title="Pause recording"
                >
                  <Pause className="w-5 h-5" />
                </button>
              )}
              
              <button
                onClick={handleStop}
                disabled={isUploading}
                className="p-3 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-full transition-colors"
                title="Stop and save recording"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>
            </>
          )}
        </div>
        
        {/* Instructions */}
        {!isRecording && (
          <p className="mt-4 text-sm text-gray-600">
            Click the microphone to start recording. You can pause and resume as needed.
          </p>
        )}
      </div>
    </div>
  );
}