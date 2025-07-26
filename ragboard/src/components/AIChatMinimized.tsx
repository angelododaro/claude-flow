import React, { useState } from 'react';
import { MessageCircle, X, Maximize2, ZoomIn } from 'lucide-react';

interface AIChatMinimizedProps {
  chatId: string;
  onClose: () => void;
  onFullScreen?: () => void;
  hasNewMessage?: boolean;
}

export const AIChatMinimized: React.FC<AIChatMinimizedProps> = ({
  chatId,
  onClose,
  onFullScreen,
  hasNewMessage = false,
}) => {
  const [showHoverButtons, setShowHoverButtons] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div 
        className="relative"
        onMouseEnter={() => setShowHoverButtons(true)}
        onMouseLeave={() => setShowHoverButtons(false)}
      >
        {/* Main chat bubble */}
        <button
          onClick={onFullScreen}
          className="w-14 h-14 bg-purple-600 rounded-full shadow-lg hover:bg-purple-700 transition-all hover:scale-105 flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          
          {/* New message indicator */}
          {hasNewMessage && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>

        {/* Hover buttons container - positioned to the left of main button */}
        <div className={`absolute top-1/2 -translate-y-1/2 -left-2 flex items-center gap-2 transition-all duration-300 ${
          showHoverButtons ? 'opacity-100 -translate-x-12' : 'opacity-0 translate-x-0 pointer-events-none'
        }`}>
          {/* Zoom button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Add zoom functionality if needed
            }}
            className="w-9 h-9 bg-white border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-all flex items-center justify-center hover:bg-gray-50 hover:border-gray-400"
            title="Zoom"
          >
            <ZoomIn className="w-4 h-4 text-gray-600" />
          </button>

          {/* Full screen button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFullScreen?.();
            }}
            className="w-9 h-9 bg-white border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-all flex items-center justify-center hover:bg-gray-50 hover:border-gray-400"
            title="Full Screen"
          >
            <Maximize2 className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Close button - positioned at top-right corner */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={`absolute -top-2 -right-2 w-6 h-6 bg-gray-800 text-white rounded-full transition-opacity flex items-center justify-center hover:bg-gray-900 ${
            showHoverButtons ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <X className="w-3 h-3" />
        </button>

        {/* Hover tooltip */}
        <div className={`absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-800 text-white text-sm rounded-md transition-opacity pointer-events-none whitespace-nowrap ${
          showHoverButtons ? 'opacity-100' : 'opacity-0'
        }`}>
          AI Assistant
        </div>
      </div>
    </div>
  );
};