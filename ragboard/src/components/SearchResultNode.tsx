import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Search, 
  FileText, 
  ExternalLink, 
  Copy, 
  Eye, 
  MoreVertical,
  Star,
  Calendar,
  Hash
} from 'lucide-react';
import { SearchResult } from '../services/searchService';

interface SearchResultNodeData {
  searchResult: SearchResult;
  resourceType: string;
  similarityScore: number;
  chunkIndex?: number;
  originalResourceId?: string;
}

interface SearchResultNodeProps {
  data: SearchResultNodeData;
  selected?: boolean;
}

export const SearchResultNode: React.FC<SearchResultNodeProps> = ({ data, selected }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const { searchResult, similarityScore = 0 } = data;
  const scorePercentage = Math.round(similarityScore * 100);
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-orange-600 bg-orange-50 border-orange-200';
  };

  const getResourceIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      pdf: <FileText className="h-4 w-4 text-red-500" />,
      document: <FileText className="h-4 w-4 text-blue-500" />,
      text: <FileText className="h-4 w-4 text-gray-500" />,
      image: <FileText className="h-4 w-4 text-green-500" />,
      data: <FileText className="h-4 w-4 text-purple-500" />,
      web: <FileText className="h-4 w-4 text-orange-500" />,
      video: <FileText className="h-4 w-4 text-pink-500" />,
      audio: <FileText className="h-4 w-4 text-indigo-500" />
    };
    return icons[type] || <FileText className="h-4 w-4 text-gray-400" />;
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(searchResult.content);
  };

  const handleViewSource = () => {
    // Could open a modal or navigate to the source resource
    console.log('View source:', searchResult.resource_id);
  };

  const title = searchResult.title || 
    (searchResult.resource?.name) || 
    `Search Result: ${searchResult.content.substring(0, 40)}...`;

  const maxContentLength = isExpanded ? 500 : 150;
  const displayContent = searchResult.content.length > maxContentLength 
    ? searchResult.content.substring(0, maxContentLength) + '...'
    : searchResult.content;

  return (
    <div 
      className={`relative bg-white rounded-lg shadow-md border-2 transition-all duration-200 ${
        selected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
      }`}
      style={{ width: 320, minHeight: 180 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Connection Handles */}
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex items-center space-x-2 flex-1">
          <Search className="h-5 w-5 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2" title={title}>
              {title}
            </h3>
          </div>
        </div>

        {/* Score Badge */}
        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getScoreColor(scorePercentage)}`}>
          {scorePercentage}%
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <div className="text-sm text-gray-700 leading-relaxed">
          {displayContent}
          {searchResult.content.length > maxContentLength && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-1 text-blue-600 hover:text-blue-800 font-medium"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              {getResourceIcon(searchResult.resource_type)}
              <span>{searchResult.resource_type}</span>
            </span>
            
            {searchResult.chunk_index !== undefined && (
              <span className="flex items-center space-x-1">
                <Hash className="h-3 w-3" />
                <span>Chunk {searchResult.chunk_index + 1}</span>
              </span>
            )}
          </div>

          {searchResult.created_at && (
            <span className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{new Date(searchResult.created_at).toLocaleDateString()}</span>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="absolute top-2 right-2 flex items-center space-x-1">
          <button
            onClick={handleCopyContent}
            className="p-1.5 bg-white rounded shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Copy content"
          >
            <Copy className="h-3 w-3 text-gray-600" />
          </button>
          
          <button
            onClick={handleViewSource}
            className="p-1.5 bg-white rounded shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
            title="View source"
          >
            <ExternalLink className="h-3 w-3 text-gray-600" />
          </button>

          <button
            className="p-1.5 bg-white rounded shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
            title="More options"
          >
            <MoreVertical className="h-3 w-3 text-gray-600" />
          </button>
        </div>
      )}

      {/* Source Resource Info */}
      {searchResult.resource && (
        <div className="px-4 pb-4">
          <div className="text-xs text-gray-400 border-t border-gray-100 pt-2">
            From: <span className="font-medium text-gray-600">{searchResult.resource.name}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResultNode;