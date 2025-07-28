import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '../types';
import { Shapes, Square, Circle, Triangle, ArrowRight, Star } from 'lucide-react';
import { clsx } from 'clsx';

interface ShapeData {
  id: string;
  title: string;
  metadata: {
    shapeData: {
      id: string;
      name: string;
      type: string;
      category: string;
      style: {
        fill: string;
        stroke: string;
        strokeWidth: number;
        strokeDasharray?: string;
        opacity: number;
        rotation: number;
      };
      size: {
        width: number;
        height: number;
      };
    };
  };
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updates: any) => void;
}

export const ShapeNode: React.FC<NodeProps<ShapeData>> = ({ 
  id, 
  data, 
  selected 
}) => {
  const { shapeData } = data.metadata;
  const { style, size } = shapeData;

  const renderShape = () => {
    const svgProps = {
      width: size.width,
      height: size.height,
      viewBox: `0 0 ${size.width} ${size.height}`,
      style: {
        transform: `rotate(${style.rotation}deg)`
      }
    };

    const shapeProps = {
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      strokeDasharray: style.strokeDasharray,
      opacity: style.opacity
    };

    switch (shapeData.type) {
      case 'rectangle':
      case 'process-box':
        return (
          <svg {...svgProps}>
            <rect
              x={style.strokeWidth / 2}
              y={style.strokeWidth / 2}
              width={size.width - style.strokeWidth}
              height={size.height - style.strokeWidth}
              rx={shapeData.type === 'process-box' ? 8 : 0}
              {...shapeProps}
            />
          </svg>
        );

      case 'circle':
      case 'highlight-circle':
        return (
          <svg {...svgProps}>
            <circle
              cx={size.width / 2}
              cy={size.height / 2}
              r={(Math.min(size.width, size.height) - style.strokeWidth) / 2}
              {...shapeProps}
            />
          </svg>
        );

      case 'triangle':
        return (
          <svg {...svgProps}>
            <polygon
              points={`${size.width / 2},${style.strokeWidth} ${size.width - style.strokeWidth / 2},${size.height - style.strokeWidth / 2} ${style.strokeWidth / 2},${size.height - style.strokeWidth / 2}`}
              {...shapeProps}
            />
          </svg>
        );

      case 'diamond':
      case 'decision-diamond':
        return (
          <svg {...svgProps}>
            <polygon
              points={`${size.width / 2},${style.strokeWidth} ${size.width - style.strokeWidth / 2},${size.height / 2} ${size.width / 2},${size.height - style.strokeWidth / 2} ${style.strokeWidth / 2},${size.height / 2}`}
              {...shapeProps}
            />
          </svg>
        );

      case 'star':
        const starPoints = Array.from({ length: 10 }, (_, i) => {
          const angle = (i * Math.PI) / 5;
          const radius = i % 2 === 0 ? size.width / 2 - style.strokeWidth : size.width / 4;
          const x = size.width / 2 + radius * Math.cos(angle - Math.PI / 2);
          const y = size.height / 2 + radius * Math.sin(angle - Math.PI / 2);
          return `${x},${y}`;
        }).join(' ');
        
        return (
          <svg {...svgProps}>
            <polygon points={starPoints} {...shapeProps} />
          </svg>
        );

      case 'arrow-right':
        return (
          <svg {...svgProps}>
            <path
              d={`M${style.strokeWidth / 2},${size.height / 2 - 10} L${size.width - 30},${size.height / 2 - 10} L${size.width - 30},${size.height / 2 - 15} L${size.width - style.strokeWidth / 2},${size.height / 2} L${size.width - 30},${size.height / 2 + 15} L${size.width - 30},${size.height / 2 + 10} L${style.strokeWidth / 2},${size.height / 2 + 10} Z`}
              {...shapeProps}
            />
          </svg>
        );

      case 'line':
        return (
          <svg {...svgProps}>
            <line
              x1={style.strokeWidth / 2}
              y1={size.height / 2}
              x2={size.width - style.strokeWidth / 2}
              y2={size.height / 2}
              {...shapeProps}
              fill="none"
            />
          </svg>
        );

      case 'highlight-rect':
        return (
          <svg {...svgProps}>
            <rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              {...shapeProps}
            />
          </svg>
        );

      default:
        return (
          <div 
            className="border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400"
            style={{ width: size.width, height: size.height }}
          >
            <Shapes className="w-8 h-8" />
          </div>
        );
    }
  };

  const getShapeIcon = () => {
    switch (shapeData.type) {
      case 'rectangle':
      case 'process-box':
        return <Square className="w-4 h-4" />;
      case 'circle':
      case 'highlight-circle':
        return <Circle className="w-4 h-4" />;
      case 'triangle':
        return <Triangle className="w-4 h-4" />;
      case 'arrow-right':
        return <ArrowRight className="w-4 h-4" />;
      case 'star':
        return <Star className="w-4 h-4" />;
      default:
        return <Shapes className="w-4 h-4" />;
    }
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

  return (
    <div className={clsx(
      'relative group',
      selected && 'ring-2 ring-indigo-500 ring-opacity-50'
    )}>
      {/* Shape Info */}
      {selected && (
        <div className="absolute -top-8 left-0 bg-indigo-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1 z-10">
          {getShapeIcon()}
          <span>{shapeData.name}</span>
          <button
            onClick={handleDelete}
            className="ml-2 text-white hover:text-red-200 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* The actual shape */}
      <div className="flex items-center justify-center">
        {renderShape()}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 border-2 border-white bg-indigo-500"
        style={{ top: -4 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 border-2 border-white bg-indigo-500"
        style={{ bottom: -4 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        className="w-2 h-2 border-2 border-white bg-indigo-500"
        style={{ left: -4 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 border-2 border-white bg-indigo-500"
        style={{ right: -4 }}
      />
    </div>
  );
};