import { NodeType } from '@ragboard/types'
import type { BaseNodeData, NodeRenderer, NodeRegistryInterface } from './types'
import { v4 as uuidv4 } from 'uuid'

class NodeRegistry implements NodeRegistryInterface {
  private renderers = new Map<NodeType, NodeRenderer>()

  register<T>(renderer: NodeRenderer<T>): void {
    this.renderers.set(renderer.type, renderer as NodeRenderer)
  }

  unregister(type: NodeType): void {
    this.renderers.delete(type)
  }

  get(type: NodeType): NodeRenderer | undefined {
    return this.renderers.get(type)
  }

  getAll(): NodeRenderer[] {
    return Array.from(this.renderers.values())
  }

  create<T>(type: NodeType, position: Position, boardId: string): BaseNodeData & { data: T } {
    const renderer = this.get(type)
    if (!renderer) {
      throw new Error(`No renderer registered for node type: ${type}`)
    }

    return {
      id: uuidv4(),
      type,
      position,
      size: { ...renderer.defaultSize },
      boardId,
      data: renderer.defaultData() as T,
    }
  }
}

// Singleton instance
export const nodeRegistry = new NodeRegistry()