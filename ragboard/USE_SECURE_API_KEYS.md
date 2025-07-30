# 🔐 How to Use Secure API Key Management

## Quick Start

### 1. Copy the Environment Template

```bash
cd /workspaces/claude-flow/ragboard
cp .env.example .env
```

### 2. Add Your API Keys to .env

Edit the `.env` file and add your actual API keys:

```env
# Replace these with your actual keys
OPENAI_API_KEY=sk-your-actual-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-actual-anthropic-key-here
LANGCHAIN_API_KEY=lsv2_pt_your-actual-langchain-key-here
REQUESTY_API_KEY=sk-your-actual-requesty-key-here

# Generate a secure JWT secret
JWT_SECRET_KEY=your-32-character-secret-key-here
```

### 3. Generate a Secure JWT Secret

```bash
# Generate a secure random key
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. Install Dependencies

```bash
# Backend dependencies
cd backend
pip install python-dotenv cryptography

# Frontend dependencies
cd ..
npm install
```

### 5. Use the Secure API Key Manager Component

In your React app, add the API key manager to your settings:

```tsx
// src/pages/Settings.tsx
import SecureAPIKeyManager from '@/components/SecureAPIKeyManager';

export function SettingsPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      {/* Add the secure API key manager */}
      <SecureAPIKeyManager />
    </div>
  );
}
```

### 6. Access API Keys in Backend

```python
# In your backend code
from app.core.config import settings

# Get API keys securely
openai_key = settings.openai_api_key
anthropic_key = settings.anthropic_api_key

# Or use the API key manager
from app.core.config import api_key_manager

# Get and validate a key
key = api_key_manager.get_key("openai")
is_valid = api_key_manager.validate_key("openai")
```

## 🛡️ Security Features

### 1. **Encrypted Storage**
- API keys are encrypted using Fernet encryption
- Encryption key is stored separately
- Keys are never exposed in logs or responses

### 2. **Format Validation**
- Each service has specific key format validation
- Prevents invalid keys from being stored
- Client and server-side validation

### 3. **Access Control**
- JWT authentication required
- User-specific key storage
- Audit logging for all operations

### 4. **Safe API Responses**
- Keys are never returned in API responses
- Only key hashes are exposed
- Validation results without exposing keys

## 📝 API Examples

### Store a New API Key

```javascript
// Frontend example
const storeApiKey = async () => {
  const response = await fetch('/api/keys/store', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      service: 'openai',
      api_key: 'sk-...',
      expires_in_days: 90
    })
  });
};
```

### Validate Stored Keys

```javascript
// Validate all keys
const validateKeys = async () => {
  const response = await fetch('/api/keys/validate-all', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const results = await response.json();
  console.log(results);
  // { openai: { valid: true }, anthropic: { valid: true } }
};
```

## ⚠️ Important Security Notes

1. **Never expose API keys in:**
   - Git commits
   - Console logs
   - Error messages
   - Client-side code
   - Chat messages

2. **Always:**
   - Use HTTPS in production
   - Rotate keys regularly
   - Monitor for unauthorized usage
   - Keep audit logs
   - Use separate keys per environment

3. **If a key is compromised:**
   - Revoke immediately in the API Key Manager
   - Generate new key from service provider
   - Update all systems using the key
   - Review audit logs for misuse

## 🔧 Troubleshooting

### "Invalid API key format"
- Check the key starts with the correct prefix
- Ensure no extra spaces or newlines
- Verify you copied the complete key

### "Failed to store API key"
- Check JWT token is valid
- Ensure backend is running
- Check network connectivity
- Verify database is accessible

### "Validation failed"
- Check the key has required permissions
- Verify the service is accessible
- Ensure rate limits aren't exceeded

## 📚 Next Steps

1. Add the `SecureAPIKeyManager` component to your app
2. Configure all required API keys
3. Test key validation
4. Set up monitoring for key usage
5. Schedule regular key rotation

Remember: **Security is everyone's responsibility!**