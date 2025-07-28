import React, { useState, useCallback, useEffect } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import { Camera, Plus, Trash2, Edit2, Check, X, Grid, List } from 'lucide-react';
import { cn } from '../lib/utils';

interface Scene {
  id: string;
  name: string;
  position: { x: number; y: number; zoom: number };
  thumbnail?: string;
  createdAt: Date;
  nodeCount?: number;
}

interface SceneNavigatorProps {
  scenes: Scene[];
  currentSceneId?: string;
  onSceneCreate?: (scene: Omit<Scene, 'id' | 'createdAt'>) => void;
  onSceneDelete?: (sceneId: string) => void;
  onSceneUpdate?: (sceneId: string, updates: Partial<Scene>) => void;
  onSceneSelect?: (sceneId: string) => void;
}

export const SceneNavigator: React.FC<SceneNavigatorProps> = ({
  scenes,
  currentSceneId,
  onSceneCreate,
  onSceneDelete,
  onSceneUpdate,
  onSceneSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const { getViewport, setViewport, getNodes } = useReactFlow();
  
  const nodeCount = useStore((state: any) => state.nodes.length);

  const captureSceneThumbnail = useCallback(() => {
    // In a real implementation, this would capture a screenshot of the canvas
    // For now, we'll return a placeholder
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="150" fill="#f3f4f6"/>
        <text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="14">
          ${nodeCount} nodes
        </text>
      </svg>
    `)}`;
  }, [nodeCount]);

  const handleCreateScene = useCallback(() => {
    const viewport = getViewport();
    const nodes = getNodes();
    
    if (onSceneCreate) {
      onSceneCreate({
        name: `Scene ${scenes.length + 1}`,
        position: viewport,
        thumbnail: captureSceneThumbnail(),
        nodeCount: nodes.length,
      });
    }
  }, [getViewport, getNodes, scenes.length, onSceneCreate, captureSceneThumbnail]);

  const handleSelectScene = useCallback((scene: Scene) => {
    setViewport(scene.position, { duration: 800 });
    if (onSceneSelect) {
      onSceneSelect(scene.id);
    }
  }, [setViewport, onSceneSelect]);

  const handleUpdateScene = useCallback((sceneId: string) => {
    const viewport = getViewport();
    const nodes = getNodes();
    
    if (onSceneUpdate) {
      onSceneUpdate(sceneId, {
        position: viewport,
        thumbnail: captureSceneThumbnail(),
        nodeCount: nodes.length,
      });
    }
  }, [getViewport, getNodes, onSceneUpdate, captureSceneThumbnail]);

  const handleEditName = useCallback((sceneId: string, name: string) => {
    setEditingId(sceneId);
    setEditingName(name);
  }, []);

  const handleSaveName = useCallback(() => {
    if (editingId && onSceneUpdate) {
      onSceneUpdate(editingId, { name: editingName });
    }
    setEditingId(null);
    setEditingName('');
  }, [editingId, editingName, onSceneUpdate]);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed top-20 right-4 p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-all",
          isOpen && "bg-blue-50 border-blue-300"
        )}
        title="Scene Navigator"
      >
        <Camera className="w-5 h-5 text-gray-700" />
      </button>

      {/* Scene Panel */}
      {isOpen && (
        <div className="fixed top-32 right-4 w-80 max-h-[calc(100vh-160px)] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Scenes</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateScene}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Create scene from current view"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
              <div className="flex items-center bg-gray-100 rounded p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-1 rounded transition-colors",
                    viewMode === 'grid' ? "bg-white shadow-sm" : "hover:bg-gray-200"
                  )}
                >
                  <Grid className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-1 rounded transition-colors",
                    viewMode === 'list' ? "bg-white shadow-sm" : "hover:bg-gray-200"
                  )}
                >
                  <List className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Scenes */}
          <div className="overflow-y-auto max-h-[calc(100vh-240px)]">
            {scenes.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Camera className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No scenes yet</p>
                <p className="text-xs mt-1">Create a scene to save your current view</p>
              </div>
            ) : (
              <div className={cn(
                "p-4",
                viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-2"
              )}>
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className={cn(
                      "group relative bg-gray-50 border rounded-lg overflow-hidden cursor-pointer transition-all",
                      currentSceneId === scene.id ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300",
                      viewMode === 'list' && "flex items-center p-3"
                    )}
                    onClick={() => handleSelectScene(scene)}
                  >
                    {viewMode === 'grid' ? (
                      <>
                        {/* Thumbnail */}
                        <div className="aspect-[4/3] bg-gray-100">
                          {scene.thumbnail ? (
                            <img 
                              src={scene.thumbnail} 
                              alt={scene.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Camera className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        
                        {/* Info */}
                        <div className="p-2">
                          {editingId === scene.id ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={handleSaveName}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveName();
                                if (e.key === 'Escape') {
                                  setEditingId(null);
                                  setEditingName('');
                                }
                              }}
                              className="w-full px-1 py-0.5 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          ) : (
                            <h4 className="text-sm font-medium text-gray-900 truncate">{scene.name}</h4>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5">
                            {scene.nodeCount || 0} nodes
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* List view */}
                        <div className="flex-1">
                          {editingId === scene.id ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={handleSaveName}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveName();
                                if (e.key === 'Escape') {
                                  setEditingId(null);
                                  setEditingName('');
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          ) : (
                            <>
                              <h4 className="text-sm font-medium text-gray-900">{scene.name}</h4>
                              <p className="text-xs text-gray-500">
                                {scene.nodeCount || 0} nodes • {new Date(scene.createdAt).toLocaleDateString()}
                              </p>
                            </>
                          )}
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    <div className={cn(
                      "absolute flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                      viewMode === 'grid' ? "top-2 right-2" : "right-2"
                    )}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateScene(scene.id);
                        }}
                        className="p-1 bg-white rounded shadow hover:shadow-md transition-shadow"
                        title="Update scene to current view"
                      >
                        <Camera className="w-3 h-3 text-gray-600" />
                      </button>
                      {!editingId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditName(scene.id, scene.name);
                          }}
                          className="p-1 bg-white rounded shadow hover:shadow-md transition-shadow"
                          title="Edit name"
                        >
                          <Edit2 className="w-3 h-3 text-gray-600" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSceneDelete) {
                            onSceneDelete(scene.id);
                          }
                        }}
                        className="p-1 bg-white rounded shadow hover:shadow-md transition-shadow"
                        title="Delete scene"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};