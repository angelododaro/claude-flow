// Y.js-related type definitions
import type { Node, Edge } from '@xyflow/react';

export interface YjsNode extends Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
}

export interface YjsEdge extends Edge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: any;
}