import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '../types';
import { ExternalLink, TrendingUp, Eye, Clock, Star } from 'lucide-react';
import { clsx } from 'clsx';

interface TrendingContentData {
  id: string;
  title: string;
  metadata: {
    contentData: {
      id: string;
      title: string;
      description: string;
      url: string;
      platform: 'youtube' | 'twitter' | 'reddit' | 'news' | 'github';
      category: string;
      trending_score: number;
      view_count?: number;
      engagement_count?: number;
      created_at: string;
      thumbnail?: string;
      author: {
        name: string;
        verified?: boolean;
      };
      tags: string[];
    };
  };
  onDelete?: (id: string) => void;
}

export const TrendingContentNode: React.FC<NodeProps<TrendingContentData>> = ({ 
  id, 
  data, 
  selected 
}) => {
  const { contentData } = data.metadata;

  const getPlatformIcon = (platform: string) => {
    const platformMap: Record<string, string> = {
      youtube: '📺',
      twitter: '🐦',
      reddit: '📱',
      news: '📰',
      github: '⚡'
    };
    return platformMap[platform] || '🌐';
  };

  const getPlatformColor = (platform: string) => {
    const colorMap: Record<string, string> = {
      youtube: 'bg-red-500',
      twitter: 'bg-blue-400',
      reddit: 'bg-orange-500',
      news: 'bg-gray-700',
      github: 'bg-gray-800'
    };
    return colorMap[platform] || 'bg-purple-600';
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

  return (
    <div className={clsx(
      'bg-white border-2 rounded-lg shadow-lg p-4 min-w-80 max-w-80',
      selected ? 'border-purple-500' : 'border-gray-200',
      'hover:shadow-xl transition-shadow'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center text-white',
            getPlatformColor(contentData.platform)
          )}>
            <span className="text-sm">{getPlatformIcon(contentData.platform)}</span>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-medium text-sm text-gray-900">
                {contentData.author.name}
              </span>
              {contentData.author.verified && (
                <Star className="w-3 h-3 text-blue-500 fill-current" />
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              {getTimeAgo(contentData.created_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp className="w-3 h-3 text-purple-600" />
            <span className="font-medium text-purple-600">{contentData.trending_score}</span>
          </div>
          {selected && (
            <button
              onClick={handleDelete}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Thumbnail */}
      {contentData.thumbnail && (
        <div className="mb-3 rounded-lg overflow-hidden">
          <img 
            src={contentData.thumbnail} 
            alt={contentData.title}
            className="w-full h-32 object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="space-y-3">
        <div>
          <h3 className="font-medium text-sm line-clamp-2 mb-1">
            {contentData.title}
          </h3>
          <p className="text-xs text-gray-600 line-clamp-3">
            {contentData.description}
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2">
          {contentData.view_count && (
            <div className="bg-gray-50 p-2 rounded text-center">
              <div className="text-xs text-gray-600">Views</div>
              <div className="font-medium text-sm">
                {contentData.view_count.toLocaleString()}
              </div>
            </div>
          )}
          {contentData.engagement_count && (
            <div className="bg-gray-50 p-2 rounded text-center">
              <div className="text-xs text-gray-600">Engagement</div>
              <div className="font-medium text-sm">
                {contentData.engagement_count.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        {contentData.tags && contentData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {contentData.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
              >
                #{tag}
              </span>
            ))}
            {contentData.tags.length > 3 && (
              <span className="text-xs text-gray-500">
                +{contentData.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-gray-500 capitalize">
            {contentData.platform} • {contentData.category}
          </div>
          <a
            href={contentData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-purple-600 hover:text-purple-700 text-xs"
          >
            <ExternalLink className="w-3 h-3" />
            View Original
          </a>
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 border-2 border-white bg-purple-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 border-2 border-white bg-purple-500"
      />
    </div>
  );
};