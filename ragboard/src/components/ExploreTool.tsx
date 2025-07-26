import React, { useState, useCallback, useEffect } from 'react';
import { TrendingUp, Search, Clock, Hash, ExternalLink, Loader2, AlertCircle, Star, Eye } from 'lucide-react';
import { clsx } from 'clsx';

interface TrendingContent {
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
    avatar?: string;
    verified?: boolean;
  };
  metrics: {
    likes?: number;
    shares?: number;
    comments?: number;
    upvotes?: number;
  };
  tags: string[];
}

interface ExploreToolProps {
  onAddContent: (content: TrendingContent) => void;
  onClose: () => void;
}

export const ExploreTool: React.FC<ExploreToolProps> = ({ onAddContent, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<TrendingContent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<TrendingContent | null>(null);

  const categories = [
    { id: 'all', name: 'All Categories', icon: '🌐' },
    { id: 'technology', name: 'Technology', icon: '💻' },
    { id: 'science', name: 'Science', icon: '🔬' },
    { id: 'business', name: 'Business', icon: '💼' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
    { id: 'sports', name: 'Sports', icon: '⚽' },
    { id: 'politics', name: 'Politics', icon: '🏛️' },
    { id: 'health', name: 'Health', icon: '🏥' },
    { id: 'education', name: 'Education', icon: '📚' }
  ];

  const platforms = [
    { id: 'all', name: 'All Platforms', icon: '🌍' },
    { id: 'youtube', name: 'YouTube', icon: '📺' },
    { id: 'twitter', name: 'Twitter/X', icon: '🐦' },
    { id: 'reddit', name: 'Reddit', icon: '📱' },
    { id: 'news', name: 'News', icon: '📰' },
    { id: 'github', name: 'GitHub', icon: '⚡' }
  ];

  const timeRanges = [
    { id: '1h', name: 'Last Hour' },
    { id: '24h', name: 'Last 24 Hours' },
    { id: '7d', name: 'Last Week' },
    { id: '30d', name: 'Last Month' }
  ];

  // Mock trending content - in real app this would come from APIs
  const generateMockContent = useCallback((): TrendingContent[] => {
    const mockData: TrendingContent[] = [
      {
        id: '1',
        title: 'Revolutionary AI Model Achieves Human-Level Performance',
        description: 'New breakthrough in artificial intelligence shows unprecedented capabilities in reasoning and problem-solving tasks.',
        url: 'https://example.com/ai-breakthrough',
        platform: 'news',
        category: 'technology',
        trending_score: 95,
        view_count: 1250000,
        engagement_count: 45000,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        author: {
          name: 'TechNews Daily',
          verified: true
        },
        metrics: {
          likes: 12500,
          shares: 3400,
          comments: 890
        },
        tags: ['AI', 'Machine Learning', 'Technology', 'Innovation']
      },
      {
        id: '2',
        title: 'How to Build Scalable React Applications in 2024',
        description: 'Complete guide to modern React development patterns, performance optimization, and best practices.',
        url: 'https://youtube.com/watch?v=example',
        platform: 'youtube',
        category: 'education',
        trending_score: 87,
        view_count: 890000,
        engagement_count: 23000,
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        thumbnail: 'https://via.placeholder.com/200x150/3b82f6/ffffff?text=React+2024',
        author: {
          name: 'CodeMaster Pro',
          verified: true
        },
        metrics: {
          likes: 18900,
          comments: 1200
        },
        tags: ['React', 'JavaScript', 'Frontend', 'Tutorial']
      },
      {
        id: '3',
        title: 'Scientists Discover New Method for Clean Energy Production',
        description: 'Breakthrough research shows 300% more efficient solar panel technology using quantum dot arrays.',
        url: 'https://science-journal.com/clean-energy',
        platform: 'news',
        category: 'science',
        trending_score: 92,
        view_count: 567000,
        engagement_count: 15600,
        created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        author: {
          name: 'Nature Science',
          verified: true
        },
        metrics: {
          likes: 8900,
          shares: 2100,
          comments: 445
        },
        tags: ['Science', 'Energy', 'Solar', 'Research']
      },
      {
        id: '4',
        title: 'The Future of Remote Work: 2024 Trends and Predictions',
        description: 'Analysis of how remote work is evolving with new technologies and changing business practices.',
        url: 'https://business-weekly.com/remote-work-2024',
        platform: 'news',
        category: 'business',
        trending_score: 78,
        view_count: 234000,
        engagement_count: 8900,
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        author: {
          name: 'Business Weekly',
          verified: true
        },
        metrics: {
          likes: 5600,
          shares: 1200,
          comments: 234
        },
        tags: ['Business', 'Remote Work', 'Future', 'Technology']
      },
      {
        id: '5',
        title: 'Open Source Vector Database Reaches 50k GitHub Stars',
        description: 'Community-driven vector database project gains massive adoption for AI and ML applications.',
        url: 'https://github.com/example/vectordb',
        platform: 'github',
        category: 'technology',
        trending_score: 83,
        view_count: 156000,
        engagement_count: 5200,
        created_at: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
        author: {
          name: 'VectorDB Team',
          verified: false
        },
        metrics: {
          upvotes: 4800,
          comments: 890
        },
        tags: ['Open Source', 'Database', 'AI', 'GitHub']
      }
    ];

    // Filter based on current selections
    return mockData.filter(item => {
      const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
      const platformMatch = selectedPlatform === 'all' || item.platform === selectedPlatform;
      const searchMatch = !searchTerm || 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return categoryMatch && platformMatch && searchMatch;
    });
  }, [selectedCategory, selectedPlatform, searchTerm]);

  const handleExplore = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const filteredContent = generateMockContent();
      setContent(filteredContent);
      
      if (filteredContent.length === 0) {
        setError('No trending content found for your search criteria');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trending content');
    } finally {
      setIsLoading(false);
    }
  }, [generateMockContent]);

  // Load content on mount and filter changes
  useEffect(() => {
    handleExplore();
  }, [selectedCategory, selectedPlatform, timeRange]);

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

  const formatMetrics = (content: TrendingContent) => {
    const { metrics, view_count, engagement_count } = content;
    const parts = [];
    
    if (view_count) {
      parts.push(`${view_count.toLocaleString()} views`);
    }
    if (metrics.likes) {
      parts.push(`${metrics.likes.toLocaleString()} likes`);
    }
    if (metrics.upvotes) {
      parts.push(`${metrics.upvotes.toLocaleString()} upvotes`);
    }
    if (metrics.shares) {
      parts.push(`${metrics.shares.toLocaleString()} shares`);
    }
    
    return parts.slice(0, 2).join(' • ');
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Explore Trending Content</h2>
              <p className="text-sm text-gray-600">Discover what's trending across platforms</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Filter Panel */}
          <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
            <div className="space-y-6">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Content
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search topics, tags..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Time Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="inline w-4 h-4 mr-1" />
                  Time Range
                </label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {timeRanges.map(range => (
                    <option key={range.id} value={range.id}>
                      {range.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Hash className="inline w-4 h-4 mr-1" />
                  Categories
                </label>
                <div className="space-y-1">
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={clsx(
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                        'flex items-center gap-2',
                        selectedCategory === category.id
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'hover:bg-gray-100 text-gray-700'
                      )}
                    >
                      <span>{category.icon}</span>
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platforms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platforms
                </label>
                <div className="space-y-1">
                  {platforms.map(platform => (
                    <button
                      key={platform.id}
                      onClick={() => setSelectedPlatform(platform.id)}
                      className={clsx(
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                        'flex items-center gap-2',
                        selectedPlatform === platform.id
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'hover:bg-gray-100 text-gray-700'
                      )}
                    >
                      <span>{platform.icon}</span>
                      {platform.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Content List */}
          <div className="w-96 border-r overflow-y-auto">
            {error && (
              <div className="p-4 bg-red-50 border-b border-red-200">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : content.length === 0 && !error ? (
              <div className="p-8 text-center text-gray-500">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No trending content found</p>
              </div>
            ) : (
              <div className="divide-y">
                {content.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedContent(item)}
                    className={clsx(
                      'p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                      selectedContent?.id === item.id && 'bg-purple-50 border-r-2 border-purple-500'
                    )}
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getPlatformIcon(item.platform)}</span>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <span>{item.author.name}</span>
                            {item.author.verified && (
                              <Star className="w-3 h-3 text-blue-500 fill-current" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {getTimeAgo(item.created_at)}
                        </div>
                      </div>

                      {/* Content */}
                      <div>
                        <h3 className="font-medium text-sm line-clamp-2 mb-1">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {formatMetrics(item)}
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          <span className="font-medium">{item.trending_score}</span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Content Details */}
          <div className="flex-1 overflow-y-auto">
            {selectedContent ? (
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{getPlatformIcon(selectedContent.platform)}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{selectedContent.author.name}</span>
                          {selectedContent.author.verified && (
                            <Star className="w-4 h-4 text-blue-500 fill-current" />
                          )}
                        </div>
                        <div className="text-sm text-gray-500 capitalize">
                          {selectedContent.platform} • {selectedContent.category}
                        </div>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-semibold mb-3">
                      {selectedContent.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {selectedContent.description}
                    </p>
                  </div>
                  <button
                    onClick={() => onAddContent(selectedContent)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors ml-4"
                  >
                    Add to Board
                  </button>
                </div>

                {/* Thumbnail */}
                {selectedContent.thumbnail && (
                  <div className="border rounded-lg overflow-hidden">
                    <img 
                      src={selectedContent.thumbnail} 
                      alt={selectedContent.title}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedContent.trending_score}
                    </div>
                    <div className="text-sm text-gray-600">Trending Score</div>
                  </div>
                  {selectedContent.view_count && (
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedContent.view_count.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Views</div>
                    </div>
                  )}
                  {selectedContent.metrics.likes && (
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {selectedContent.metrics.likes.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Likes</div>
                    </div>
                  )}
                  {selectedContent.engagement_count && (
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedContent.engagement_count.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Engagement</div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <h4 className="font-medium mb-3">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedContent.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* External Link */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">View Original</h4>
                  <a
                    href={selectedContent.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-purple-600 hover:text-purple-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in {selectedContent.platform}
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Select content to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};