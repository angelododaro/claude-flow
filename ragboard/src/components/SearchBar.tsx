import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, X, FileText, Loader } from 'lucide-react';
import { searchService, SearchResult, SearchSuggestion } from '../services/searchService';

interface SearchBarProps {
  boardId?: string;
  onResultSelect?: (result: SearchResult) => void;
  onResultsChange?: (results: SearchResult[]) => void;
  placeholder?: string;
  className?: string;
  showFilters?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  boardId,
  onResultSelect,
  onResultsChange,
  placeholder = "Search your knowledge base...",
  className = "",
  showFilters = true
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filters, setFilters] = useState({
    resourceTypes: [] as string[],
    limit: 10
  });
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Resource type options for filtering
  const resourceTypeOptions = [
    { value: 'pdf', label: 'PDF Documents', icon: '📄' },
    { value: 'document', label: 'Documents', icon: '📝' },
    { value: 'text', label: 'Text Files', icon: '📃' },
    { value: 'image', label: 'Images', icon: '🖼️' },
    { value: 'data', label: 'Data Files', icon: '📊' },
    { value: 'web', label: 'Web Content', icon: '🌐' },
    { value: 'video', label: 'Videos', icon: '🎥' },
    { value: 'audio', label: 'Audio', icon: '🎵' }
  ];

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (query.trim().length >= 2) {
      searchTimeout.current = setTimeout(() => {
        performSearch(query);
        getSuggestions(query);
      }, 300);
    } else {
      setResults([]);
      setSuggestions([]);
      setShowResults(false);
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query, filters, boardId]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setShowFiltersPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const searchResults = await searchService.search({
        query: searchQuery,
        boardId,
        resourceTypes: filters.resourceTypes.length > 0 ? filters.resourceTypes : undefined,
        limit: filters.limit
      });

      setResults(searchResults);
      setShowResults(true);
      setSelectedIndex(-1);

      if (onResultsChange) {
        onResultsChange(searchResults);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getSuggestions = async (searchQuery: string) => {
    try {
      const suggestionResults = await searchService.getSuggestions({
        query: searchQuery,
        boardId,
        limit: 5
      });
      setSuggestions(suggestionResults);
    } catch (error) {
      console.error('Suggestions error:', error);
      setSuggestions([]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults) return;

    const totalItems = suggestions.length + results.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < suggestions.length) {
            // Selected a suggestion
            const suggestion = suggestions[selectedIndex];
            setQuery(suggestion.text);
            performSearch(suggestion.text);
          } else {
            // Selected a result
            const resultIndex = selectedIndex - suggestions.length;
            const result = results[resultIndex];
            if (onResultSelect) {
              onResultSelect(result);
            }
            setShowResults(false);
          }
        } else if (query.trim()) {
          performSearch(query);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
    }
    setShowResults(false);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    performSearch(suggestion.text);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  const toggleResourceType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      resourceTypes: prev.resourceTypes.includes(type)
        ? prev.resourceTypes.filter(t => t !== type)
        : [...prev.resourceTypes, type]
    }));
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight) return text;
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === highlight.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200">{part}</mark>
      ) : part
    );
  };

  return (
    <div ref={searchRef} className={`relative w-full max-w-2xl ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setShowResults(true)}
          placeholder={placeholder}
          className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />

        <div className="absolute inset-y-0 right-0 flex items-center">
          {query && (
            <button
              onClick={clearSearch}
              className="p-1 mr-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          
          {showFilters && (
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`p-2 mr-1 rounded-md transition-colors ${
                showFiltersPanel || filters.resourceTypes.length > 0
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Filter className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && showFiltersPanel && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Filter by file type:</h4>
          <div className="grid grid-cols-2 gap-2">
            {resourceTypeOptions.map(option => (
              <label
                key={option.value}
                className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={filters.resourceTypes.includes(option.value)}
                  onChange={() => toggleResourceType(option.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-lg">{option.icon}</span>
                <span className="text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Results Dropdown */}
      {showResults && (suggestions.length > 0 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-40 max-h-96 overflow-auto">
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3 ${
                    selectedIndex === index ? 'bg-blue-50' : ''
                  }`}
                >
                  <Search className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{suggestion.text}</span>
                  {suggestion.count && (
                    <span className="text-xs text-gray-500">({suggestion.count} results)</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Results ({results.length})
              </div>
              {results.map((result, index) => {
                const resultIndex = suggestions.length + index;
                return (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 ${
                      selectedIndex === resultIndex ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        <FileText className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {result.title || result.content.substring(0, 50)}
                        </div>
                        <div className="text-sm text-gray-600 line-clamp-2">
                          {highlightText(result.content, query)}
                        </div>
                        <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                          <span>{result.resource_type}</span>
                          <span>•</span>
                          <span>Score: {(result.similarity_score * 100).toFixed(0)}%</span>
                          {result.created_at && (
                            <>
                              <span>•</span>
                              <span>{new Date(result.created_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No Results */}
          {query && !isSearching && results.length === 0 && suggestions.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">No results found for "{query}"</p>
              <p className="text-xs text-gray-400 mt-1">Try different keywords or check your filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;