import { NodeType } from '@ragboard/types'
import { Type, MessageSquare, Image, Video, Mic, FileText, Globe, Folder } from 'lucide-react'
import { 
  TextNode, 
  AIChatNode, 
  ImageNode, 
  VideoNode, 
  AudioNode, 
  DocumentNode, 
  URLNode, 
  FolderNode 
} from './components/nodes'
import { LexicalTextNode } from './components/nodes/LexicalTextNode'
import type { 
  NodeRenderer, 
  TextNodeData, 
  AIChatNodeData, 
  ImageNodeData,
  VideoNodeData,
  AudioNodeData,
  DocumentNodeData,
  URLNodeData,
  FolderNodeData
} from './types'

export const textNodeRenderer: NodeRenderer<TextNodeData> = {
  type: NodeType.TEXT,
  displayName: 'Text',
  icon: Type,
  defaultSize: { width: 400, height: 300 },
  minSize: { width: 250, height: 150 },
  resizable: true,
  component: LexicalTextNode,
  defaultData: () => ({ content: '', format: 'rich' }),
}

export const aiChatNodeRenderer: NodeRenderer<AIChatNodeData> = {
  type: NodeType.AI_CHAT,
  displayName: 'AI Chat',
  icon: MessageSquare,
  defaultSize: { width: 400, height: 500 },
  minSize: { width: 300, height: 300 },
  resizable: true,
  component: AIChatNode,
  defaultData: () => ({ 
    model: 'claude-3-sonnet',
    messages: [],
    temperature: 0.7,
    maxTokens: 1000,
  }),
}

export const imageNodeRenderer: NodeRenderer<ImageNodeData> = {
  type: NodeType.IMAGE,
  displayName: 'Image',
  icon: Image,
  defaultSize: { width: 300, height: 300 },
  minSize: { width: 200, height: 200 },
  resizable: true,
  component: ImageNode,
  defaultData: () => ({ caption: '' }),
}

export const videoNodeRenderer: NodeRenderer<VideoNodeData> = {
  type: NodeType.VIDEO,
  displayName: 'Video',
  icon: Video,
  defaultSize: { width: 400, height: 300 },
  minSize: { width: 300, height: 200 },
  resizable: true,
  component: VideoNode,
  defaultData: () => ({ platform: 'local' }),
}

export const audioNodeRenderer: NodeRenderer<AudioNodeData> = {
  type: NodeType.AUDIO,
  displayName: 'Audio',
  icon: Mic,
  defaultSize: { width: 350, height: 200 },
  minSize: { width: 300, height: 150 },
  resizable: true,
  component: AudioNode,
  defaultData: () => ({}),
}

export const documentNodeRenderer: NodeRenderer<DocumentNodeData> = {
  type: NodeType.DOCUMENT,
  displayName: 'Document',
  icon: FileText,
  defaultSize: { width: 350, height: 400 },
  minSize: { width: 250, height: 300 },
  resizable: true,
  component: DocumentNode,
  defaultData: () => ({ fileType: 'pdf' }),
}

export const urlNodeRenderer: NodeRenderer<URLNodeData> = {
  type: NodeType.URL,
  displayName: 'URL/Website',
  icon: Globe,
  defaultSize: { width: 350, height: 300 },
  minSize: { width: 300, height: 200 },
  resizable: true,
  component: URLNode,
  defaultData: () => ({ url: '' }),
}

export const folderNodeRenderer: NodeRenderer<FolderNodeData> = {
  type: NodeType.FOLDER,
  displayName: 'Folder',
  icon: Folder,
  defaultSize: { width: 400, height: 350 },
  minSize: { width: 300, height: 250 },
  resizable: true,
  component: FolderNode,
  defaultData: () => ({ name: 'New Folder', nodeIds: [], color: '#FEF3C7' }),
}