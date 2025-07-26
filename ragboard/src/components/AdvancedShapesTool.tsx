import React, { useState, useCallback } from 'react';
import { 
  Shapes, 
  Square, 
  Circle, 
  Triangle, 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft,
  Minus,
  Plus,
  Star,
  Heart,
  Diamond,
  Hexagon,
  MessageCircle,
  Highlight,
  Edit3,
  Palette,
  Move,
  RotateCw
} from 'lucide-react';
import { clsx } from 'clsx';

interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
  rotation: number;
}

interface ShapeTemplate {
  id: string;
  name: string;
  icon: React.ElementType;
  category: 'basic' | 'arrows' | 'callouts' | 'highlights' | 'custom';
  type: string;
  defaultStyle: ShapeStyle;
  defaultSize: { width: number; height: number };
  description: string;
}

interface AdvancedShapesToolProps {
  onAddShape: (shape: ShapeTemplate & { style: ShapeStyle; size: { width: number; height: number } }) => void;
  onClose: () => void;
}

export const AdvancedShapesTool: React.FC<AdvancedShapesToolProps> = ({ onAddShape, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('basic');
  const [selectedShape, setSelectedShape] = useState<ShapeTemplate | null>(null);
  const [customStyle, setCustomStyle] = useState<ShapeStyle>({
    fill: '#3b82f6',
    stroke: '#1e40af',
    strokeWidth: 2,
    opacity: 1,
    rotation: 0
  });
  const [customSize, setCustomSize] = useState({ width: 150, height: 100 });
  const [previewMode, setPreviewMode] = useState<'grid' | 'large'>('grid');

  const shapeTemplates: ShapeTemplate[] = [
    // Basic Shapes
    {
      id: 'rectangle',
      name: 'Rectangle',
      icon: Square,
      category: 'basic',
      type: 'rectangle',
      defaultStyle: { fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 150, height: 100 },
      description: 'Basic rectangular shape'
    },
    {
      id: 'circle',
      name: 'Circle',
      icon: Circle,
      category: 'basic',
      type: 'circle',
      defaultStyle: { fill: '#10b981', stroke: '#059669', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 120, height: 120 },
      description: 'Perfect circle shape'
    },
    {
      id: 'triangle',
      name: 'Triangle',
      icon: Triangle,
      category: 'basic',
      type: 'triangle',
      defaultStyle: { fill: '#f59e0b', stroke: '#d97706', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 120, height: 120 },
      description: 'Triangular shape'
    },
    {
      id: 'diamond',
      name: 'Diamond',
      icon: Diamond,
      category: 'basic',
      type: 'diamond',
      defaultStyle: { fill: '#8b5cf6', stroke: '#7c3aed', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 120, height: 120 },
      description: 'Diamond/rhombus shape'
    },
    {
      id: 'hexagon',
      name: 'Hexagon',
      icon: Hexagon,
      category: 'basic',
      type: 'hexagon',
      defaultStyle: { fill: '#06b6d4', stroke: '#0891b2', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 140, height: 120 },
      description: 'Six-sided polygon'
    },
    {
      id: 'star',
      name: 'Star',
      icon: Star,
      category: 'basic',
      type: 'star',
      defaultStyle: { fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 120, height: 120 },
      description: 'Five-pointed star'
    },
    {
      id: 'heart',
      name: 'Heart',
      icon: Heart,
      category: 'basic',
      type: 'heart',
      defaultStyle: { fill: '#ef4444', stroke: '#dc2626', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 120, height: 100 },
      description: 'Heart shape'
    },

    // Arrows
    {
      id: 'arrow-right',
      name: 'Arrow Right',
      icon: ArrowRight,
      category: 'arrows',
      type: 'arrow-right',
      defaultStyle: { fill: '#374151', stroke: '#111827', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 150, height: 40 },
      description: 'Right-pointing arrow'
    },
    {
      id: 'arrow-left',
      name: 'Arrow Left',
      icon: ArrowLeft,
      category: 'arrows',
      type: 'arrow-left',
      defaultStyle: { fill: '#374151', stroke: '#111827', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 150, height: 40 },
      description: 'Left-pointing arrow'
    },
    {
      id: 'arrow-up',
      name: 'Arrow Up',
      icon: ArrowUp,
      category: 'arrows',
      type: 'arrow-up',
      defaultStyle: { fill: '#374151', stroke: '#111827', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 40, height: 150 },
      description: 'Upward-pointing arrow'
    },
    {
      id: 'arrow-down',
      name: 'Arrow Down',
      icon: ArrowDown,
      category: 'arrows',
      type: 'arrow-down',
      defaultStyle: { fill: '#374151', stroke: '#111827', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 40, height: 150 },
      description: 'Downward-pointing arrow'
    },
    {
      id: 'line',
      name: 'Line',
      icon: Minus,
      category: 'arrows',
      type: 'line',
      defaultStyle: { fill: 'none', stroke: '#374151', strokeWidth: 3, opacity: 1, rotation: 0 },
      defaultSize: { width: 200, height: 3 },
      description: 'Straight line'
    },

    // Callouts
    {
      id: 'callout-bubble',
      name: 'Speech Bubble',
      icon: MessageCircle,
      category: 'callouts',
      type: 'callout-bubble',
      defaultStyle: { fill: '#ffffff', stroke: '#374151', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 180, height: 120 },
      description: 'Speech bubble for annotations'
    },
    {
      id: 'callout-rounded',
      name: 'Rounded Callout',
      icon: MessageCircle,
      category: 'callouts',
      type: 'callout-rounded',
      defaultStyle: { fill: '#f3f4f6', stroke: '#6b7280', strokeWidth: 2, opacity: 1, rotation: 0 },
      defaultSize: { width: 180, height: 100 },
      description: 'Rounded rectangle callout'
    },

    // Highlights
    {
      id: 'highlight-rect',
      name: 'Rectangle Highlight',
      icon: Highlight,
      category: 'highlights',
      type: 'highlight-rect',
      defaultStyle: { fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 1, opacity: 0.7, rotation: 0 },
      defaultSize: { width: 200, height: 60 },
      description: 'Rectangular highlight overlay'
    },
    {
      id: 'highlight-circle',
      name: 'Circle Highlight',
      icon: Circle,
      category: 'highlights',
      type: 'highlight-circle',
      defaultStyle: { fill: '#ddd6fe', stroke: '#8b5cf6', strokeWidth: 1, opacity: 0.7, rotation: 0 },
      defaultSize: { width: 150, height: 150 },
      description: 'Circular highlight overlay'
    },

    // Custom shapes
    {
      id: 'process-box',
      name: 'Process Box',
      icon: Square,
      category: 'custom',
      type: 'process-box',
      defaultStyle: { fill: '#e0e7ff', stroke: '#3730a3', strokeWidth: 2, strokeDasharray: '5,5', opacity: 1, rotation: 0 },
      defaultSize: { width: 180, height: 80 },
      description: 'Dashed process box for workflows'
    },
    {
      id: 'decision-diamond',
      name: 'Decision Diamond',
      icon: Diamond,
      category: 'custom',
      type: 'decision-diamond',
      defaultStyle: { fill: '#fef3c7', stroke: '#d97706', strokeWidth: 2, opacity: 1, rotation: 45 },
      defaultSize: { width: 120, height: 120 },
      description: 'Diamond for decision points'
    }
  ];

  const categories = [
    { id: 'basic', name: 'Basic Shapes', icon: Square },
    { id: 'arrows', name: 'Arrows & Lines', icon: ArrowRight },
    { id: 'callouts', name: 'Callouts', icon: MessageCircle },
    { id: 'highlights', name: 'Highlights', icon: Highlight },
    { id: 'custom', name: 'Custom', icon: Star }
  ];

  const filteredShapes = shapeTemplates.filter(shape => 
    selectedCategory === 'all' || shape.category === selectedCategory
  );

  const handleShapeSelect = useCallback((shape: ShapeTemplate) => {
    setSelectedShape(shape);
    setCustomStyle(shape.defaultStyle);
    setCustomSize(shape.defaultSize);
  }, []);

  const handleAddShape = useCallback(() => {
    if (selectedShape) {
      onAddShape({
        ...selectedShape,
        style: customStyle,
        size: customSize
      });
    }
  }, [selectedShape, customStyle, customSize, onAddShape]);

  const renderShapePreview = (shape: ShapeTemplate, style: ShapeStyle, size: { width: number; height: number }, isLarge = false) => {
    const scale = isLarge ? 1 : 0.4;
    const previewWidth = size.width * scale;
    const previewHeight = size.height * scale;

    const svgProps = {
      width: previewWidth,
      height: previewHeight,
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

    switch (shape.type) {
      case 'rectangle':
      case 'process-box':
        return (
          <svg {...svgProps}>
            <rect
              x={style.strokeWidth / 2}
              y={style.strokeWidth / 2}
              width={size.width - style.strokeWidth}
              height={size.height - style.strokeWidth}
              rx={shape.type === 'process-box' ? 8 : 0}
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

      case 'heart':
        return (
          <svg {...svgProps}>
            <path
              d={`M${size.width / 2},${size.height - style.strokeWidth} C${size.width / 2},${size.height - style.strokeWidth} ${style.strokeWidth / 2},${size.height / 2} ${style.strokeWidth / 2},${size.height / 3} C${style.strokeWidth / 2},${style.strokeWidth / 2} ${size.width / 4},${style.strokeWidth / 2} ${size.width / 2},${size.height / 3} C${size.width * 3 / 4},${style.strokeWidth / 2} ${size.width - style.strokeWidth / 2},${style.strokeWidth / 2} ${size.width - style.strokeWidth / 2},${size.height / 3} C${size.width - style.strokeWidth / 2},${size.height / 2} ${size.width / 2},${size.height - style.strokeWidth} ${size.width / 2},${size.height - style.strokeWidth}`}
              {...shapeProps}
            />
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

      case 'callout-bubble':
        return (
          <svg {...svgProps}>
            <rect
              x={style.strokeWidth / 2}
              y={style.strokeWidth / 2}
              width={size.width - style.strokeWidth}
              height={size.height - 30}
              rx={15}
              {...shapeProps}
            />
            <path
              d={`M${size.width / 3},${size.height - 30} L${size.width / 2},${size.height - 5} L${size.width / 2 + 20},${size.height - 30} Z`}
              {...shapeProps}
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
            style={{ width: previewWidth, height: previewHeight }}
          >
            <Shapes className="w-8 h-8" />
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Shapes className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Advanced Shapes</h2>
              <p className="text-sm text-gray-600">Add professional shapes and annotations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Categories Sidebar */}
          <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
            <div className="space-y-2">
              {categories.map(category => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={clsx(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                      'flex items-center gap-3',
                      selectedCategory === category.id
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                        : 'hover:bg-gray-100 text-gray-700'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {category.name}
                  </button>
                );
              })}
            </div>

            {/* Preview Mode Toggle */}
            <div className="mt-6 pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview Mode
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => setPreviewMode('grid')}
                  className={clsx(
                    'flex-1 px-2 py-1 rounded text-xs transition-colors',
                    previewMode === 'grid'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  Grid
                </button>
                <button
                  onClick={() => setPreviewMode('large')}
                  className={clsx(
                    'flex-1 px-2 py-1 rounded text-xs transition-colors',
                    previewMode === 'large'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  Large
                </button>
              </div>
            </div>
          </div>

          {/* Shapes Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className={clsx(
              'p-6',
              previewMode === 'grid' 
                ? 'grid grid-cols-4 gap-4' 
                : 'grid grid-cols-2 gap-6'
            )}>
              {filteredShapes.map(shape => (
                <button
                  key={shape.id}
                  onClick={() => handleShapeSelect(shape)}
                  className={clsx(
                    'p-4 border-2 rounded-lg transition-all hover:shadow-md',
                    'flex flex-col items-center gap-3',
                    selectedShape?.id === shape.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-center">
                    {renderShapePreview(shape, shape.defaultStyle, shape.defaultSize, previewMode === 'large')}
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-sm">{shape.name}</div>
                    {previewMode === 'large' && (
                      <div className="text-xs text-gray-500 mt-1">
                        {shape.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Customization Panel */}
          {selectedShape && (
            <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
              <div className="space-y-6">
                {/* Preview */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Preview</h3>
                  <div className="bg-white border rounded-lg p-4 flex items-center justify-center">
                    {renderShapePreview(selectedShape, customStyle, customSize, true)}
                  </div>
                </div>

                {/* Style Controls */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Style
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Fill Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={customStyle.fill}
                          onChange={(e) => setCustomStyle(prev => ({ ...prev, fill: e.target.value }))}
                          className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customStyle.fill}
                          onChange={(e) => setCustomStyle(prev => ({ ...prev, fill: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Stroke Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={customStyle.stroke}
                          onChange={(e) => setCustomStyle(prev => ({ ...prev, stroke: e.target.value }))}
                          className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customStyle.stroke}
                          onChange={(e) => setCustomStyle(prev => ({ ...prev, stroke: e.target.value }))}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Stroke Width: {customStyle.strokeWidth}px
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={customStyle.strokeWidth}
                        onChange={(e) => setCustomStyle(prev => ({ ...prev, strokeWidth: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Opacity: {Math.round(customStyle.opacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={customStyle.opacity}
                        onChange={(e) => setCustomStyle(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        <RotateCw className="inline w-3 h-3 mr-1" />
                        Rotation: {customStyle.rotation}°
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={customStyle.rotation}
                        onChange={(e) => setCustomStyle(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Stroke Style</label>
                      <select
                        value={customStyle.strokeDasharray || 'solid'}
                        onChange={(e) => setCustomStyle(prev => ({ 
                          ...prev, 
                          strokeDasharray: e.target.value === 'solid' ? undefined : e.target.value 
                        }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="solid">Solid</option>
                        <option value="5,5">Dashed</option>
                        <option value="2,2">Dotted</option>
                        <option value="10,5">Long Dash</option>
                        <option value="10,5,2,5">Dash Dot</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Size Controls */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Move className="w-4 h-4" />
                    Size
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Width</label>
                      <input
                        type="number"
                        value={customSize.width}
                        onChange={(e) => setCustomSize(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        min="10"
                        max="1000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Height</label>
                      <input
                        type="number"
                        value={customSize.height}
                        onChange={(e) => setCustomSize(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        min="10"
                        max="1000"
                      />
                    </div>
                    <button
                      onClick={() => setCustomSize({ width: customSize.width, height: customSize.width })}
                      className="w-full px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      Make Square
                    </button>
                  </div>
                </div>

                {/* Add Button */}
                <button
                  onClick={handleAddShape}
                  className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add {selectedShape.name}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};