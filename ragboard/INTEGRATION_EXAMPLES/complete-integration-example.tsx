// Complete Integration Example: Combining All Open-Source Tools
// This example shows how to integrate multiple tools in a single component

import React, { useState, useRef, useEffect } from 'react';
import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';
import { Excalidraw } from '@excalidraw/excalidraw';
import videojs from 'video.js';
import RecordRTC from 'recordrtc';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import posthog from 'posthog-js';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Can } from '@casl/react';
import { useAbility } from '../contexts/AbilityContext';
import { useAnalytics } from '../hooks/useAnalytics';

// Main integrated board component
export function IntegratedBoard({ boardId }: { boardId: string }) {
  const [mode, setMode] = useState<'flow' | 'draw'>('flow');
  const [isRecording, setIsRecording] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const boardRef = useRef<HTMLDivElement>(null);
  const ability = useAbility();
  const { track } = useAnalytics();
  
  // Initialize Yjs for collaboration
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  
  useEffect(() => {
    const wsProvider = new WebsocketProvider(
      'ws://localhost:1234',
      `board-${boardId}`,
      ydoc
    );
    setProvider(wsProvider);
    
    // Track board view
    track('board_viewed', { board_id: boardId });
    
    return () => {
      wsProvider.destroy();
    };
  }, [boardId, ydoc, track]);

  // ReactFlow setup
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Add voice recording node
  const addVoiceRecording = async () => {
    if (!ability.can('create', 'Resource')) {
      alert('You do not have permission to add resources');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new RecordRTC(stream, { type: 'audio' });
    
    recorder.startRecording();
    setIsRecording(true);
    
    setTimeout(() => {
      recorder.stopRecording(() => {
        const blob = recorder.getBlob();
        const url = URL.createObjectURL(blob);
        
        const newNode = {
          id: `voice-${Date.now()}`,
          type: 'voiceNote',
          position: { x: 100, y: 100 },
          data: { audioUrl: url, label: 'Voice Note' },
        };
        
        setNodes((nds) => [...nds, newNode]);
        track('voice_note_created', { board_id: boardId });
        setIsRecording(false);
      });
      
      stream.getTracks().forEach(track => track.stop());
    }, 5000); // 5 second recording
  };

  // Export functionality
  const exportBoard = async (format: 'png' | 'pdf') => {
    if (!boardRef.current) return;
    
    track('board_exported', { format, board_id: boardId });
    
    const canvas = await html2canvas(boardRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
    });
    
    if (format === 'png') {
      canvas.toBlob((blob) => {
        if (blob) saveAs(blob, `board-${boardId}.png`);
      });
    } else {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      pdf.save(`board-${boardId}.pdf`);
    }
  };

  // Video player node component
  const VideoNode = ({ data }: { data: any }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
      if (videoRef.current) {
        const player = videojs(videoRef.current, {
          controls: true,
          sources: [{ src: data.url, type: 'video/mp4' }],
        });
        
        return () => player.dispose();
      }
    }, [data.url]);
    
    return (
      <div className="video-node" style={{ width: 320, height: 240 }}>
        <video ref={videoRef} className="video-js vjs-default-skin" />
      </div>
    );
  };

  const nodeTypes = {
    video: VideoNode,
    voiceNote: VoiceNoteNode,
    // ... other node types
  };

  return (
    <div className="integrated-board h-screen flex flex-col">
      {/* Toolbar */}
      <div className="toolbar bg-white shadow-md p-4 flex items-center justify-between">
        <div className="flex gap-2">
          {/* Mode switcher */}
          <button
            onClick={() => setMode('flow')}
            className={`px-4 py-2 rounded ${mode === 'flow' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Nodes
          </button>
          <button
            onClick={() => setMode('draw')}
            className={`px-4 py-2 rounded ${mode === 'draw' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Draw
          </button>
        </div>

        <div className="flex gap-2">
          {/* CASL permission check */}
          <Can I="create" a="Resource">
            <button
              onClick={addVoiceRecording}
              disabled={isRecording}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {isRecording ? 'Recording...' : 'Record Voice'}
            </button>
          </Can>

          <Can I="export" a="Board">
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Export
            </button>
          </Can>
        </div>
      </div>

      {/* Main canvas area */}
      <div ref={boardRef} className="flex-1 relative">
        {mode === 'flow' ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
          >
            {/* Collaboration cursors */}
            {provider && <CollaborationCursors provider={provider} />}
          </ReactFlow>
        ) : (
          <Excalidraw
            onChange={(elements, appState) => {
              // Sync with Yjs
              const yElements = ydoc.getArray('excalidraw-elements');
              yElements.delete(0, yElements.length);
              yElements.insert(0, elements);
            }}
          />
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          onExport={(format) => {
            exportBoard(format);
            setShowExportModal(false);
          }}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* PostHog Session Recording Notice */}
      <SessionRecordingNotice />
    </div>
  );
}

// Voice Note Node Component
function VoiceNoteNode({ data }: { data: any }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="voice-note-node bg-purple-100 p-4 rounded-lg">
      <h4 className="font-medium mb-2">{data.label}</h4>
      <button
        onClick={togglePlay}
        className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <audio ref={audioRef} src={data.audioUrl} onEnded={() => setIsPlaying(false)} />
    </div>
  );
}

