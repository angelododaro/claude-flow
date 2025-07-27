import React, { useState } from 'react';
import { FileText, ExternalLink, Download, Eye, Filter, Calendar, Hash, Zap } from 'lucide-react';
import { SearchResult } from '../services/searchService';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  onResultClick?: (result: SearchResult) => void;
  onViewContent?: (result: SearchResult) => void;
  onDownload?: (result: SearchResult) => void;
  className?: string;
  showStats?: boolean;
  loading?: boolean;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  query,
  onResultClick,
  onViewContent,
  onDownload,
  className = "",
  showStats = true,
  loading = false
}) => {
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'type'>('relevance');
  const [filterType, setFilterType] = useState<string>('all');

  // Get unique resource types for filtering
  const resourceTypes = Array.from(new Set(results.map(r => r.resource_type))).filter(Boolean);

  // Filter and sort results
  const filteredResults = results
    .filter(result => filterType === 'all' || result.resource_type === filterType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
        case 'type':
          return (a.resource_type || '').localeCompare(b.resource_type || '');
        case 'relevance':
        default:
          return (b.similarity_score || 0) - (a.similarity_score || 0);
      }
    });

  const highlightText = (text: string, highlight: string) => {
    if (!highlight) return text;
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === highlight.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">{part}</mark>
      ) : part
    );
  };

  const getResourceIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      pdf: <FileText className="h-5 w-5 text-red-500" />,
      document: <FileText className="h-5 w-5 text-blue-500" />,
      text: <FileText className="h-5 w-5 text-gray-500" />,
      image: <FileText className="h-5 w-5 text-green-500" />,
      data: <FileText className="h-5 w-5 text-purple-500" />,
      web: <FileText className="h-5 w-5 text-orange-500" />,
      video: <FileText className="h-5 w-5 text-pink-500" />,
      audio: <FileText className="h-5 w-5 text-indigo-500" />
    };
    return icons[type] || <FileText className="h-5 w-5 text-gray-400" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start space-x-4">
                <div className="w-5 h-5 bg-gray-300 rounded"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-full"></div>
                  <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                  <div className="flex space-x-4">
                    <div className="h-3 bg-gray-300 rounded w-16"></div>
                    <div className="h-3 bg-gray-300 rounded w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with stats and controls */}
      {showStats && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span className="flex items-center space-x-1">
              <Hash className="h-4 w-4" />
              <span>{filteredResults.length} results</span>
            </span>
            {query && (
              <span className="flex items-center space-x-1">
                <Zap className="h-4 w-4" />
                <span>for "{query}"</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Filter by type */}
            {resourceTypes.length > 1 && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All types</option>
                {resourceTypes.map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            )}

            {/* Sort by */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date' | 'type')}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="relevance">Sort by relevance</option>
              <option value="date">Sort by date</option>
              <option value="type">Sort by type</option>
            </select>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        {filteredResults.map((result, index) => (
          <div
            key={`${result.id}-${index}`}
            className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <div className="p-6">
              <div className="flex items-start space-x-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getResourceIcon(result.resource_type || 'text')}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title and Score */}
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900 line-clamp-2">
                      {result.title || result.content.substring(0, 80) + '...'}
                    </h3>
                    <div className={`ml-4 px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(result.similarity_score || 0)}`}>
                      {((result.similarity_score || 0) * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Content Preview */}
                  <div className="text-gray-700 text-sm mb-3 line-clamp-3">
                    {highlightText(result.content, query)}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center space-x-4 text-xs text-gray-500 mb-4">
                    <span className="flex items-center space-x-1">
                      <Filter className="h-3 w-3" />
                      <span>{result.resource_type}</span>
                    </span>
                    {result.created_at && (
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(result.created_at).toLocaleDateString()}</span>
                      </span>
                    )}
                    {result.chunk_index !== undefined && (
                      <span>Chunk {result.chunk_index + 1}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => onResultClick?.(result)}
                      className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open</span>
                    </button>

                    {onViewContent && (
                      <button
                        onClick={() => onViewContent(result)}
                        className="inline-flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800 font-medium"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Preview</span>
                      </button>
                    )}

                    {onDownload && (
                      <button
                        onClick={() => onDownload(result)}
                        className="inline-flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800 font-medium"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {filteredResults.length === 0 && !loading && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
          <p className="text-gray-600 mb-4">
            {filterType !== 'all' 
              ? `No ${filterType} files match your search.`
              : `We couldn't find anything matching "${query}".`
            }
          </p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>Try adjusting your search terms or filters</p>
            <p>Make sure files have been processed and indexed</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResults;