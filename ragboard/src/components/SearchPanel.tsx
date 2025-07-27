import React, { useState, useEffect } from 'react';
import { X, Upload, Settings, BarChart3 } from 'lucide-react';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import { SearchResult, searchService } from '../services/searchService';
import { uploadService } from '../services/uploadService';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  boardId?: string;
  onResultSelect?: (result: SearchResult) => void;
  className?: string;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  isOpen,
  onClose,
  boardId,
  onResultSelect,
  className = ""
}) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [searchStats, setSearchStats] = useState<any>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Get search statistics when panel opens
  useEffect(() => {
    if (isOpen && boardId) {
      loadSearchStats();
    }
  }, [isOpen, boardId]);

  const loadSearchStats = async () => {
    try {
      const stats = await searchService.getSearchStats(boardId);
      setSearchStats(stats);
    } catch (error) {
      console.error('Error loading search stats:', error);
    }
  };

  const handleResultsChange = (newResults: SearchResult[]) => {
    setResults(newResults);
    setCurrentQuery(currentQuery);
  };

  const handleResultSelect = (result: SearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
    }
    // Keep panel open to allow multiple selections
  };

  const handleFileUpload = async (files: FileList) => {
    setUploadFiles(files);
    setUploadProgress({});

    for (const file of Array.from(files)) {
      try {
        await uploadService.uploadAndMonitor(file, {
          boardId,
          autoProcess: true,
          onUploadProgress: (progress) => {
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: progress.percentage
            }));
          },
          onProcessingUpdate: (status) => {
            console.log(`Processing ${file.name}:`, status.processing_status);
          },
          onComplete: (result, status) => {
            console.log(`Upload complete for ${file.name}:`, result);
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: 100
            }));
            // Refresh search stats
            loadSearchStats();
          },
          onError: (error) => {
            console.error(`Upload error for ${file.name}:`, error);
          }
        });
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Knowledge Search</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
            title="Upload files"
          >
            <Upload className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Search Stats */}
      {searchStats && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1 text-gray-600">
                <BarChart3 className="h-4 w-4" />
                <span>{searchStats.total_resources || 0} files indexed</span>
              </span>
            </div>
            <span className="text-gray-500">
              {searchStats.total_embeddings || 0} chunks
            </span>
          </div>
        </div>
      )}

      {/* Upload Section */}
      {showUpload && (
        <div className="p-4 bg-blue-50 border-b border-gray-200">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Upload files to expand your knowledge base
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.csv,.xlsx,.json,.html,.mp4,.mp3"
            />
            
            {/* Upload Progress */}
            {Object.keys(uploadProgress).length > 0 && (
              <div className="space-y-2">
                {Object.entries(uploadProgress).map(([filename, progress]) => (
                  <div key={filename} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate">{filename}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <SearchBar
          boardId={boardId}
          onResultSelect={handleResultSelect}
          onResultsChange={handleResultsChange}
          placeholder="Search your knowledge..."
          showFilters={true}
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {results.length > 0 ? (
          <div className="p-4">
            <SearchResults
              results={results}
              query={currentQuery}
              onResultClick={handleResultSelect}
              onViewContent={(result) => {
                // Could open a modal or preview panel
                console.log('View content:', result);
              }}
              onDownload={(result) => {
                // Could trigger download
                console.log('Download:', result);
              }}
              showStats={false}
              loading={isSearching}
            />
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <div className="space-y-3">
              <BarChart3 className="h-12 w-12 text-gray-300 mx-auto" />
              <h3 className="text-lg font-medium">Start searching</h3>
              <p className="text-sm text-gray-400">
                Search through your uploaded files and knowledge base
              </p>
              {(!searchStats || searchStats.total_resources === 0) && (
                <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    No files have been uploaded yet. Upload some documents to start building your knowledge base.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 text-center space-y-1">
          <p>Powered by AI semantic search</p>
          <p>Supports 15+ file formats</p>
        </div>
      </div>
    </div>
  );
};

export default SearchPanel;