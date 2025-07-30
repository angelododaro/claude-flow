import React, { useState } from 'react'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import type { NodeProps, AIChatNodeData } from '../../types'

export function AIChatNode({ node, selected, onUpdate, onDelete, onStartConnection, onChat }: NodeProps<AIChatNodeData>) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const newMessage = {
      role: 'user' as const,
      content: input,
      timestamp: new Date(),
    }

    // Update messages
    onUpdate({
      data: {
        ...node.data,
        messages: [...node.data.messages, newMessage],
      },
    })

    setInput('')
    setIsLoading(true)

    try {
      if (onChat) {
        // Use the provided chat handler
        const response = await onChat([...node.data.messages, newMessage])
        
        const aiResponse = {
          role: 'assistant' as const,
          content: response.answer,
          timestamp: new Date(),
          sources: response.sources,
        }

        onUpdate({
          data: {
            ...node.data,
            messages: [...node.data.messages, newMessage, aiResponse],
          },
        })
      } else {
        // Fallback to placeholder
        const aiResponse = {
          role: 'assistant' as const,
          content: 'Please connect to an AI service to enable chat functionality.',
          timestamp: new Date(),
        }

        onUpdate({
          data: {
            ...node.data,
            messages: [...node.data.messages, newMessage, aiResponse],
          },
        })
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorResponse = {
        role: 'assistant' as const,
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }

      onUpdate({
        data: {
          ...node.data,
          messages: [...node.data.messages, newMessage, errorResponse],
        },
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      title={`AI Chat (${node.data.model})`}
      icon={<MessageSquare className="w-4 h-4 text-purple-600" />}
      onDelete={onDelete}
      onResize={(size) => onUpdate({ size })}
      onStartConnection={onStartConnection}
      className="flex flex-col"
    >
      <div className="flex-1 overflow-auto space-y-2 mb-3">
        {node.data.messages.length === 0 ? (
          <p className="text-gray-400 text-sm italic">Start a conversation...</p>
        ) : (
          node.data.messages.map((message, index) => (
            <div
              key={index}
              className={`p-2 rounded-lg text-sm ${
                message.role === 'user'
                  ? 'bg-purple-100 text-purple-900 ml-8'
                  : 'bg-gray-100 text-gray-900 mr-8'
              }`}
            >
              <p className="font-medium text-xs mb-1">
                {message.role === 'user' ? 'You' : 'AI'}
              </p>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">AI is thinking...</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <textarea
          className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={2}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="p-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </BaseNode>
  )
}