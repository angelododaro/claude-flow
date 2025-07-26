import React, { useState, useCallback } from 'react';
import { Youtube, Video, Upload, Loader2, Play } from 'lucide-react';
import { clsx } from 'clsx';
import { useDropzone } from 'react-dropzone';

interface VideoInputProps {
  onAdd: (data: {
    type: string;
    title: string;
    url?: string;
    content?: string;
    platform?: string;
    metadata?: any;
  }) => void;
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

export const VideoInput: React.FC<VideoInputProps> = ({ onAdd }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Handle URL input and preview generation
  const handleUrlChange = useCallback(async (value: string) => {
    setUrl(value);
    setPreviewData(null);
    
    if (!value.trim()) return;

    if (isYouTubeVideo(value)) {
      const videoId = getYouTubeVideoId(value);
      if (videoId) {
        setPreviewData({
          type: 'youtube',
          videoId,
          thumbnail: getYouTubeThumbnail(videoId),
          platform: 'youtube',
        });
        
        // Try to extract title from YouTube (this would normally require API)
        if (!title) {
          setTitle(`YouTube Video ${videoId}`);
        }
      }
    } else if (isDirectVideoFile(value)) {
      setPreviewData({
        type: 'direct',
        thumbnail: null,
        platform: 'web',
      });
      
      if (!title) {
        const fileName = value.split('/').pop()?.split('?')[0] || 'Video';
        setTitle(fileName);
      }
    }
  }, [title]);

  // Handle video file upload
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const videoFiles = acceptedFiles.filter(file => 
      file.type.startsWith('video/') || 
      ['.mp4', '.webm', '.ogg', '.mov', '.avi'].some(ext => 
        file.name.toLowerCase().endsWith(ext)
      )
    );
    
    setUploadedFiles(videoFiles);
    
    if (videoFiles.length > 0 && !title) {
      setTitle(videoFiles[0].name.replace(/\.[^/.]+$/, ""));
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.webm', '.ogg', '.mov', '.avi'],
    },
    multiple: false,
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    setIsProcessing(true);
    
    try {
      if (uploadedFiles.length > 0) {
        // Handle uploaded video file
        const file = uploadedFiles[0];
        const fileUrl = URL.createObjectURL(file);
        
        onAdd({
          type: 'video',
          title: title.trim(),
          url: fileUrl,
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            isUploaded: true,
          },
        });
      } else if (url.trim()) {
        // Handle video URL
        const videoData: any = {
          type: 'video',
          title: title.trim(),
          url: url.trim(),
        };

        if (previewData) {
          videoData.metadata = {
            ...previewData,
            thumbnail: previewData.thumbnail,
          };
          
          if (previewData.type === 'youtube') {
            videoData.platform = 'youtube';
          }
        }
        
        onAdd(videoData);
      }
      
      // Reset form
      setUrl('');
      setTitle('');
      setPreviewData(null);
      setUploadedFiles([]);
    } catch (error) {
      console.error('Error adding video:', error);
      alert('Failed to add video. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [url, title, uploadedFiles, previewData, onAdd]);

  const canSubmit = (title.trim() && (url.trim() || uploadedFiles.length > 0)) && !isProcessing;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* URL Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Video URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Enter YouTube URL or direct video link..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        {previewData && (
          <div className="mt-2 p-2 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {previewData.type === 'youtube' ? (
                <Youtube className="w-4 h-4 text-red-600" />
              ) : (
                <Video className="w-4 h-4 text-blue-600" />
              )}
              <span>
                {previewData.type === 'youtube' ? 'YouTube Video' : 'Direct Video File'}
              </span>
            </div>
            {previewData.thumbnail && (
              <img 
                src={previewData.thumbnail} 
                alt="Video thumbnail"
                className="mt-2 w-full h-24 object-cover rounded"
              />
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">or</span>
        </div>
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Upload Video File
        </label>
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            {isDragActive
              ? 'Drop the video file here...'
              : 'Drag & drop a video file here, or click to select'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supports MP4, WebM, OGG, MOV, AVI
          </p>
        </div>
        
        {uploadedFiles.length > 0 && (
          <div className="mt-2 p-2 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Video className="w-4 h-4" />
              <span>{uploadedFiles[0].name}</span>
              <span className="text-green-600">
                ({(uploadedFiles[0].size / (1024 * 1024)).toFixed(1)} MB)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Title Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Video Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter video title..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          required
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!canSubmit}
        className={clsx(
          'w-full py-2 px-4 rounded-lg transition-colors font-medium flex items-center justify-center gap-2',
          canSubmit
            ? 'bg-purple-600 text-white hover:bg-purple-700'
            : 'bg-gray-400 cursor-not-allowed text-white'
        )}
      >
        {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
        {isProcessing ? 'Processing...' : 'Add Video to Board'}
      </button>
    </form>
  );
};