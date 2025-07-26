import React, { useState, useCallback, useEffect } from 'react';
import { 
  Share2, 
  Link, 
  Mail, 
  Download, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Users, 
  Globe, 
  Lock,
  Code,
  Image,
  FileText,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react';
import { clsx } from 'clsx';

interface ShareSettings {
  isPublic: boolean;
  allowComments: boolean;
  allowEditing: boolean;
  requireAuth: boolean;
  expiresAt?: Date;
  password?: string;
}

interface ShareToolProps {
  boardId: string;
  boardName: string;
  onClose: () => void;
}

export const ShareTool: React.FC<ShareToolProps> = ({ boardId, boardName, onClose }) => {
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    isPublic: false,
    allowComments: true,
    allowEditing: false,
    requireAuth: false
  });
  const [shareUrl, setShareUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'embed' | 'export'>('share');
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf' | 'json'>('png');
  const [devicePreview, setDevicePreview] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  useEffect(() => {
    generateShareUrl();
  }, [shareSettings, boardId]);

  const generateShareUrl = useCallback(async () => {
    setIsGenerating(true);
    
    try {
      // Simulate API call to generate share URL
      const params = new URLSearchParams({
        board_id: boardId,
        public: shareSettings.isPublic.toString(),
        comments: shareSettings.allowComments.toString(),
        editing: shareSettings.allowEditing.toString(),
        auth: shareSettings.requireAuth.toString(),
      });

      if (shareSettings.expiresAt) {
        params.append('expires', shareSettings.expiresAt.toISOString());
      }
      if (shareSettings.password) {
        params.append('password', 'protected');
      }

      const baseUrl = window.location.origin;
      const newShareUrl = `${baseUrl}/shared/${boardId}?${params}`;
      setShareUrl(newShareUrl);

      // Generate embed code
      const embedCode = `<iframe
  src="${newShareUrl}&embed=true"
  width="100%"
  height="600"
  frameborder="0"
  allowfullscreen>
</iframe>`;
      setEmbedCode(embedCode);

    } catch (error) {
      console.error('Failed to generate share URL:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [boardId, shareSettings]);

  const handleCopy = useCallback(async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  const handleShare = useCallback(async (platform: string) => {
    const text = `Check out my board: ${boardName}`;
    const url = shareUrl;

    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'email':
        window.open(`mailto:?subject=${encodeURIComponent(boardName)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`);
        break;
      default:
        handleCopy(url, 'share-link');
    }
  }, [shareUrl, boardName, handleCopy]);

  const handleExport = useCallback(async () => {
    setIsGenerating(true);
    
    try {
      const response = await fetch(`/api/v1/boards/${boardId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          format: exportFormat,
          settings: shareSettings 
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${boardName}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [boardId, boardName, exportFormat, shareSettings]);

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'desktop': return <Monitor className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const getDeviceDimensions = (device: string) => {
    switch (device) {
      case 'desktop': return { width: '100%', height: '400px' };
      case 'tablet': return { width: '768px', height: '400px', maxWidth: '100%' };
      case 'mobile': return { width: '375px', height: '400px', maxWidth: '100%' };
      default: return { width: '100%', height: '400px' };
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Share Board</h2>
              <p className="text-sm text-gray-600">{boardName}</p>
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
          {/* Settings Panel */}
          <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
            <div className="space-y-6">
              {/* Privacy Settings */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  {shareSettings.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  Privacy
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={shareSettings.isPublic}
                      onChange={(e) => setShareSettings(prev => ({ ...prev, isPublic: e.target.checked }))}
                      className="rounded text-green-600 mr-3"
                    />
                    <div>
                      <div className="font-medium text-sm">Public Access</div>
                      <div className="text-xs text-gray-600">Anyone with the link can view</div>
                    </div>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={shareSettings.requireAuth}
                      onChange={(e) => setShareSettings(prev => ({ ...prev, requireAuth: e.target.checked }))}
                      className="rounded text-green-600 mr-3"
                    />
                    <div>
                      <div className="font-medium text-sm">Require Sign-in</div>
                      <div className="text-xs text-gray-600">Users must authenticate</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Permissions
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={shareSettings.allowComments}
                      onChange={(e) => setShareSettings(prev => ({ ...prev, allowComments: e.target.checked }))}
                      className="rounded text-green-600 mr-3"
                    />
                    <div>
                      <div className="font-medium text-sm">Allow Comments</div>
                      <div className="text-xs text-gray-600">Viewers can add comments</div>
                    </div>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={shareSettings.allowEditing}
                      onChange={(e) => setShareSettings(prev => ({ ...prev, allowEditing: e.target.checked }))}
                      className="rounded text-green-600 mr-3"
                    />
                    <div>
                      <div className="font-medium text-sm">Allow Editing</div>
                      <div className="text-xs text-gray-600">Viewers can modify content</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Expiration */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Expiration</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setShareSettings(prev => ({ ...prev, expiresAt: undefined }))}
                    className={clsx(
                      'w-full text-left px-3 py-2 rounded border text-sm',
                      !shareSettings.expiresAt 
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 hover:border-gray-400'
                    )}
                  >
                    Never expires
                  </button>
                  <button
                    onClick={() => setShareSettings(prev => ({ 
                      ...prev, 
                      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
                    }))}
                    className={clsx(
                      'w-full text-left px-3 py-2 rounded border text-sm',
                      shareSettings.expiresAt 
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 hover:border-gray-400'
                    )}
                  >
                    Expires in 7 days
                  </button>
                </div>
              </div>

              {/* Password Protection */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Password Protection</h3>
                <input
                  type="password"
                  placeholder="Optional password"
                  value={shareSettings.password || ''}
                  onChange={(e) => setShareSettings(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('share')}
                className={clsx(
                  'px-6 py-3 font-medium text-sm border-b-2 transition-colors',
                  activeTab === 'share'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                )}
              >
                <Share2 className="w-4 h-4 inline mr-2" />
                Share Link
              </button>
              <button
                onClick={() => setActiveTab('embed')}
                className={clsx(
                  'px-6 py-3 font-medium text-sm border-b-2 transition-colors',
                  activeTab === 'embed'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                )}
              >
                <Code className="w-4 h-4 inline mr-2" />
                Embed
              </button>
              <button
                onClick={() => setActiveTab('export')}
                className={clsx(
                  'px-6 py-3 font-medium text-sm border-b-2 transition-colors',
                  activeTab === 'export'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                )}
              >
                <Download className="w-4 h-4 inline mr-2" />
                Export
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'share' && (
                <div className="space-y-6">
                  {/* Share URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Share URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                      />
                      <button
                        onClick={() => handleCopy(shareUrl, 'url')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                      >
                        {copied === 'url' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied === 'url' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Social Media Sharing */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Share on Social Media
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleShare('twitter')}
                        className="flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">T</span>
                        </div>
                        Twitter/X
                      </button>
                      <button
                        onClick={() => handleShare('linkedin')}
                        className="flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">in</span>
                        </div>
                        LinkedIn
                      </button>
                      <button
                        onClick={() => handleShare('facebook')}
                        className="flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">f</span>
                        </div>
                        Facebook
                      </button>
                      <button
                        onClick={() => handleShare('email')}
                        className="flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Mail className="w-8 h-8 text-gray-600" />
                        Email
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Preview
                    </label>
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between">
                        <span className="text-sm text-gray-600">Shared Board Preview</span>
                        <div className="flex items-center gap-2">
                          {shareSettings.isPublic ? (
                            <Eye className="w-4 h-4 text-green-600" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-600" />
                          )}
                          <span className="text-xs text-gray-600">
                            {shareSettings.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 h-32 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-lg font-semibold text-gray-800 mb-1">{boardName}</div>
                          <div className="text-sm text-gray-600">Interactive board preview</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'embed' && (
                <div className="space-y-6">
                  {/* Device Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Device Preview
                    </label>
                    <div className="flex gap-2 mb-4">
                      {['desktop', 'tablet', 'mobile'].map(device => (
                        <button
                          key={device}
                          onClick={() => setDevicePreview(device as any)}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                            devicePreview === device
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'border border-gray-300 hover:bg-gray-50'
                          )}
                        >
                          {getDeviceIcon(device)}
                          <span className="capitalize">{device}</span>
                        </button>
                      ))}
                    </div>
                    
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <div 
                        className="bg-gray-100 mx-auto"
                        style={getDeviceDimensions(devicePreview)}
                      >
                        <div className="h-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-gray-800 mb-2">{boardName}</div>
                            <div className="text-sm text-gray-600">Embedded board preview</div>
                            <div className="text-xs text-gray-500 mt-2">
                              {devicePreview} view • {getDeviceDimensions(devicePreview).width} width
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Embed Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Embed Code
                    </label>
                    <div className="relative">
                      <textarea
                        value={embedCode}
                        readOnly
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                      />
                      <button
                        onClick={() => handleCopy(embedCode, 'embed')}
                        className="absolute top-2 right-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors flex items-center gap-1"
                      >
                        {copied === 'embed' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === 'embed' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Embed Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Embed Options
                    </label>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Width</label>
                          <input
                            type="text"
                            defaultValue="100%"
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Height</label>
                          <input
                            type="text"
                            defaultValue="600"
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'export' && (
                <div className="space-y-6">
                  {/* Export Format */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Export Format
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { format: 'png', label: 'PNG Image', icon: <Image className="w-6 h-6" /> },
                        { format: 'pdf', label: 'PDF Document', icon: <FileText className="w-6 h-6" /> },
                        { format: 'json', label: 'JSON Data', icon: <Code className="w-6 h-6" /> }
                      ].map(({ format, label, icon }) => (
                        <button
                          key={format}
                          onClick={() => setExportFormat(format as any)}
                          className={clsx(
                            'flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors',
                            exportFormat === format
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-300 hover:border-gray-400'
                          )}
                        >
                          {icon}
                          <span className="text-sm font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Export Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Export Options
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded text-green-600 mr-3" />
                        <span className="text-sm">Include metadata</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" defaultChecked className="rounded text-green-600 mr-3" />
                        <span className="text-sm">High resolution</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded text-green-600 mr-3" />
                        <span className="text-sm">Include comments</span>
                      </label>
                    </div>
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={handleExport}
                    disabled={isGenerating}
                    className={clsx(
                      'w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
                      isGenerating
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    )}
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Export {exportFormat.toUpperCase()}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};