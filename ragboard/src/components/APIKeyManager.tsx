import React, { useState, useEffect, useCallback } from 'react';
import { Key, Eye, EyeOff, Save, Trash2, ExternalLink, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { ApiService } from '../services/api';

interface Provider {
  id: string;
  name: string;
  description: string;
  setup_url: string;
  fields: string[];
  required: boolean;
  configured: boolean;
  updated_at?: string;
  globally_configured?: boolean;
  requires_user_setup?: boolean;
}

interface APIKeyManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const APIKeyManager: React.FC<APIKeyManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await ApiService.get('/external/providers');
      setProviders(response.user_configuration || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load API providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadProviders();
    }
  }, [isOpen, loadProviders]);

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider.id);
    
    // Initialize form with empty values for all fields
    const initialData: Record<string, string> = {};
    provider.fields.forEach(field => {
      initialData[field] = '';
    });
    setFormData(initialData);
    
    // Reset show keys state
    const showKeysState: Record<string, boolean> = {};
    provider.fields.forEach(field => {
      showKeysState[field] = false;
    });
    setShowKeys(showKeysState);
  };

  const handleSave = async (providerId: string) => {
    setSubmitting(providerId);
    setError(null);
    setSuccess(null);

    try {
      // Filter out empty values
      const filteredData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value.trim())
      );

      if (Object.keys(filteredData).length === 0) {
        throw new Error('Please provide at least one API key');
      }

      await ApiService.post('/external/api-keys', {
        provider: providerId,
        keys: filteredData
      });

      setSuccess(`API keys saved successfully for ${providerId}`);
      setEditingProvider(null);
      setFormData({});
      setShowKeys({});
      
      // Reload providers
      await loadProviders();
    } catch (err: any) {
      setError(err.message || 'Failed to save API keys');
    } finally {
      setSubmitting(null);
    }
  };

  const handleDelete = async (providerId: string) => {
    if (!confirm(`Are you sure you want to delete API keys for ${providerId}?`)) {
      return;
    }

    setSubmitting(providerId);
    setError(null);
    setSuccess(null);

    try {
      await ApiService.delete(`/external/api-keys/${providerId}`);
      setSuccess(`API keys deleted successfully for ${providerId}`);
      
      // Reload providers
      await loadProviders();
    } catch (err: any) {
      setError(err.message || 'Failed to delete API keys');
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancel = () => {
    setEditingProvider(null);
    setFormData({});
    setShowKeys({});
    setError(null);
    setSuccess(null);
  };

  const toggleShowKey = (field: string) => {
    setShowKeys(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      'api_key': 'API Key',
      'access_token': 'Access Token',
      'bearer_token': 'Bearer Token',
      'client_id': 'Client ID',
      'client_secret': 'Client Secret'
    };
    return labels[field] || field.replace('_', ' ').toUpperCase();
  };

  const getProviderStatus = (provider: Provider) => {
    if (provider.globally_configured) {
      return { type: 'global', text: 'Globally Configured', color: 'text-blue-600 bg-blue-100' };
    } else if (provider.configured) {
      return { type: 'user', text: 'User Configured', color: 'text-green-600 bg-green-100' };
    } else if (provider.requires_user_setup) {
      return { type: 'required', text: 'Setup Required', color: 'text-yellow-600 bg-yellow-100' };
    } else {
      return { type: 'optional', text: 'Optional', color: 'text-gray-600 bg-gray-100' };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">API Key Management</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Alerts */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-green-700">{success}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading providers...</span>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">About API Keys</h3>
                <p className="text-sm text-blue-700">
                  Configure your API keys to enable external content search and import. 
                  Your keys are encrypted and stored securely. Only configure the providers you need.
                </p>
              </div>

              {providers.map((provider) => {
                const status = getProviderStatus(provider);
                const isEditing = editingProvider === provider.id;
                const isSubmittingThis = submitting === provider.id;

                return (
                  <div key={provider.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">{provider.name}</h3>
                          <span className={clsx(
                            'px-2 py-1 text-xs font-medium rounded-full',
                            status.color
                          )}>
                            {status.text}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{provider.description}</p>
                        
                        {provider.updated_at && (
                          <p className="text-xs text-gray-500">
                            Last updated: {new Date(provider.updated_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <a
                          href={provider.setup_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-500 hover:text-gray-700"
                          title="Open setup guide"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        {!provider.globally_configured && (
                          <>
                            {!isEditing ? (
                              <>
                                <button
                                  onClick={() => handleEdit(provider)}
                                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                                  disabled={isSubmittingThis}
                                >
                                  {provider.configured ? 'Update' : 'Configure'}
                                </button>
                                {provider.configured && (
                                  <button
                                    onClick={() => handleDelete(provider.id)}
                                    className="p-2 text-red-500 hover:text-red-700"
                                    disabled={isSubmittingThis}
                                    title="Delete API keys"
                                  >
                                    {isSubmittingThis ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSave(provider.id)}
                                  disabled={isSubmittingThis}
                                  className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1"
                                >
                                  {isSubmittingThis ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Save className="w-3 h-3" />
                                  )}
                                  Save
                                </button>
                                <button
                                  onClick={handleCancel}
                                  disabled={isSubmittingThis}
                                  className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Form Fields */}
                    {isEditing && (
                      <div className="space-y-4 border-t pt-4">
                        {provider.fields.map((field) => (
                          <div key={field}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {getFieldLabel(field)}
                            </label>
                            <div className="relative">
                              <input
                                type={showKeys[field] ? 'text' : 'password'}
                                value={formData[field] || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                                placeholder={`Enter your ${getFieldLabel(field).toLowerCase()}`}
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <button
                                type="button"
                                onClick={() => toggleShowKey(field)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showKeys[field] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Global Configuration Notice */}
                    {provider.globally_configured && (
                      <div className="border-t pt-4">
                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                          <p className="text-sm text-blue-700">
                            This provider is configured globally by the system administrator. 
                            No additional setup required.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};