// Collaboration Cursors Component
function CollaborationCursors({ provider }: { provider: WebsocketProvider }) {
  const [cursors, setCursors] = useState<Map<number, any>>(new Map());

  useEffect(() => {
    const updateCursors = () => {
      const awareness = provider.awareness;
      const states = awareness.getStates();
      setCursors(new Map(states));
    };

    provider.awareness.on('update', updateCursors);
    updateCursors();

    return () => {
      provider.awareness.off('update', updateCursors);
    };
  }, [provider]);

  return (
    <>
      {Array.from(cursors.entries()).map(([clientId, state]) => {
        if (clientId === provider.awareness.clientID || !state.cursor) return null;
        
        return (
          <div
            key={clientId}
            className="absolute w-4 h-4 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: state.cursor.x,
              top: state.cursor.y,
              backgroundColor: state.user?.color || '#3B82F6',
            }}
          >
            <span className="absolute top-4 left-0 text-xs bg-black text-white px-1 rounded">
              {state.user?.name || 'Anonymous'}
            </span>
          </div>
        );
      })}
    </>
  );
}

// Export Modal Component
function ExportModal({ 
  onExport, 
  onClose 
}: { 
  onExport: (format: 'png' | 'pdf') => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-bold mb-4">Export Board</h2>
        
        <div className="space-y-3">
          <button
            onClick={() => onExport('png')}
            className="w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Export as PNG
          </button>
          
          <button
            onClick={() => onExport('pdf')}
            className="w-full px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Export as PDF
          </button>
        </div>
        
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Session Recording Notice (PostHog)
function SessionRecordingNotice() {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Check if session recording is active
    setIsRecording(posthog.isFeatureEnabled('session-recording'));
  }, []);

  if (!isRecording) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      Session Recording Active
    </div>
  );
}

// Usage in App
export function App() {
  // Initialize PostHog
  useEffect(() => {
    posthog.init('YOUR_POSTHOG_KEY', {
      api_host: 'https://app.posthog.com',
    });
  }, []);

  return (
    <div className="app">
      <IntegratedBoard boardId="board-123" />
    </div>
  );
}

// Integrated store with all features
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface IntegratedStore {
  // Board state
  nodes: any[];
  edges: any[];
  drawings: Record<string, any>;
  
  // Collaboration state
  collaborators: Map<string, any>;
  ydoc: Y.Doc | null;
  
  // Analytics state
  sessionStartTime: number;
  actionsCount: number;
  
  // Actions
  trackAction: (action: string) => void;
  addCollaborator: (id: string, data: any) => void;
}

export const useIntegratedStore = create<IntegratedStore>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      drawings: {},
      collaborators: new Map(),
      ydoc: null,
      sessionStartTime: Date.now(),
      actionsCount: 0,
      
      trackAction: (action) => {
        set((state) => ({ actionsCount: state.actionsCount + 1 }));
        posthog.capture(action, {
          session_duration: Date.now() - get().sessionStartTime,
          total_actions: get().actionsCount,
        });
      },
      
      addCollaborator: (id, data) => {
        set((state) => {
          const newCollaborators = new Map(state.collaborators);
          newCollaborators.set(id, data);
          return { collaborators: newCollaborators };
        });
      },
    }),
    {
      name: 'ragboard-integrated-storage',
    }
  )
);