import React, { useState, useCallback } from 'react';
import { Search, Filter, Calendar, MapPin, ExternalLink, Loader2, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';

interface MetaAd {
  ad_id: string;
  ad_creation_time: string;
  ad_creative_bodies: string[];
  ad_creative_link_titles: string[];
  ad_snapshot_url: string;
  page_name: string;
  publisher_platforms: string[];
  spend: { lower_bound?: string; upper_bound?: string };
  impressions: { lower_bound?: string; upper_bound?: string };
  demographic_distribution: Array<{
    percentage: string;
    age: string;
    gender: string;
  }>;
  delivery_by_region: Array<{
    region: string;
    percentage: string;
  }>;
}

interface AdsLibraryToolProps {
  onAddAd: (ad: MetaAd) => void;
  onClose: () => void;
}

export const AdsLibraryTool: React.FC<AdsLibraryToolProps> = ({ onAddAd, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['US']);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedAd, setSelectedAd] = useState<MetaAd | null>(null);

  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'BR', name: 'Brazil' },
    { code: 'IN', name: 'India' }
  ];

  const platforms = ['Facebook', 'Instagram', 'Messenger', 'Audience_Network'];

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        search_terms: searchTerm,
        ad_reached_countries: selectedCountries.join(','),
        limit: '50'
      });

      if (dateRange.start) {
        params.append('ad_delivery_date_min', dateRange.start);
      }
      if (dateRange.end) {
        params.append('ad_delivery_date_max', dateRange.end);
      }
      if (selectedPlatforms.length > 0) {
        params.append('publisher_platforms', selectedPlatforms.join(','));
      }

      const response = await fetch(`/api/v1/external-apis/meta-ads/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      setAds(data.ads || []);
      
      if (data.ads?.length === 0) {
        setError('No ads found for your search criteria');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search ads');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedCountries, dateRange, selectedPlatforms]);

  const handleCountryToggle = (countryCode: string) => {
    setSelectedCountries(prev => 
      prev.includes(countryCode) 
        ? prev.filter(c => c !== countryCode)
        : [...prev, countryCode]
    );
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const formatSpend = (spend: { lower_bound?: string; upper_bound?: string }) => {
    if (spend.lower_bound && spend.upper_bound) {
      return `$${spend.lower_bound} - $${spend.upper_bound}`;
    }
    if (spend.lower_bound) {
      return `$${spend.lower_bound}+`;
    }
    return 'Not disclosed';
  };

  const formatImpressions = (impressions: { lower_bound?: string; upper_bound?: string }) => {
    if (impressions.lower_bound && impressions.upper_bound) {
      return `${impressions.lower_bound} - ${impressions.upper_bound}`;
    }
    if (impressions.lower_bound) {
      return `${impressions.lower_bound}+`;
    }
    return 'Not disclosed';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Meta Ads Library</h2>
              <p className="text-sm text-gray-600">Search and analyze political and social issue ads</p>
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
          {/* Search Panel */}
          <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Search Term */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Terms
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Enter keywords..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>

              {/* Countries Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="inline w-4 h-4 mr-1" />
                  Target Countries
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {countries.map(country => (
                    <label key={country.code} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedCountries.includes(country.code)}
                        onChange={() => handleCountryToggle(country.code)}
                        className="rounded text-blue-600 mr-2"
                      />
                      <span className="text-sm">{country.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Date Range
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="Start date"
                  />
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="End date"
                  />
                </div>
              </div>

              {/* Platform Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Filter className="inline w-4 h-4 mr-1" />
                  Platforms
                </label>
                <div className="space-y-2">
                  {platforms.map(platform => (
                    <label key={platform} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(platform)}
                        onChange={() => handlePlatformToggle(platform)}
                        className="rounded text-blue-600 mr-2"
                      />
                      <span className="text-sm">{platform}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Search Button */}
              <button
                onClick={handleSearch}
                disabled={isLoading || !searchTerm.trim()}
                className={clsx(
                  'w-full py-2 px-4 rounded-lg font-medium transition-colors',
                  'flex items-center justify-center gap-2',
                  isLoading || !searchTerm.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Search Ads
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="flex-1 flex">
            {/* Ad List */}
            <div className="w-96 border-r overflow-y-auto">
              {error && (
                <div className="p-4 bg-red-50 border-b border-red-200">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}

              {ads.length === 0 && !isLoading && !error && (
                <div className="p-8 text-center text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Enter search terms and click "Search Ads" to find political and social issue advertisements</p>
                </div>
              )}

              <div className="divide-y">
                {ads.map(ad => (
                  <div
                    key={ad.ad_id}
                    onClick={() => setSelectedAd(ad)}
                    className={clsx(
                      'p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                      selectedAd?.ad_id === ad.ad_id && 'bg-blue-50 border-r-2 border-blue-500'
                    )}
                  >
                    <div className="space-y-2">
                      <div className="font-medium text-sm line-clamp-2">
                        {ad.ad_creative_link_titles?.[0] || 'Untitled Ad'}
                      </div>
                      <div className="text-xs text-gray-600 line-clamp-2">
                        {ad.ad_creative_bodies?.[0] || 'No description available'}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{ad.page_name}</span>
                        <span>{formatSpend(ad.spend)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ad.publisher_platforms?.map(platform => (
                          <span
                            key={platform}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ad Details */}
            <div className="flex-1 overflow-y-auto">
              {selectedAd ? (
                <div className="p-6 space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        {selectedAd.ad_creative_link_titles?.[0] || 'Untitled Ad'}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {selectedAd.ad_creative_bodies?.[0] || 'No description available'}
                      </p>
                    </div>
                    <button
                      onClick={() => onAddAd(selectedAd)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add to Board
                    </button>
                  </div>

                  {/* Ad Preview */}
                  {selectedAd.ad_snapshot_url && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Ad Preview</h4>
                      <a
                        href={selectedAd.ad_snapshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Original Ad
                      </a>
                    </div>
                  )}

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Spend</h4>
                      <p className="text-lg">{formatSpend(selectedAd.spend)}</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Impressions</h4>
                      <p className="text-lg">{formatImpressions(selectedAd.impressions)}</p>
                    </div>
                  </div>

                  {/* Demographics */}
                  {selectedAd.demographic_distribution?.length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">Demographics</h4>
                      <div className="space-y-2">
                        {selectedAd.demographic_distribution.slice(0, 5).map((demo, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{demo.age} • {demo.gender}</span>
                            <span className="font-medium">{demo.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Regions */}
                  {selectedAd.delivery_by_region?.length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">Top Regions</h4>
                      <div className="space-y-2">
                        {selectedAd.delivery_by_region.slice(0, 5).map((region, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{region.region}</span>
                            <span className="font-medium">{region.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meta Info */}
                  <div className="border rounded-lg p-4 text-sm text-gray-600">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>Page:</strong> {selectedAd.page_name}
                      </div>
                      <div>
                        <strong>Ad ID:</strong> {selectedAd.ad_id}
                      </div>
                      <div>
                        <strong>Created:</strong> {new Date(selectedAd.ad_creation_time).toLocaleDateString()}
                      </div>
                      <div>
                        <strong>Platforms:</strong> {selectedAd.publisher_platforms?.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Info className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Select an ad to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};