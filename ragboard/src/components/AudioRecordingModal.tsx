import React from 'react';
import { X } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';

interface AudioRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (blob: Blob, duration: number) => void;
}

export function AudioRecordingModal({ 
  isOpen, 
  onClose, 
  onRecordingComplete 
}: AudioRecordingModalProps) {
  if (!isOpen) return null;

  const handleRecordingComplete = (blob: Blob, duration: number) => {
    onRecordingComplete(blob, duration);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-white rounded-lg shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <AudioRecorder
          onRecordingComplete={handleRecordingComplete}
          onCancel={onClose}
          maxDuration={300} // 5 minutes max
        />
      </div>
    </div>
  );
}