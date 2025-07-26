import React, { useState, useCallback, useEffect } from 'react';
import { Search, Youtube, Twitter, FileText, Download, Eye, ExternalLink, Calendar, TrendingUp, Globe, Filter, Loader2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { ApiService } from '../services/api';

interface YouTubeVideo {
  video_id: string;
  title: string;
  description: string;
  channel_title: string;
  published_at: string;
  duration: string;
  view_count: number;
  like_count?: number;
  thumbnail_url: string;
  tags: string[];
  captions_available: boolean;
  url: string;
}

interface SocialPost {
  post_id: string;
  platform: string;
  author: string;
  content: string;
  created_at: string;
  url: string;
  engagement: Record<string, number>;
  hashtags: string[];
  mentions: string[];
}

interface MetaAd {
  ad_id: string;
  ad_creative_bodies: string[];
  ad_creative_link_titles: string[];
  page_name: string;
  ad_creation_time?: string;
  ad_snapshot_url: string;
  impressions: Record<string, any>;
  spend: Record<string, any>;
  publisher_platforms: string[];
}

interface ExternalContentBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (content: any, platform: string) => void;
}

type Platform = 'youtube' | 'twitter' | 'reddit' | 'meta-ads';
type ContentType = 'search' | 'trending' | 'import';

