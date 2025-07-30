import React, { useState, useCallback } from 'react'
import { Globe, Loader2, RefreshCw, ExternalLink, X } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import type { NodeProps, URLNodeData } from '../../types'

export function URLNode({ 
  node, 
  selected, 
  onUpdate, 
  onDelete, 
  onStartConnection,
  onScrapeURL
}: NodeProps<URLNodeData> & {
  onScrapeURL?: (url: string) => Promise<{
    title: string
    description: string
    content: string
    image?: string
  }>
}) {
  const [url, setUrl] = useState(node.data.url || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValidURL = (urlString: string) => {
    try {
      new URL(urlString)
      return true
    } catch {
      return false
    }
  }

  const handleScrape = useCallback(async () => {
    if (!url || !isValidURL(url)) {
      setError('Please enter a valid URL')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (onScrapeURL) {
        const result = await onScrapeURL(url)
        onUpdate({
          data: {
            ...node.data,
            url,
            title: result.title,
            description: result.description,
            extractedContent: result.content,
            image: result.image,
            scrapedAt: new Date(),
          },
        })
      } else {
        // Fallback if no scraper provided
        onUpdate({
          data: {
            ...node.data,
            url,
            title: new URL(url).hostname,
          },
        })
      }
    } catch (err) {
      setError('Failed to fetch URL content')
      console.error('Scraping error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [url, node.data, onUpdate, onScrapeURL])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleScrape()
    }
  }

  const clearURL = () => {
    setUrl('')
    onUpdate({
      data: {
        url: '',
        title: undefined,
        description: undefined,
        extractedContent: undefined,
        image: undefined,
      },
    })
  }

  const formatDomain = (urlString: string) => {
    try {
      const url = new URL(urlString)
      return url.hostname.replace('www.', '')
    } catch {
      return urlString
    }
  }

  return (
    <BaseNode
      node={node}
      selected={selected}
      title="URL/Website"
      icon={<Globe className="w-4 h-4 text-green-600" />}
      onDelete={onDelete}
      onResize={(size) => onUpdate({ size })}
      onStartConnection={onStartConnection}
    >
      <div className="space-y-3">
        {/* URL Input */}
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="https://example.com"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isLoading}
          />
          <button
            onClick={handleScrape}
            disabled={isLoading || !url}
            className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Fetch content"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        {/* Content Preview */}
        {node.data.title && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 line-clamp-2">
                  {node.data.title}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDomain(node.data.url)}
                </p>
              </div>
              <div className="flex gap-1">
                <a
                  href={node.data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </a>
                <button
                  onClick={clearURL}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Clear URL"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Image */}
            {node.data.image && (
              <img
                src={node.data.image}
                alt={node.data.title}
                className="w-full h-32 object-cover rounded-md"
              />
            )}

            {/* Description */}
            {node.data.description && (
              <p className="text-xs text-gray-600 line-clamp-3">
                {node.data.description}
              </p>
            )}

            {/* Content Preview */}
            {node.data.extractedContent && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-600 line-clamp-4">
                  {node.data.extractedContent}
                </p>
              </div>
            )}

            {/* Status */}
            {node.data.scrapedAt && (
              <p className="text-xs text-gray-500 text-center pt-2">
                Last updated: {new Date(node.data.scrapedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Indexed Status */}
        {node.data.extractedContent && (
          <p className="text-xs text-green-600 text-center">
            ✓ Content indexed for search
          </p>
        )}
      </div>
    </BaseNode>
  )
}