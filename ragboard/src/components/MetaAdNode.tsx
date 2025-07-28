import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '../types';
import { ExternalLink, Search, TrendingUp, Eye } from 'lucide-react';
import { clsx } from 'clsx';

interface MetaAdData {
  id: string;
  title: string;
  metadata: {
    adData: {
      ad_id: string;
      ad_creative_bodies?: string[];
      ad_creative_link_titles?: string[];
      page_name: string;
      publisher_platforms?: string[];
      ad_snapshot_url: string;
      spend?: { lower_bound?: string; upper_bound?: string };
      impressions?: { lower_bound?: string; upper_bound?: string };
    };
  };
  onDelete?: (id: string) => void;
}

export const MetaAdNode: React.FC<NodeProps<MetaAdData>> = ({ 
  id, 
  data, 
  selected 
}) => {
  const { adData } = data.metadata;

  const formatSpend = (spend?: { lower_bound?: string; upper_bound?: string }) => {
    if (!spend) return 'Not disclosed';
    if (spend.lower_bound && spend.upper_bound) {
      return `$${spend.lower_bound} - $${spend.upper_bound}`;
    }
    if (spend.lower_bound) {
      return `$${spend.lower_bound}+`;
    }
    return 'Not disclosed';
  };

  const formatImpressions = (impressions?: { lower_bound?: string; upper_bound?: string }) => {
    if (!impressions) return 'Not disclosed';
    if (impressions.lower_bound && impressions.upper_bound) {
      return `${impressions.lower_bound} - ${impressions.upper_bound}`;
    }
    if (impressions.lower_bound) {
      return `${impressions.lower_bound}+`;
    }
    return 'Not disclosed';
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

  return (
    <div className={clsx(
      'bg-white border-2 rounded-lg shadow-lg p-4 min-w-80 max-w-80',
      selected ? 'border-blue-500' : 'border-gray-200',
      'hover:shadow-xl transition-shadow'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Search className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-medium text-sm text-gray-900">Meta Ad</div>
            <div className="text-xs text-gray-500">{adData.page_name}</div>
          </div>
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

      {/* Content */}
      <div className="space-y-3">
        <div>
          <h3 className="font-medium text-sm line-clamp-2 mb-1">
            {adData.ad_creative_link_titles?.[0] || data.title}
          </h3>
          {adData.ad_creative_bodies?.[0] && (
            <p className="text-xs text-gray-600 line-clamp-3">
              {adData.ad_creative_bodies[0]}
            </p>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 p-2 rounded text-center">
            <div className="text-xs text-gray-600">Spend</div>
            <div className="font-medium text-sm">{formatSpend(adData.spend)}</div>
          </div>
          <div className="bg-gray-50 p-2 rounded text-center">
            <div className="text-xs text-gray-600">Impressions</div>
            <div className="font-medium text-sm">{formatImpressions(adData.impressions)}</div>
          </div>
        </div>

        {/* Platforms */}
        {adData.publisher_platforms && adData.publisher_platforms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {adData.publisher_platforms.map(platform => (
              <span
                key={platform}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
              >
                {platform}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-gray-500">
            ID: {adData.ad_id.slice(0, 8)}...
          </div>
          <a
            href={adData.ad_snapshot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs"
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
        className="w-2 h-2 border-2 border-white bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 border-2 border-white bg-blue-500"
      />
    </div>
  );
};