export const ExternalContentBrowser: React.FC<ExternalContentBrowserProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [contentType, setContentType] = useState<ContentType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [importing, setImporting] = useState<string | null>(null);

  // Search parameters
  const [maxResults, setMaxResults] = useState(10);
  const [dateRange, setDateRange] = useState<'all' | 'hour' | 'day' | 'week' | 'month' | 'year'>('all');
  const [sortBy, setSortBy] = useState<string>('relevance');

  const platforms = [
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'text-red-500' },
    { id: 'twitter', name: 'Twitter', icon: Twitter, color: 'text-blue-500' },
    { id: 'reddit', name: 'Reddit', icon: Globe, color: 'text-orange-500' },
    { id: 'meta-ads', name: 'Meta Ads', icon: FileText, color: 'text-blue-600' },
  ];

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      let response;
      
      if (platform === 'youtube') {
        const params = new URLSearchParams({
          query: searchQuery,
          max_results: maxResults.toString(),
          order: sortBy,
        });
        
        if (dateRange !== 'all') {
          const now = new Date();
          const startDate = new Date();
          switch (dateRange) {
            case 'hour':
              startDate.setHours(now.getHours() - 1);
              break;
            case 'day':
              startDate.setDate(now.getDate() - 1);
              break;
            case 'week':
              startDate.setDate(now.getDate() - 7);
              break;
            case 'month':
              startDate.setMonth(now.getMonth() - 1);
              break;
            case 'year':
              startDate.setFullYear(now.getFullYear() - 1);
              break;
          }
          params.append('published_after', startDate.toISOString());
        }

        response = await ApiService.get(`/external/youtube/search?${params}`);
      } else if (platform === 'twitter' || platform === 'reddit') {
        response = await ApiService.post('/external/social-media/search', {
          query: searchQuery,
          platforms: [platform],
          max_results_per_platform: maxResults,
        });
        // Social media returns a dict with platform keys
        response = response[platform] || [];
      } else if (platform === 'meta-ads') {
        response = await ApiService.post('/external/meta-ads/search', {
          search_terms: searchQuery,
          limit: maxResults,
        });
      }

      setResults(Array.isArray(response) ? response : []);
    } catch (err: any) {
      setError(err.message || 'Failed to search content');
    } finally {
      setLoading(false);
    }
  }, [platform, searchQuery, maxResults, dateRange, sortBy]);

  const handleGetTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      let response;
      
      if (platform === 'youtube') {
        response = await ApiService.get('/external/youtube/trending?region_code=US');
      } else {
        response = await ApiService.get(`/external/social-media/trending/${platform}`);
      }

      setResults(Array.isArray(response) ? response : []);
    } catch (err: any) {
      setError(err.message || 'Failed to get trending content');
    } finally {
      setLoading(false);
    }
  }, [platform]);

  const handleImportContent = useCallback(async (content: any) => {
    const contentId = content.video_id || content.post_id || content.ad_id;
    if (!contentId) return;

    setImporting(contentId);
    setError(null);

    try {
      const response = await ApiService.post('/external/import', {
        content_id: contentId,
        platform: platform === 'meta-ads' ? 'meta' : platform,
        name: content.title || content.content?.substring(0, 50) || `${platform} content`,
        import_metadata: true,
        import_transcript: platform === 'youtube',
      });

      onImport(response, platform);
    } catch (err: any) {
      setError(err.message || 'Failed to import content');
    } finally {
      setImporting(null);
    }
  }, [platform, onImport]);

  const renderYouTubeCard = (video: YouTubeVideo) => (
    <div key={video.video_id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        <img
          src={video.thumbnail_url}
          alt={video.title}
          className="w-32 h-20 object-cover rounded flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{video.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{video.channel_title}</p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(video.published_at).toLocaleDateString()} • {video.view_count.toLocaleString()} views
          </p>
          {video.captions_available && (
            <span className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 rounded mt-2">
              CC Available
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.open(video.url, '_blank')}
            className="p-2 text-gray-500 hover:text-gray-700"
            title="View on YouTube"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleImportContent(video)}
            disabled={importing === video.video_id}
            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            title="Import to RAGBOARD"
          >
            {importing === video.video_id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSocialCard = (post: SocialPost) => (
    <div key={post.post_id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-900">@{post.author}</span>
            <span className="text-xs text-gray-500">
              {new Date(post.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-3">{post.content}</p>
          
          <div className="flex flex-wrap gap-1 mb-2">
            {post.hashtags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                #{tag}
              </span>
            ))}
          </div>
          
          <div className="flex gap-4 text-xs text-gray-500">
            {Object.entries(post.engagement).map(([key, value]) => (
              <span key={key}>{value} {key}</span>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col gap-2 ml-4">
          <button
            onClick={() => window.open(post.url, '_blank')}
            className="p-2 text-gray-500 hover:text-gray-700"
            title={`View on ${post.platform}`}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleImportContent(post)}
            disabled={importing === post.post_id}
            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            title="Import to RAGBOARD"
          >
            {importing === post.post_id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderMetaAdCard = (ad: MetaAd) => (
    <div key={ad.ad_id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 mb-2">{ad.page_name}</h3>
          
          {ad.ad_creative_link_titles.length > 0 && (
            <p className="text-sm font-medium text-gray-800 mb-2">
              {ad.ad_creative_link_titles[0]}
            </p>
          )}
          
          {ad.ad_creative_bodies.length > 0 && (
            <p className="text-sm text-gray-700 mb-3">
              {ad.ad_creative_bodies[0].substring(0, 200)}...
            </p>
          )}
          
          <div className="flex flex-wrap gap-2 mb-2">
            {ad.publisher_platforms.map((platform) => (
              <span key={platform} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                {platform}
              </span>
            ))}
          </div>
          
          {ad.ad_creation_time && (
            <p className="text-xs text-gray-500">
              Created: {new Date(ad.ad_creation_time).toLocaleDateString()}
            </p>
          )}
        </div>
        
        <div className="flex flex-col gap-2 ml-4">
          <button
            onClick={() => window.open(ad.ad_snapshot_url, '_blank')}
            className="p-2 text-gray-500 hover:text-gray-700"
            title="View Ad"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleImportContent(ad)}
            disabled={importing === ad.ad_id}
            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            title="Import to RAGBOARD"
          >
            {importing === ad.ad_id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Browse External Content</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-6 border-b bg-gray-50">
          {/* Platform Selection */}
          <div className="flex gap-2 mb-4">
            {platforms.map(({ id, name, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => setPlatform(id as Platform)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
                  platform === id
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                )}
              >
                <Icon className={clsx('w-4 h-4', platform === id ? 'text-white' : color)} />
                {name}
              </button>
            ))}
          </div>

          {/* Content Type */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setContentType('search')}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
                contentType === 'search'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <Search className="w-4 h-4" />
              Search
            </button>
            <button
              onClick={() => setContentType('trending')}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
                contentType === 'trending'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <TrendingUp className="w-4 h-4" />
              Trending
            </button>
          </div>

          {/* Search Controls */}
          {contentType === 'search' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={`Search ${platform === 'meta-ads' ? 'Meta Ads' : platform}...`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || loading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>

              {/* Filters */}
              <div className="flex gap-4 text-sm">
                <select
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded"
                >
                  <option value={10}>10 results</option>
                  <option value={25}>25 results</option>
                  <option value={50}>50 results</option>
                </select>

                {platform === 'youtube' && (
                  <>
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value as any)}
                      className="px-3 py-1 border border-gray-300 rounded"
                    >
                      <option value="all">All time</option>
                      <option value="hour">Past hour</option>
                      <option value="day">Past day</option>
                      <option value="week">Past week</option>
                      <option value="month">Past month</option>
                      <option value="year">Past year</option>
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="date">Date</option>
                      <option value="viewCount">View count</option>
                      <option value="rating">Rating</option>
                    </select>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Trending Button */}
          {contentType === 'trending' && (
            <button
              onClick={handleGetTrending}
              disabled={loading}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get Trending'}
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading content...</span>
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div className="text-center py-12 text-gray-500">
              {contentType === 'search' 
                ? 'Enter a search query to find content'
                : 'Click "Get Trending" to see popular content'
              }
            </div>
          )}

          <div className="space-y-4">
            {results.map((item) => {
              if (platform === 'youtube') {
                return renderYouTubeCard(item);
              } else if (platform === 'twitter' || platform === 'reddit') {
                return renderSocialCard(item);
              } else if (platform === 'meta-ads') {
                return renderMetaAdCard(item);
              }
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};