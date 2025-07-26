import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Box, Users, Minimize2, Maximize2, X, Edit2, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface FrameNodeData {
  title: string;
  color?: string;
  width?: number;
  height?: number;
  children?: string[];
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: Partial<FrameNodeData>) => void;
}

export const FrameNode: React.FC<NodeProps<FrameNodeData>> = ({ id, data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(data.title);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: data.width || 400,
    height: data.height || 300,
  });
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { getNodes, setNodes } = useReactFlow();

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditing]);

  const handleTitleSubmit = useCallback(() => {
    setIsEditing(false);
    if (data.onUpdate && title !== data.title) {
      data.onUpdate(id, { title });
    }
  }, [id, title, data]);

  const handleDelete = useCallback(() => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  }, [id, data]);

  const handleResize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      setDimensions({
        width: Math.max(200, startWidth + deltaX),
        height: Math.max(150, startHeight + deltaY),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (data.onUpdate) {
        data.onUpdate(id, {
          width: dimensions.width,
          height: dimensions.height,
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [id, dimensions, data]);

  const getChildNodes = useCallback(() => {
    if (!data.children || data.children.length === 0) return [];
    const allNodes = getNodes();
    return allNodes.filter(node => data.children?.includes(node.id));
  }, [data.children, getNodes]);

  const childCount = data.children?.length || 0;

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      <div
        ref={nodeRef}
        className={cn(
          "group relative rounded-lg transition-all duration-200",
          "border-2 border-dashed",
          selected ? "border-blue-500 shadow-lg" : "border-gray-300",
          isResizing && "cursor-nwse-resize",
          data.color || "bg-gray-50"
        )}
        style={{
          width: isMinimized ? 250 : dimensions.width,
          height: isMinimized ? 60 : dimensions.height,
          backgroundColor: data.color ? `${data.color}20` : undefined,
        }}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-3 py-2 border-b",
          selected ? "border-blue-200" : "border-gray-200",
          "bg-white rounded-t-lg"
        )}>
          <div className="flex items-center gap-2 flex-1">
            <Box className="w-4 h-4 text-gray-600" />
            {isEditing ? (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') {
                    setTitle(data.title);
                    setIsEditing(false);
                  }
                }}
                className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="flex-1 text-sm font-medium text-gray-700 cursor-text"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
              >
                {title}
              </span>
            )}
            
            {childCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full">
                <Users className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-600">{childCount}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isEditing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Edit title"
              >
                <Edit2 className="w-3 h-3 text-gray-600" />
              </button>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? (
                <Maximize2 className="w-3 h-3 text-gray-600" />
              ) : (
                <Minimize2 className="w-3 h-3 text-gray-600" />
              )}
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="Delete frame"
            >
              <X className="w-3 h-3 text-red-600" />
            </button>
          </div>
        </div>

        {/* Content area */}
        {!isMinimized && (
          <div className="p-4 h-full">
            {childCount === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Drag nodes here to group them
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                {childCount} item{childCount !== 1 ? 's' : ''} in this frame
              </div>
            )}
          </div>
        )}

        {/* Resize handle */}
        {!isMinimized && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={handleResize}
          >
            <svg
              className="w-full h-full text-gray-400"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M14 14 L14 10 M14 14 L10 14 M14 14 L6 6" 
                strokeWidth="1.5" 
                stroke="currentColor" 
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  );
};