import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Key, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import axios from 'axios';

interface APIKey {
  service: string;
  key_hash: string;
  created_at: string;
  expires_at: string | null;
  is_valid: boolean;
  last_validated: string | null;
}

interface ServiceConfig {
  name: string;
  placeholder: string;
  pattern: RegExp;
  helpText: string;
}

const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-...',
    pattern: /^sk-[a-zA-Z0-9]{48,}$/,
    helpText: 'OpenAI API key starts with "sk-"'
  },
  anthropic: {
    name: 'Anthropic',
    placeholder: 'sk-ant-...',
    pattern: /^sk-ant-[a-zA-Z0-9]{40,}$/,
    helpText: 'Anthropic API key starts with "sk-ant-"'
  },
  langchain: {
    name: 'LangChain',
    placeholder: 'lsv2_pt_...',
    pattern: /^lsv2_pt_[a-zA-Z0-9]{32,}$/,
    helpText: 'LangChain API key starts with "lsv2_pt_"'
  },
  requesty: {
    name: 'Requesty',
    placeholder: 'sk-...',
    pattern: /^sk-[a-zA-Z0-9+/=]{50,}$/,
    helpText: 'Requesty API key starts with "sk-"'
  }
};

export default function SecureAPIKeyManager() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validating, setValidating] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await axios.get('/api/keys/list');
      setApiKeys(response.data);
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    }
  };

  const validateKeyFormat = (service: string, key: string): boolean => {
    const config = SERVICE_CONFIGS[service];
    if (!config) return true;
    return config.pattern.test(key);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedService || !apiKey) {
      setError('Please select a service and enter an API key');
      return;
    }

    if (!validateKeyFormat(selectedService, apiKey)) {
      setError(`Invalid ${SERVICE_CONFIGS[selectedService].name} API key format`);
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/keys/store', {
        service: selectedService,
        api_key: apiKey
      });
      
      setSuccess(`${SERVICE_CONFIGS[selectedService].name} API key stored securely`);
      setApiKey('');
      setSelectedService('');
      fetchApiKeys();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to store API key');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (service: string) => {
    setValidating(service);
    try {
      const response = await axios.post(`/api/keys/validate/${service}`);
      if (response.data.is_valid) {
        setSuccess(`${SERVICE_CONFIGS[service].name} API key is valid`);
      } else {
        setError(response.data.error || `${SERVICE_CONFIGS[service].name} API key validation failed`);
      }
      fetchApiKeys();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Validation failed');
    } finally {
      setValidating(null);
    }
  };

  const handleRevoke = async (service: string) => {
    if (!confirm(`Are you sure you want to revoke the ${SERVICE_CONFIGS[service].name} API key?`)) {
      return;
    }

    try {
      await axios.delete(`/api/keys/revoke/${service}`);
      setSuccess(`${SERVICE_CONFIGS[service].name} API key revoked`);
      fetchApiKeys();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to revoke API key');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Key className="w-6 h-6" />
          Secure API Key Manager
        </h2>

        {/* Security Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Security Best Practices:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Never share your API keys in code or chat</li>
                <li>Rotate keys regularly</li>
                <li>Use environment variables in production</li>
                <li>Revoke compromised keys immediately</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Add New Key Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service
              </label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a service</option>
                {Object.entries(SERVICE_CONFIGS).map(([key, config]) => (
                  <option key={key} value={key}>{config.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={selectedService ? SERVICE_CONFIGS[selectedService].placeholder : 'Enter API key'}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {selectedService && (
                <p className="text-xs text-gray-500 mt-1">
                  {SERVICE_CONFIGS[selectedService].helpText}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Storing...' : 'Store API Key Securely'}
          </button>
        </form>

        {/* Stored Keys List */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Stored API Keys</h3>
          {apiKeys.length === 0 ? (
            <p className="text-gray-500">No API keys stored yet</p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.service} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-medium">{SERVICE_CONFIGS[key.service]?.name || key.service}</h4>
                        <p className="text-sm text-gray-500">
                          Added: {new Date(key.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {key.is_valid ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleValidate(key.service)}
                        disabled={validating === key.service}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        {validating === key.service ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          'Validate'
                        )}
                      </button>
                      <button
                        onClick={() => handleRevoke(key.service)}
                        className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}