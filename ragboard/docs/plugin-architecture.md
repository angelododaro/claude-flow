# RAGBOARD Plugin Architecture

## Overview

The RAGBOARD plugin system enables developers to extend the platform's functionality without modifying core code. This document outlines the plugin architecture, APIs, and development guidelines.

## Table of Contents

1. [Plugin System Architecture](#plugin-system-architecture)
2. [Plugin Lifecycle](#plugin-lifecycle)
3. [Extension Points](#extension-points)
4. [Plugin API Reference](#plugin-api-reference)
5. [Plugin Development Guide](#plugin-development-guide)
6. [Plugin Examples](#plugin-examples)
7. [Security Model](#security-model)
8. [Distribution and Installation](#distribution-and-installation)

## Plugin System Architecture

### Core Concepts

```typescript
// Plugin Definition
interface RagboardPlugin {
  // Metadata
  id: string                    // Unique identifier
  name: string                  // Display name
  version: string              // Semver version
  description: string          // Plugin description
  author: string              // Author name
  license?: string            // License type
  repository?: string         // Source repository
  
  // Compatibility
  minRagboardVersion: string   // Minimum RAGBOARD version
  maxRagboardVersion?: string  // Maximum RAGBOARD version
  
  // Dependencies
  dependencies?: PluginDependency[]
  
  // Lifecycle hooks
  onInstall?: (context: PluginContext) => Promise<void>
  onActivate: (context: PluginContext) => Promise<void>
  onDeactivate?: () => Promise<void>
  onUninstall?: () => Promise<void>
  
  // Extension contributions
  contributes?: PluginContributions
}

// Plugin Contributions
interface PluginContributions {
  // UI Extensions
  nodeTypes?: NodeTypeContribution[]
  toolbar?: ToolbarContribution[]
  panels?: PanelContribution[]
  themes?: ThemeContribution[]
  shortcuts?: ShortcutContribution[]
  
  // Functionality Extensions
  commands?: CommandContribution[]
  processors?: ProcessorContribution[]
  aiModels?: AIModelContribution[]
  storageProviders?: StorageProviderContribution[]
  
  // Integration Extensions
  webhooks?: WebhookContribution[]
  apiEndpoints?: APIEndpointContribution[]
}
```

### Plugin Loading Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RAGBOARD Core                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐     ┌─────────────────┐             │
│  │  Plugin Manager │     │  Plugin Registry │             │
│  │                 │────▶│                 │             │
│  │  • Discovery    │     │  • Registration │             │
│  │  • Loading      │     │  • Validation   │             │
│  │  • Lifecycle    │     │  • Dependencies │             │
│  └────────┬────────┘     └─────────────────┘             │
│           │                                                │
│           ▼                                                │
│  ┌─────────────────┐     ┌─────────────────┐             │
│  │ Plugin Sandbox  │     │  Plugin Context │             │
│  │                 │────▶│                 │             │
│  │  • Isolation    │     │  • APIs         │             │
│  │  • Security     │     │  • Services     │             │
│  │  • Resources    │     │  • Events       │             │
│  └─────────────────┘     └─────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Plugins                              │
├─────────────────┬─────────────────┬────────────────────────┤
│   Custom Node   │   AI Provider   │   Storage Provider     │
│     Plugin      │     Plugin      │       Plugin           │
└─────────────────┴─────────────────┴────────────────────────┘
```

## Plugin Lifecycle

### 1. Discovery Phase

```typescript
class PluginDiscovery {
  private pluginPaths = [
    './plugins',                    // Local plugins
    '~/.ragboard/plugins',         // User plugins
    '/usr/share/ragboard/plugins'  // System plugins
  ]
  
  async discoverPlugins(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = []
    
    for (const path of this.pluginPaths) {
      const plugins = await this.scanDirectory(path)
      manifests.push(...plugins)
    }
    
    return this.validateManifests(manifests)
  }
  
  private async scanDirectory(path: string): Promise<PluginManifest[]> {
    const entries = await fs.readdir(path)
    const manifests: PluginManifest[] = []
    
    for (const entry of entries) {
      const manifestPath = path.join(entry, 'plugin.json')
      if (await fs.exists(manifestPath)) {
        const manifest = await this.loadManifest(manifestPath)
        manifests.push(manifest)
      }
    }
    
    return manifests
  }
}
```

### 2. Installation Phase

```typescript
class PluginInstaller {
  async install(plugin: PluginPackage): Promise<void> {
    // 1. Validate plugin package
    await this.validatePackage(plugin)
    
    // 2. Check dependencies
    await this.checkDependencies(plugin)
    
    // 3. Extract to plugins directory
    await this.extractPlugin(plugin)
    
    // 4. Run install hook
    if (plugin.onInstall) {
      await plugin.onInstall(this.createContext())
    }
    
    // 5. Register plugin
    await this.registry.register(plugin)
    
    // 6. Persist installation
    await this.saveInstallationData(plugin)
  }
  
  private async checkDependencies(plugin: PluginPackage): Promise<void> {
    // Check RAGBOARD version compatibility
    if (!this.isVersionCompatible(plugin)) {
      throw new IncompatibleVersionError()
    }
    
    // Check plugin dependencies
    for (const dep of plugin.dependencies || []) {
      const installed = await this.registry.getPlugin(dep.id)
      if (!installed || !semver.satisfies(installed.version, dep.version)) {
        throw new MissingDependencyError(dep)
      }
    }
  }
}
```

### 3. Activation Phase

```typescript
class PluginActivator {
  async activate(pluginId: string): Promise<void> {
    const plugin = await this.loader.loadPlugin(pluginId)
    
    // Create sandboxed context
    const context = this.createPluginContext(plugin)
    
    // Activate plugin
    await plugin.onActivate(context)
    
    // Register contributions
    await this.registerContributions(plugin)
    
    // Mark as active
    this.activePlugins.set(pluginId, plugin)
    
    // Emit activation event
    this.eventBus.emit('plugin:activated', { pluginId })
  }
  
  private createPluginContext(plugin: Plugin): PluginContext {
    return {
      // Core APIs
      logger: this.createLogger(plugin.id),
      storage: this.createStorage(plugin.id),
      
      // Service access
      services: {
        board: this.createBoardService(plugin),
        node: this.createNodeService(plugin),
        ai: this.createAIService(plugin),
        storage: this.createStorageService(plugin)
      },
      
      // UI integration
      ui: {
        registerComponent: (name, component) => 
          this.componentRegistry.register(plugin.id, name, component),
        showNotification: (message, type) =>
          this.notificationService.show(message, type),
        openModal: (component, props) =>
          this.modalService.open(component, props)
      },
      
      // Event system
      events: {
        on: (event, handler) => 
          this.eventBus.on(event, handler, plugin.id),
        emit: (event, data) =>
          this.eventBus.emit(event, data, plugin.id),
        off: (event, handler) =>
          this.eventBus.off(event, handler)
      }
    }
  }
}
```

### 4. Runtime Phase

```typescript
class PluginRuntime {
  // Handle plugin commands
  async executeCommand(commandId: string, ...args: any[]): Promise<any> {
    const [pluginId, command] = commandId.split('.')
    const plugin = this.activePlugins.get(pluginId)
    
    if (!plugin) {
      throw new PluginNotActiveError(pluginId)
    }
    
    const handler = plugin.commands?.[command]
    if (!handler) {
      throw new CommandNotFoundError(commandId)
    }
    
    // Execute in sandbox
    return await this.sandbox.execute(plugin, () => handler(...args))
  }
  
  // Handle plugin events
  private setupEventHandlers(plugin: Plugin): void {
    // Board events
    this.eventBus.on('board:created', async (board) => {
      if (plugin.onBoardCreated) {
        await this.sandbox.execute(plugin, () => 
          plugin.onBoardCreated!(board)
        )
      }
    })
    
    // Node events
    this.eventBus.on('node:created', async (node) => {
      if (plugin.onNodeCreated) {
        await this.sandbox.execute(plugin, () =>
          plugin.onNodeCreated!(node)
        )
      }
    })
  }
}
```

### 5. Deactivation Phase

```typescript
class PluginDeactivator {
  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.activePlugins.get(pluginId)
    if (!plugin) return
    
    // Call deactivation hook
    if (plugin.onDeactivate) {
      await plugin.onDeactivate()
    }
    
    // Unregister contributions
    await this.unregisterContributions(plugin)
    
    // Clean up event handlers
    this.eventBus.removeAllListeners(pluginId)
    
    // Remove from active plugins
    this.activePlugins.delete(pluginId)
    
    // Emit deactivation event
    this.eventBus.emit('plugin:deactivated', { pluginId })
  }
}
```

## Extension Points

### 1. Node Types

```typescript
interface NodeTypeContribution {
  type: string                          // Unique node type ID
  displayName: string                   // Display name
  description: string                   // Description
  icon: string | ComponentType         // Icon or component
  category: NodeCategory               // Category for grouping
  
  // Component
  component: ComponentType<NodeProps>   // React component
  
  // Configuration
  defaultSize?: Size                    // Default dimensions
  resizable?: boolean                   // Can be resized
  minSize?: Size                       // Minimum size
  maxSize?: Size                       // Maximum size
  
  // Ports for connections
  ports?: {
    inputs?: PortDefinition[]
    outputs?: PortDefinition[]
  }
  
  // Data schema
  dataSchema?: JSONSchema              // JSON Schema for validation
  
  // Handlers
  onCreate?: (data: any) => any        // Initialize node data
  onUpdate?: (oldData: any, newData: any) => any
  onDelete?: (node: Node) => void
  
  // Serialization
  serialize?: (node: Node) => any
  deserialize?: (data: any) => Node
}

// Example: Code Editor Node
const codeEditorNode: NodeTypeContribution = {
  type: 'code-editor',
  displayName: 'Code Editor',
  description: 'A syntax-highlighted code editor',
  icon: CodeIcon,
  category: NodeCategory.Development,
  
  component: CodeEditorComponent,
  
  defaultSize: { width: 600, height: 400 },
  resizable: true,
  minSize: { width: 300, height: 200 },
  
  ports: {
    inputs: [{
      id: 'source',
      type: 'text',
      label: 'Source Code'
    }],
    outputs: [{
      id: 'compiled',
      type: 'text',
      label: 'Compiled Output'
    }, {
      id: 'ast',
      type: 'object',
      label: 'AST'
    }]
  },
  
  dataSchema: {
    type: 'object',
    properties: {
      language: { type: 'string', enum: ['javascript', 'typescript', 'python'] },
      code: { type: 'string' },
      theme: { type: 'string', enum: ['light', 'dark'] }
    },
    required: ['language', 'code']
  },
  
  onCreate: () => ({
    language: 'javascript',
    code: '// Enter your code here',
    theme: 'dark'
  })
}
```

### 2. Toolbar Items

```typescript
interface ToolbarContribution {
  id: string                           // Unique toolbar item ID
  label: string                        // Display label
  icon: string | ComponentType        // Icon
  tooltip?: string                     // Tooltip text
  
  // Placement
  section: 'primary' | 'secondary' | 'tools'
  position?: number                    // Order within section
  
  // Behavior
  onClick?: () => void                // Click handler
  component?: ComponentType           // Custom component
  
  // Visibility
  when?: ContextExpression           // Conditional visibility
  
  // Submenu
  submenu?: ToolbarContribution[]     // Nested items
}

// Example: Export Tools
const exportTools: ToolbarContribution = {
  id: 'export-tools',
  label: 'Export',
  icon: ExportIcon,
  tooltip: 'Export board in various formats',
  section: 'secondary',
  
  submenu: [{
    id: 'export-pdf',
    label: 'Export as PDF',
    icon: PdfIcon,
    onClick: () => commands.execute('export.pdf')
  }, {
    id: 'export-png',
    label: 'Export as PNG',
    icon: ImageIcon,
    onClick: () => commands.execute('export.png')
  }, {
    id: 'export-json',
    label: 'Export as JSON',
    icon: JsonIcon,
    onClick: () => commands.execute('export.json')
  }]
}
```

### 3. Commands

```typescript
interface CommandContribution {
  id: string                          // Command ID
  title: string                       // Display title
  category?: string                   // Category for grouping
  
  // Handler
  handler: (...args: any[]) => any | Promise<any>
  
  // Keyboard shortcut
  keybinding?: {
    key: string                       // e.g., 'ctrl+shift+p'
    when?: ContextExpression         // Conditional activation
  }
  
  // UI integration
  icon?: string | ComponentType      // Icon
  enablement?: ContextExpression     // When enabled
  
  // Parameters
  args?: CommandParameter[]          // Parameter definitions
}

// Example: Create Template Command
const createTemplateCommand: CommandContribution = {
  id: 'template.create',
  title: 'Create from Template',
  category: 'Templates',
  
  handler: async (templateId: string) => {
    const template = await templateService.getTemplate(templateId)
    const board = await boardService.createFromTemplate(template)
    await navigation.navigateToBoard(board.id)
  },
  
  keybinding: {
    key: 'ctrl+shift+t',
    when: 'boardView.active'
  },
  
  args: [{
    name: 'templateId',
    type: 'string',
    description: 'Template identifier'
  }]
}
```

### 4. AI Model Providers

```typescript
interface AIModelContribution {
  id: string                         // Provider ID
  name: string                       // Display name
  description: string                // Description
  
  // Models
  models: AIModelDefinition[]        // Available models
  
  // Implementation
  provider: AIProvider               // Provider implementation
  
  // Configuration
  configSchema?: JSONSchema          // Config schema
  defaultConfig?: any               // Default configuration
}

// AI Provider Interface
interface AIProvider {
  // Initialize with config
  initialize(config: any): Promise<void>
  
  // Generate completion
  complete(request: CompletionRequest): Promise<CompletionResponse>
  
  // Stream completion
  streamComplete(
    request: CompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<void>
  
  // Generate embeddings
  embed(text: string): Promise<number[]>
  
  // Health check
  healthCheck(): Promise<boolean>
}

// Example: Local LLM Provider
const localLLMProvider: AIModelContribution = {
  id: 'local-llm',
  name: 'Local LLM',
  description: 'Run language models locally',
  
  models: [{
    id: 'llama-7b',
    name: 'LLaMA 7B',
    contextLength: 2048,
    capabilities: ['completion', 'embedding']
  }],
  
  provider: new LocalLLMProvider(),
  
  configSchema: {
    type: 'object',
    properties: {
      modelPath: { type: 'string' },
      device: { type: 'string', enum: ['cpu', 'cuda'] },
      threads: { type: 'number', minimum: 1 }
    }
  }
}
```

### 5. Storage Providers

```typescript
interface StorageProviderContribution {
  id: string                          // Provider ID
  name: string                        // Display name
  description: string                 // Description
  
  // Implementation
  provider: StorageProvider           // Provider implementation
  
  // Configuration
  configSchema?: JSONSchema           // Config schema
  
  // Features
  features: StorageFeature[]          // Supported features
}

// Storage Provider Interface
interface StorageProvider {
  // Initialize
  initialize(config: any): Promise<void>
  
  // File operations
  upload(file: File, path: string): Promise<FileReference>
  download(reference: FileReference): Promise<File>
  delete(reference: FileReference): Promise<void>
  
  // URL generation
  getUrl(reference: FileReference): Promise<string>
  getPresignedUrl(reference: FileReference, expires: number): Promise<string>
  
  // Metadata
  getMetadata(reference: FileReference): Promise<FileMetadata>
  
  // Directory operations
  list(path: string): Promise<FileReference[]>
  createDirectory(path: string): Promise<void>
}

// Example: IPFS Storage Provider
const ipfsStorageProvider: StorageProviderContribution = {
  id: 'ipfs',
  name: 'IPFS Storage',
  description: 'Decentralized storage using IPFS',
  
  provider: new IPFSStorageProvider(),
  
  configSchema: {
    type: 'object',
    properties: {
      apiUrl: { type: 'string', format: 'uri' },
      gateway: { type: 'string', format: 'uri' }
    }
  },
  
  features: [
    StorageFeature.Immutable,
    StorageFeature.Distributed,
    StorageFeature.ContentAddressed
  ]
}
```

## Plugin API Reference

### Core APIs

```typescript
interface PluginContext {
  // Plugin information
  plugin: {
    id: string
    version: string
    directory: string
  }
  
  // Logging
  logger: Logger
  
  // Storage
  storage: PluginStorage
  
  // Configuration
  config: PluginConfig
  
  // Services
  services: PluginServices
  
  // UI integration
  ui: UIIntegration
  
  // Events
  events: EventSystem
  
  // Utilities
  utils: PluginUtilities
}
```

### Storage API

```typescript
interface PluginStorage {
  // Key-value storage
  get(key: string): Promise<any>
  set(key: string, value: any): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  
  // File storage
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  listFiles(pattern?: string): Promise<string[]>
  
  // Binary storage
  readBinary(path: string): Promise<Buffer>
  writeBinary(path: string, buffer: Buffer): Promise<void>
}
```

### Service APIs

```typescript
interface PluginServices {
  // Board service
  board: {
    getCurrent(): Promise<Board | null>
    getById(id: string): Promise<Board>
    create(data: CreateBoardData): Promise<Board>
    update(id: string, data: UpdateBoardData): Promise<Board>
    delete(id: string): Promise<void>
  }
  
  // Node service
  node: {
    create(data: CreateNodeData): Promise<Node>
    update(id: string, data: UpdateNodeData): Promise<Node>
    delete(id: string): Promise<void>
    getConnected(id: string): Promise<Node[]>
    findByType(type: string): Promise<Node[]>
  }
  
  // AI service
  ai: {
    complete(prompt: string, options?: CompletionOptions): Promise<string>
    embed(text: string): Promise<number[]>
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>
  }
  
  // User service
  user: {
    getCurrent(): Promise<User>
    getPreferences(): Promise<UserPreferences>
    setPreference(key: string, value: any): Promise<void>
  }
}
```

### UI Integration API

```typescript
interface UIIntegration {
  // Component registration
  registerComponent(name: string, component: ComponentType): void
  
  // Modal management
  showModal(component: ComponentType, props?: any): Promise<any>
  closeModal(modalId: string): void
  
  // Notifications
  showNotification(message: string, type?: NotificationType): void
  showProgress(message: string, progress?: number): ProgressHandle
  
  // Menus
  registerMenuItem(menu: MenuType, item: MenuItem): void
  registerContextMenu(selector: string, items: MenuItem[]): void
  
  // Panels
  registerPanel(panel: PanelDefinition): void
  showPanel(panelId: string): void
  hidePanel(panelId: string): void
  
  // Themes
  registerTheme(theme: ThemeDefinition): void
  setTheme(themeId: string): void
}
```

## Plugin Development Guide

### 1. Project Structure

```
my-plugin/
├── plugin.json              # Plugin manifest
├── package.json            # NPM package
├── README.md              # Documentation
├── LICENSE                # License file
├── src/
│   ├── index.ts          # Main entry point
│   ├── components/       # React components
│   ├── services/         # Service implementations
│   └── utils/           # Utilities
├── assets/
│   ├── icons/           # Icon files
│   └── styles/          # CSS/SCSS files
└── tests/               # Test files
```

### 2. Plugin Manifest

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Adds awesome features to RAGBOARD",
  "author": "John Doe",
  "license": "MIT",
  "repository": "https://github.com/user/my-awesome-plugin",
  
  "minRagboardVersion": "2.0.0",
  "maxRagboardVersion": "3.0.0",
  
  "main": "dist/index.js",
  "style": "dist/styles.css",
  
  "dependencies": [
    {
      "id": "another-plugin",
      "version": "^1.0.0"
    }
  ],
  
  "contributes": {
    "nodeTypes": [
      {
        "type": "awesome-node",
        "displayName": "Awesome Node",
        "category": "custom"
      }
    ],
    "commands": [
      {
        "id": "doAwesomeThing",
        "title": "Do Awesome Thing"
      }
    ]
  },
  
  "activationEvents": [
    "onBoard:*",
    "onCommand:doAwesomeThing"
  ]
}
```

### 3. Main Entry Point

```typescript
// src/index.ts
import { RagboardPlugin, PluginContext } from '@ragboard/plugin-api'
import { AwesomeNode } from './components/AwesomeNode'
import { AwesomeService } from './services/AwesomeService'

export default class MyAwesomePlugin implements RagboardPlugin {
  private context!: PluginContext
  private service!: AwesomeService
  
  async onActivate(context: PluginContext): Promise<void> {
    this.context = context
    this.service = new AwesomeService(context)
    
    // Register node type
    context.ui.registerComponent('awesome-node', AwesomeNode)
    
    // Register commands
    context.commands.register('doAwesomeThing', () => {
      this.doAwesomeThing()
    })
    
    // Listen to events
    context.events.on('board:created', this.onBoardCreated.bind(this))
    
    // Add toolbar item
    context.ui.registerToolbarItem({
      id: 'awesome-button',
      label: 'Awesome',
      icon: 'awesome-icon',
      onClick: () => this.doAwesomeThing()
    })
    
    context.logger.info('My Awesome Plugin activated!')
  }
  
  async onDeactivate(): Promise<void> {
    // Cleanup
    this.service.dispose()
    this.context.logger.info('My Awesome Plugin deactivated')
  }
  
  private async doAwesomeThing(): Promise<void> {
    const board = await this.context.services.board.getCurrent()
    if (!board) {
      this.context.ui.showNotification('No board open', 'warning')
      return
    }
    
    // Do something awesome
    const result = await this.service.processBoard(board)
    this.context.ui.showNotification(`Processed ${result.count} nodes!`, 'success')
  }
  
  private async onBoardCreated(board: Board): Promise<void> {
    // React to board creation
    await this.service.initializeBoard(board)
  }
}
```

### 4. Custom Node Component

```typescript
// src/components/AwesomeNode.tsx
import React, { useState, useEffect } from 'react'
import { NodeProps } from '@ragboard/plugin-api'
import { Handle, Position } from 'reactflow'

export const AwesomeNode: React.FC<NodeProps> = ({ 
  id, 
  data, 
  selected,
  onUpdate 
}) => {
  const [value, setValue] = useState(data.value || '')
  
  useEffect(() => {
    // Process value when it changes
    if (data.autoProcess) {
      processValue(value)
    }
  }, [value])
  
  const processValue = async (val: string) => {
    // Do something with the value
    const processed = await api.process(val)
    onUpdate({ ...data, processed })
  }
  
  return (
    <div className={`awesome-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      
      <div className="node-header">
        <h3>Awesome Node</h3>
      </div>
      
      <div className="node-content">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter something awesome"
        />
        
        {data.processed && (
          <div className="processed-result">
            {data.processed}
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
```

### 5. Testing

```typescript
// tests/plugin.test.ts
import { createTestContext } from '@ragboard/plugin-test-utils'
import MyAwesomePlugin from '../src'

describe('My Awesome Plugin', () => {
  let plugin: MyAwesomePlugin
  let context: PluginContext
  
  beforeEach(async () => {
    context = createTestContext()
    plugin = new MyAwesomePlugin()
    await plugin.onActivate(context)
  })
  
  afterEach(async () => {
    await plugin.onDeactivate()
  })
  
  it('should register node type', () => {
    const nodeType = context.contributions.nodeTypes.get('awesome-node')
    expect(nodeType).toBeDefined()
    expect(nodeType.displayName).toBe('Awesome Node')
  })
  
  it('should process board', async () => {
    const board = await context.services.board.create({
      name: 'Test Board'
    })
    
    await context.commands.execute('doAwesomeThing')
    
    expect(context.ui.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('Processed'),
        type: 'success'
      })
    )
  })
})
```

## Plugin Examples

### 1. Markdown Preview Plugin

```typescript
export default class MarkdownPreviewPlugin implements RagboardPlugin {
  async onActivate(context: PluginContext): Promise<void> {
    // Register markdown node type
    context.contributions.nodeTypes.register({
      type: 'markdown-preview',
      displayName: 'Markdown Preview',
      component: MarkdownPreviewNode,
      ports: {
        inputs: [{ id: 'markdown', type: 'text' }],
        outputs: [{ id: 'html', type: 'text' }]
      }
    })
    
    // Add conversion command
    context.commands.register('markdown.preview', async () => {
      const selected = await context.services.node.getSelected()
      for (const node of selected) {
        if (node.type === 'text') {
          await context.services.node.create({
            type: 'markdown-preview',
            position: { 
              x: node.position.x + 350, 
              y: node.position.y 
            },
            data: { markdown: node.data.content }
          })
        }
      }
    })
  }
}
```

### 2. GitHub Integration Plugin

```typescript
export default class GitHubPlugin implements RagboardPlugin {
  async onActivate(context: PluginContext): Promise<void> {
    // Register GitHub issue node
    context.contributions.nodeTypes.register({
      type: 'github-issue',
      displayName: 'GitHub Issue',
      component: GitHubIssueNode,
      dataSchema: {
        type: 'object',
        properties: {
          repository: { type: 'string' },
          issueNumber: { type: 'number' }
        }
      }
    })
    
    // Add import command
    context.commands.register('github.importIssues', async () => {
      const repo = await context.ui.prompt('Enter repository (owner/name):')
      const issues = await this.fetchIssues(repo)
      
      const board = await context.services.board.getCurrent()
      for (const issue of issues) {
        await context.services.node.create({
          boardId: board.id,
          type: 'github-issue',
          data: {
            repository: repo,
            issueNumber: issue.number,
            title: issue.title,
            body: issue.body
          }
        })
      }
    })
  }
}
```

### 3. Data Visualization Plugin

```typescript
export default class DataVizPlugin implements RagboardPlugin {
  async onActivate(context: PluginContext): Promise<void> {
    // Register chart nodes
    const chartTypes = ['bar', 'line', 'pie', 'scatter']
    
    for (const type of chartTypes) {
      context.contributions.nodeTypes.register({
        type: `chart-${type}`,
        displayName: `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`,
        component: ChartNode,
        ports: {
          inputs: [{ id: 'data', type: 'json' }]
        },
        defaultData: {
          chartType: type,
          options: this.getDefaultOptions(type)
        }
      })
    }
    
    // Add data processing
    context.services.processor.register('csv-to-chart', {
      inputTypes: ['text/csv'],
      outputType: 'application/json',
      process: async (input) => {
        const parsed = await csv.parse(input)
        return this.transformToChartData(parsed)
      }
    })
  }
}
```

## Security Model

### Plugin Sandboxing

```typescript
class PluginSandbox {
  private vm: VM
  private permissions: PluginPermissions
  
  constructor(plugin: Plugin) {
    this.vm = new VM({
      timeout: 5000,
      sandbox: this.createSandbox(plugin)
    })
    
    this.permissions = this.loadPermissions(plugin)
  }
  
  async execute<T>(fn: Function, ...args: any[]): Promise<T> {
    // Check permissions
    this.checkPermissions(fn)
    
    // Execute in sandbox
    return await this.vm.run(fn, ...args)
  }
  
  private createSandbox(plugin: Plugin): any {
    return {
      // Safe globals
      console: this.createSafeConsole(plugin),
      setTimeout: this.createSafeTimer(setTimeout),
      setInterval: this.createSafeTimer(setInterval),
      
      // Plugin APIs
      ragboard: this.createSafeAPI(plugin),
      
      // Blocked
      process: undefined,
      require: undefined,
      __dirname: undefined,
      __filename: undefined
    }
  }
}
```

### Permission System

```typescript
interface PluginPermissions {
  // API access
  api: {
    boards: 'read' | 'write' | 'none'
    nodes: 'read' | 'write' | 'none'
    ai: 'allowed' | 'none'
    storage: 'allowed' | 'none'
  }
  
  // Resource limits
  limits: {
    memory: number        // MB
    cpu: number          // Percentage
    storage: number      // MB
    apiCalls: number     // Per minute
  }
  
  // Network access
  network: {
    allowed: boolean
    domains?: string[]   // Whitelist
  }
}

// Default permissions
const defaultPermissions: PluginPermissions = {
  api: {
    boards: 'read',
    nodes: 'read',
    ai: 'none',
    storage: 'none'
  },
  limits: {
    memory: 50,
    cpu: 10,
    storage: 10,
    apiCalls: 60
  },
  network: {
    allowed: false
  }
}
```

## Distribution and Installation

### Plugin Package Format

```
my-plugin.ragboard
├── manifest.json       # Plugin manifest
├── dist/              # Compiled code
│   ├── index.js      # Main bundle
│   └── styles.css    # Styles
├── assets/           # Static assets
├── README.md         # Documentation
└── LICENSE          # License file
```

### Publishing

```bash
# Build plugin
npm run build

# Package plugin
ragboard plugin pack

# Publish to registry
ragboard plugin publish --registry https://plugins.ragboard.com
```

### Installation Methods

1. **From Registry:**
```bash
ragboard plugin install my-awesome-plugin
```

2. **From File:**
```bash
ragboard plugin install ./my-plugin.ragboard
```

3. **From URL:**
```bash
ragboard plugin install https://example.com/my-plugin.ragboard
```

4. **From Git:**
```bash
ragboard plugin install git+https://github.com/user/my-plugin.git
```

### Plugin Store Integration

```typescript
interface PluginStoreEntry {
  id: string
  name: string
  description: string
  author: {
    name: string
    email?: string
    url?: string
  }
  version: string
  downloads: number
  rating: number
  reviews: number
  tags: string[]
  screenshots: string[]
  readme: string
  changelog: string
  
  compatibility: {
    minVersion: string
    maxVersion?: string
    platforms?: Platform[]
  }
  
  pricing?: {
    model: 'free' | 'paid' | 'freemium'
    price?: number
    currency?: string
  }
}
```

This plugin architecture provides a robust, secure, and extensible system for third-party developers to enhance RAGBOARD's functionality while maintaining system integrity and user safety.