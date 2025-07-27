import type * as React from 'react';
// Import ReactFlow types first
import type { 
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
  Connection as ReactFlowConnection
} from '@xyflow/react';

// Export all our custom types
export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'facebook' | 'twitter' | 'general' | 'web';

export interface ResourceMetadata {
  url?: string;
  duration?: string;
  thumbnail?: string;
  description?: string;
  [key: string]: any;
}

export interface Resource {
  id: string;
  type: 'video | image | text | pdf | url | audio | document | folder | link | frame | annotation | meta-ad | trending-content | shape';
  title: string;
  description?: string;
  url?: string;
  content?: string;
  platform?: Platform;
  metadata?: ResourceMetadata;
  position: { x: number; y: number };
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder extends Resource {
  type: 'folder';
  isExpanded: boolean;
  children: string[];
}

export interface Connection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// Also export as type alias for compatibility
export type ConnectionType = Connection;

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  resourceIds?: string[];
}

export interface AIChat {
  id: string;
  position: { x: number; y: number };
  messages: Message[];
  connectedResources: string[];
  isActive: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface BoardState {
  resources: Map<string, Resource>;
  connections: Connection[];
  aiChats: Map<string, AIChat>;
  selectedResources: Set<string>;
  draggedResource: string | null;
}

// Re-export ReactFlow types with proper names
export type Node = ReactFlowNode;
export type Edge = ReactFlowEdge;
export type FlowConnection = ReactFlowConnection;

// Define NodeProps and EdgeProps for v12 compatibility
export type NodeProps<T = any> = {
  data: T;
  id: string;
  selected?: boolean;
  type?: string;
  xPos: number;
  yPos: number;
  dragging?: boolean;
  zIndex?: number;
};

export type EdgeProps<T = any> = {
  data?: T;
  id: string;
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  selected?: boolean;
  animated?: boolean;
  sourcePosition?: string;
  targetPosition?: string;
};

// NodeTypes and EdgeTypes need to be defined manually for v12
export type NodeTypes = Record<string, React.ComponentType<any>>;
export type EdgeTypes = Record<string, React.ComponentType<ReactFlowEdgeProps>>;

// User and Auth types for CASL
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'owner' | 'collaborator' | 'viewer' | 'guest';
  ownedBoardIds?: string[];
  collaboratorBoardIds?: string[];
  viewerBoardIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}