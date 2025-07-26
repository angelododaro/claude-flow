import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  Edit3, 
  Trash2, 
  Move, 
  RotateCw, 
  Palette, 
  Type, 
  Square, 
  Circle, 
  ArrowRight,
  Triangle,
  MessageCircle,
  Highlight,
  Minus
} from 'lucide-react';
import { clsx } from 'clsx';

export interface AnnotationData {
  id: string;
  type: 'text' | 'arrow' | 'rectangle' | 'circle' | 'line' | 'callout' | 'highlight';
  content?: string;
  style: {
    color: string;
    backgroundColor: string;
    borderColor: string;
    fontSize: number;
    fontWeight: string;
    opacity: number;
    borderWidth: number;
    borderStyle: 'solid' | 'dashed' | 'dotted';
    rotation: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
  position: {
    x: number;
    y: number;
  };
  createdAt: Date;
  onUpdate?: (id: string, updates: Partial<AnnotationData>) => void;
  onDelete?: (id: string) => void;
}

export const AnnotationNode: React.FC<NodeProps<AnnotationData>> = ({ 
  id, 
  data, 
  selected 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(data.content || '');
  const [showToolbar, setShowToolbar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    if (data.type === 'text' || data.type === 'callout') {
      setIsEditing(true);
    }
  }, [data.type]);

  const handleContentSave = useCallback(() => {
    if (data.onUpdate) {
      data.onUpdate(id, { content: editContent });
    }
    setIsEditing(false);
  }, [id, editContent, data.onUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleContentSave();
    } else if (e.key === 'Escape') {
      setEditContent(data.content || '');
      setIsEditing(false);
    }
  }, [handleContentSave, data.content]);

  const handleStyleUpdate = useCallback((styleUpdates: Partial<AnnotationData['style']>) => {
    if (data.onUpdate) {
      data.onUpdate(id, {
        style: { ...data.style, ...styleUpdates }
      });
    }
  }, [id, data.style, data.onUpdate]);

