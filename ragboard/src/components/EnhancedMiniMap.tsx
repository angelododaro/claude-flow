import React, { useState, useCallback } from 'react';
import { MiniMap as ReactFlowMiniMap, useReactFlow, Node } from '@xyflow/react';
import { Map, ZoomIn, ZoomOut, Maximize, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface EnhancedMiniMapProps {
  className?: string;
  style?: React.CSSProperties;
}

export const EnhancedMiniMap: React.FC<EnhancedMiniMapProps> = ({ className, style }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState<'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'>('bottom-right');
  
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const nodeColor = useCallback((node: Node) => {
    switch (node.type) {
      case 'resourceNode':
        return '#3B82F6'; // blue
      case 'aiChatNode':
        return '#8B5CF6'; // purple
      case 'folderNode':
        return '#F59E0B'; // amber
      case 'textNode':
        return '#10B981'; // emerald
      case 'urlNode':
        return '#06B6D4'; // cyan
      case 'frameNode':
        return '#6B7280'; // gray
      default:
        return '#9CA3AF'; // gray-400
    }
  }, []);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-left': 'top-4 left-4',
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className={cn(
          "fixed p-2 bg-white border border-gray-200 rounded-lg shadow-lg hover:shadow-xl transition-shadow",
          positionClasses[position],
          "z-10"
        )}
        title="Show mini map"
      >
        <Map className="w-4 h-4 text-gray-600" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bg-white border border-gray-200 rounded-lg shadow-lg",
        positionClasses[position],
        isExpanded ? "w-80 h-60" : "w-48 h-36",
        "transition-all duration-200",
        "z-10",
        className
      )}
      style={style}
    >
      {/* Controls */}
      <div className="absolute -top-9 right-0 flex items-center gap-1 bg-white border border-gray-200 rounded-t-lg px-2 py-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          <Maximize className="w-3 h-3 text-gray-600" />
        </button>
        
        <button
          onClick={() => zoomIn()}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-3 h-3 text-gray-600" />
        </button>
        
        <button
          onClick={() => zoomOut()}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-3 h-3 text-gray-600" />
        </button>
        
        <button
          onClick={() => fitView()}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Fit view"
        >
          <Maximize className="w-3 h-3 text-gray-600" />
        </button>
        
        <div className="w-px h-4 bg-gray-200 mx-1" />
        
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Hide mini map"
        >
          <EyeOff className="w-3 h-3 text-gray-600" />
        </button>
      </div>

      {/* Position selector */}
      <div className="absolute -bottom-7 right-0 flex items-center gap-1 bg-white border border-gray-200 rounded-b-lg px-2 py-1 text-xs">
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value as typeof position)}
          className="text-xs border-none outline-none bg-transparent text-gray-600"
        >
          <option value="top-right">Top Right</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="top-left">Top Left</option>
        </select>
      </div>

      {/* MiniMap */}
      <ReactFlowMiniMap
        nodeColor={nodeColor}
        nodeStrokeWidth={3}
        pannable
        zoomable
        className="rounded-lg"
        maskColor="rgb(240, 240, 240, 0.8)"
      />

      {/* Legend */}
      {isExpanded && (
        <div className="absolute bottom-2 left-2 bg-white/90 rounded p-2 text-xs">
          <div className="font-semibold mb-1">Node Types:</div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded" />
              <span>Resource</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded" />
              <span>AI Chat</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-amber-500 rounded" />
              <span>Folder</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-500 rounded" />
              <span>Text</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-cyan-500 rounded" />
              <span>URL</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-500 rounded" />
              <span>Frame</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};