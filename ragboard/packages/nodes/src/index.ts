// Export types
export * from './types'

// Export registry
export { nodeRegistry } from './registry'

// Export components
export { BaseNode } from './components/BaseNode'
export * from './components/nodes'

// Export renderers
export * from './renderers'

// Initialize default renderers
import { nodeRegistry } from './registry'
import {
  textNodeRenderer,
  aiChatNodeRenderer,
  imageNodeRenderer,
  videoNodeRenderer,
  audioNodeRenderer,
  documentNodeRenderer,
  urlNodeRenderer,
  folderNodeRenderer,
} from './renderers'

// Register all node types
nodeRegistry.register(textNodeRenderer)
nodeRegistry.register(aiChatNodeRenderer)
nodeRegistry.register(imageNodeRenderer)
nodeRegistry.register(videoNodeRenderer)
nodeRegistry.register(audioNodeRenderer)
nodeRegistry.register(documentNodeRenderer)
nodeRegistry.register(urlNodeRenderer)
nodeRegistry.register(folderNodeRenderer)