  const handleDelete = useCallback(() => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  }, [id, data.onDelete]);

  const renderShape = () => {
    const { type, style, dimensions } = data;
    const commonStyle = {
      width: dimensions.width,
      height: dimensions.height,
      transform: `rotate(${style.rotation}deg)`,
      opacity: style.opacity,
      border: `${style.borderWidth}px ${style.borderStyle} ${style.borderColor}`,
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
    };

    switch (type) {
      case 'text':
        return (
          <div
            className="relative p-2 overflow-hidden"
            style={commonStyle}
            onDoubleClick={handleDoubleClick}
          >
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={handleContentSave}
                onKeyDown={handleKeyDown}
                className="w-full h-full resize-none border-none outline-none bg-transparent"
                style={{ 
                  color: style.color, 
                  fontSize: style.fontSize,
                  fontWeight: style.fontWeight 
                }}
              />
            ) : (
              <div className="whitespace-pre-wrap cursor-text">
                {data.content || 'Double-click to edit'}
              </div>
            )}
          </div>
        );

      case 'rectangle':
        return (
          <div
            className="border"
            style={commonStyle}
          />
        );

      case 'circle':
        return (
          <div
            className="border rounded-full"
            style={commonStyle}
          />
        );

      case 'line':
        return (
          <div
            className="relative"
            style={{ ...commonStyle, backgroundColor: 'transparent' }}
          >
            <div
              className="absolute top-1/2 left-0 w-full"
              style={{
                height: style.borderWidth,
                backgroundColor: style.borderColor,
                transform: 'translateY(-50%)',
              }}
            />
          </div>
        );

      case 'arrow':
        return (
          <div
            className="relative flex items-center"
            style={{ ...commonStyle, backgroundColor: 'transparent' }}
          >
            <div
              className="flex-1"
              style={{
                height: style.borderWidth,
                backgroundColor: style.borderColor,
              }}
            />
            <div
              className="w-0 h-0 ml-1"
              style={{
                borderTop: `${style.borderWidth * 2}px solid transparent`,
                borderBottom: `${style.borderWidth * 2}px solid transparent`,
                borderLeft: `${style.borderWidth * 3}px solid ${style.borderColor}`,
              }}
            />
          </div>
        );

      case 'callout':
        return (
          <div
            className="relative p-3 rounded-lg border shadow-sm"
            style={commonStyle}
            onDoubleClick={handleDoubleClick}
          >
            {/* Callout pointer */}
            <div
              className="absolute -bottom-2 left-4 w-0 h-0"
              style={{
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: `8px solid ${style.borderColor}`,
              }}
            />
            <div
              className="absolute -bottom-1 left-4 w-0 h-0"
              style={{
                borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent',
                borderTop: `7px solid ${style.backgroundColor}`,
              }}
            />
            
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={handleContentSave}
                onKeyDown={handleKeyDown}
                className="w-full h-full resize-none border-none outline-none bg-transparent"
                style={{ 
                  color: style.color, 
                  fontSize: style.fontSize,
                  fontWeight: style.fontWeight 
                }}
              />
            ) : (
              <div className="whitespace-pre-wrap cursor-text">
                {data.content || 'Double-click to edit'}
              </div>
            )}
          </div>
        );

      case 'highlight':
        return (
          <div
            className="relative"
            style={{
              ...commonStyle,
              backgroundColor: `${style.backgroundColor}40`, // Semi-transparent
              border: 'none',
            }}
          >
            {data.content && (
              <div 
                className="p-1 text-center font-semibold"
                style={{ 
                  color: style.color,
                  fontSize: style.fontSize * 0.8
                }}
              >
                {data.content}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="p-2 bg-gray-100 border border-gray-300 rounded">
            Unknown annotation type: {type}
          </div>
        );
    }
  };

  const Toolbar = () => (
    <div className="absolute -top-12 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex items-center gap-1 z-10">
      {/* Color picker */}
      <div className="flex items-center gap-1">
        <Palette className="w-4 h-4 text-gray-600" />
        <input
          type="color"
          value={data.style.color}
          onChange={(e) => handleStyleUpdate({ color: e.target.value })}
          className="w-6 h-6 border border-gray-300 rounded cursor-pointer"
        />
        <input
          type="color"
          value={data.style.backgroundColor}
          onChange={(e) => handleStyleUpdate({ backgroundColor: e.target.value })}
          className="w-6 h-6 border border-gray-300 rounded cursor-pointer"
        />
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Border style */}
      <select
        value={data.style.borderStyle}
        onChange={(e) => handleStyleUpdate({ borderStyle: e.target.value as any })}
        className="text-xs border border-gray-300 rounded px-1 py-1"
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
      </select>

      {/* Border width */}
      <input
        type="range"
        min="1"
        max="10"
        value={data.style.borderWidth}
        onChange={(e) => handleStyleUpdate({ borderWidth: parseInt(e.target.value) })}
        className="w-16"
      />

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Font size for text types */}
      {(data.type === 'text' || data.type === 'callout') && (
        <>
          <Type className="w-4 h-4 text-gray-600" />
          <input
            type="range"
            min="8"
            max="24"
            value={data.style.fontSize}
            onChange={(e) => handleStyleUpdate({ fontSize: parseInt(e.target.value) })}
            className="w-16"
          />
        </>
      )}

      {/* Opacity */}
      <input
        type="range"
        min="0.1"
        max="1"
        step="0.1"
        value={data.style.opacity}
        onChange={(e) => handleStyleUpdate({ opacity: parseFloat(e.target.value) })}
        className="w-16"
      />

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Rotation */}
      <RotateCw className="w-4 h-4 text-gray-600" />
      <input
        type="range"
        min="0"
        max="360"
        value={data.style.rotation}
        onChange={(e) => handleStyleUpdate({ rotation: parseInt(e.target.value) })}
        className="w-16"
      />

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
        title="Delete annotation"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  const getTypeIcon = () => {
    switch (data.type) {
      case 'text': return <Type className="w-4 h-4" />;
      case 'arrow': return <ArrowRight className="w-4 h-4" />;
      case 'rectangle': return <Square className="w-4 h-4" />;
      case 'circle': return <Circle className="w-4 h-4" />;
      case 'line': return <Minus className="w-4 h-4" />;
      case 'callout': return <MessageCircle className="w-4 h-4" />;
      case 'highlight': return <Highlight className="w-4 h-4" />;
      default: return <Edit3 className="w-4 h-4" />;
    }
  };

  return (
    <div
      ref={nodeRef}
      className={clsx(
        'relative group',
        selected && 'ring-2 ring-blue-500 ring-opacity-50',
        isDragging && 'opacity-75'
      )}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
    >
      {/* Type indicator */}
      {selected && (
        <div className="absolute -top-6 -right-6 bg-blue-500 text-white p-1 rounded text-xs flex items-center gap-1">
          {getTypeIcon()}
          <span className="capitalize">{data.type}</span>
        </div>
      )}

      {/* Toolbar */}
      {showToolbar && selected && <Toolbar />}

      {/* The actual annotation shape */}
      {renderShape()}

      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 border-2 border-white bg-blue-500"
        style={{ top: -4 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 border-2 border-white bg-blue-500"
        style={{ bottom: -4 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        className="w-2 h-2 border-2 border-white bg-blue-500"
        style={{ left: -4 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 border-2 border-white bg-blue-500"
        style={{ right: -4 }}
      />
    </div>
  );
};

// Factory function to create annotation nodes
export const createAnnotationNode = (
  type: AnnotationData['type'],
  position: { x: number; y: number },
  options: Partial<AnnotationData> = {}
): AnnotationData => {
  const defaultDimensions = {
    text: { width: 200, height: 100 },
    arrow: { width: 150, height: 20 },
    rectangle: { width: 150, height: 100 },
    circle: { width: 100, height: 100 },
    line: { width: 150, height: 2 },
    callout: { width: 200, height: 120 },
    highlight: { width: 150, height: 30 },
  };

  const defaultContent = {
    text: 'Edit this text...',
    callout: 'Add your note here...',
    highlight: 'Highlight',
    arrow: '',
    rectangle: '',
    circle: '',
    line: '',
  };

  return {
    id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    content: defaultContent[type],
    style: {
      color: '#000000',
      backgroundColor: type === 'highlight' ? '#ffff00' : '#ffffff',
      borderColor: '#333333',
      fontSize: 14,
      fontWeight: 'normal',
      opacity: 1,
      borderWidth: 2,
      borderStyle: 'solid',
      rotation: 0,
      ...options.style,
    },
    dimensions: defaultDimensions[type],
    position,
    createdAt: new Date(),
    ...options,
  };
};