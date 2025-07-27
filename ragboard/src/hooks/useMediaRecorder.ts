import { useState, useRef, useCallback } from 'react';
import RecordRTC from 'recordrtc';

export interface MediaRecorderOptions {
  type: 'audio' | 'video' | 'screen';
  mimeType?: string;
  audioBitsPerSecond?: number;
  videoBitsPerSecond?: number;
  frameRate?: number;
}

export interface UseMediaRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  error: Error | null;
}

export function useMediaRecorder(options: MediaRecorderOptions): UseMediaRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingTime(0);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Get user media based on type
      let stream: MediaStream;
      
      if (options.type === 'audio') {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
      } else if (options.type === 'video') {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: options.frameRate || 30 }
          },
          audio: true 
        });
      } else if (options.type === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: options.frameRate || 30 }
          },
          audio: true 
        });
      } else {
        throw new Error('Invalid recording type');
      }
      
      streamRef.current = stream;

      // Configure RecordRTC
      const recorder = new RecordRTC(stream, {
        type: options.type === 'audio' ? 'audio' : 'video',
        mimeType: options.mimeType || (options.type === 'audio' ? 'audio/wav' : 'video/webm'),
        audioBitsPerSecond: options.audioBitsPerSecond,
        videoBitsPerSecond: options.videoBitsPerSecond,
        frameInterval: options.frameRate ? 1000 / options.frameRate : undefined,
        disableLogs: true,
      });

      recorderRef.current = recorder;
      recorder.startRecording();
      
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (err) {
      setError(err as Error);
      console.error('Failed to start recording:', err);
    }
  }, [options, startTimer]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!recorderRef.current) {
        resolve(null);
        return;
      }

      const recorder = recorderRef.current;
      
      recorder.stopRecording(() => {
        const blob = recorder.getBlob();
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        recorderRef.current = null;
        setIsRecording(false);
        setIsPaused(false);
        stopTimer();
        
        resolve(blob);
      });
    });
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current && isRecording && !isPaused) {
      recorderRef.current.pauseRecording();
      setIsPaused(true);
      
      // Pause timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current && isRecording && isPaused) {
      recorderRef.current.resumeRecording();
      setIsPaused(false);
      
      // Resume timer
      startTimeRef.current = Date.now() - (recordingTime * 1000);
      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
  }, [isRecording, isPaused, recordingTime]);

  const cancelRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stopRecording(() => {
        // Clean up without returning blob
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        recorderRef.current = null;
        setIsRecording(false);
        setIsPaused(false);
        stopTimer();
      });
    }
  }, [stopTimer]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    error,
  };
}