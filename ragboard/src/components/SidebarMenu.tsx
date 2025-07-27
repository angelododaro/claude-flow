import React from 'react';
import { 
  MessageSquare, 
  Mic, 
  Image, 
  Type, 
  Palette,
  Globe,
  Share2,
  FileText,
  Folder,
  Plus,
  Box,
  Video,
  TrendingUp,
  Search,
  Shapes,
  Edit3,
  BookOpen
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAbility } from '../contexts/AbilityContext';

interface SidebarMenuItem {
  id: string;
  icon: React.ElementType;
  label: string;
  action: () => void;
}

interface SidebarMenuProps {
  onAddResource: (type: string) => void;
  onToggleSearch?: () => void;
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({ onAddResource, onToggleSearch }) => {
  const ability = useAbility();
  const canCreateResource = ability.can('create', 'Resource');
  const menuItems: SidebarMenuItem[] = [
    {
      id: 'chat',
      icon: MessageSquare,
      label: 'AI Chat',
      action: () => onAddResource('chat'),
    },
    {
      id: 'voice',
      icon: Mic,
      label: 'Record Voice',
      action: () => onAddResource('voice'),
    },
    {
      id: 'image',
      icon: Image,
      label: 'Add Image',
      action: () => onAddResource('image'),
    },
    {
      id: 'video',
      icon: Video,
      label: 'Add Video',
      action: () => onAddResource('video'),
    },
    {
      id: 'text',
      icon: Type,
      label: 'Add Text',
      action: () => onAddResource('text'),
    },
    {
      id: 'web',
      icon: Globe,
      label: 'Add URL',
      action: () => onAddResource('web'),
    },
    {
      id: 'social',
      icon: Share2,
      label: 'Add Social Content',
      action: () => onAddResource('social'),
    },
    {
      id: 'documents',
      icon: FileText,
      label: 'Upload Documents',
      action: () => onAddResource('documents'),
    },
    {
      id: 'folder',
      icon: Folder,
      label: 'Add Folder',
      action: () => onAddResource('folder'),
    },
    {
      id: 'frame',
      icon: Box,
      label: 'Add Frame',
      action: () => onAddResource('frame'),
    },
    {
      id: 'ads-library',
      icon: Search,
      label: 'Meta Ads Library',
      action: () => onAddResource('ads-library'),
    },
    {
      id: 'explore',
      icon: TrendingUp,
      label: 'Explore Trending',
      action: () => onAddResource('explore'),
    },
    {
      id: 'annotation',
      icon: Edit3,
      label: 'Add Annotation',
      action: () => onAddResource('annotation'),
    },
    {
      id: 'shapes',
      icon: Shapes,
      label: 'Advanced Shapes',
      action: () => onAddResource('shapes'),
    },
    {
      id: 'share',
      icon: Share2,
      label: 'Share Board',
      action: () => onAddResource('share'),
    },
  ];

  // Additional non-resource actions (like search)
  const additionalItems: SidebarMenuItem[] = [
    ...(onToggleSearch ? [{
      id: 'search',
      icon: BookOpen,
      label: 'Search Knowledge',
      action: onToggleSearch,
    }] : []),
  ];

  return (
    <div className="fixed left-0 top-14 h-[calc(100%-3.5rem)] w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 z-50">
      {/* Logo/Brand */}
      <div className="mb-8">
        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex flex-col gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.action}
              disabled={!canCreateResource}
              className={clsx(
                'group relative w-12 h-12 rounded-lg flex items-center justify-center',
                canCreateResource 
                  ? 'hover:bg-purple-50 transition-colors duration-200'
                  : 'opacity-50 cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
              )}
              title={canCreateResource ? item.label : 'You need permission to add resources'}
            >
              <Icon className="w-5 h-5 text-gray-600 group-hover:text-purple-600" />
              
              {/* Tooltip */}
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {item.label}
              </span>
            </button>
          );
        })}
        
        {/* Additional Actions (Search, etc.) */}
        {additionalItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={clsx(
                'group relative w-12 h-12 rounded-lg flex items-center justify-center',
                'hover:bg-blue-50 transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              )}
              title={item.label}
            >
              <Icon className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
              
              {/* Tooltip */}
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add Button at Bottom */}
      <div className="mt-auto">
        <button
          onClick={() => onAddResource('quick')}
          className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center hover:bg-purple-700 transition-colors"
          title="Quick Add"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
};