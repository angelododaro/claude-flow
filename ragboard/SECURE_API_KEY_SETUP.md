# 🔐 Secure API Key Management Setup for RAGBOARD

## Overview

This guide provides a secure system for managing API keys in RAGBOARD, ensuring your sensitive credentials are properly protected.

## 🚨 Security Best Practices

### 1. **Never Commit API Keys**
- API keys should NEVER be in your code
- Use environment variables instead
- Add `.env` to `.gitignore` (already done)

### 2. **Rotate Keys Regularly**
- Change API keys every 30-90 days
- Immediately rotate compromised keys
- Keep audit logs of key usage

### 3. **Use Separate Keys for Environments**
- Development keys for local work
- Different keys for staging
- Production keys with strict access

## 📁 Files Created

### 1. **`.env.example`**
- Template for environment variables
- Safe to commit (contains no real keys)
- Documents all required variables

### 2. **`.gitignore`**
- Prevents accidental key commits
- Excludes all sensitive files
- Includes common secret file patterns

### 3. **`backend/app/core/config.py`**
- Pydantic settings with validation
- Type-safe configuration
- Automatic environment loading

### 4. **`backend/app/core/security.py`**
- API key encryption/decryption
- Format validation
- Secure storage utilities

### 5. **`backend/app/api/endpoints/api_keys.py`**
- REST API for key management
- Secure storage endpoints
- Key validation endpoints

### 6. **`src/components/SecureAPIKeyManager.tsx`**
- React UI for key management
- Client-side validation
- Secure input handling

## 🚀 Quick Setup

### 1. Create Your `.env` File

```bash
# Copy the template
cp .env.example .env

# Edit with your actual keys
nano .env
```

### 2. Set Required API Keys

```env
# Minimum required keys
OPENAI_API_KEY=sk-your-actual-openai-key
ANTHROPIC_API_KEY=sk-ant-your-actual-anthropic-key
JWT_SECRET_KEY=generate-a-random-32-char-string-here
DATABASE_URL=postgresql://user:password@localhost:5432/ragboard
```

### 3. Generate a Secure JWT Secret

```python
# Python one-liner to generate secure key
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. Start the Application

```bash
# Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Frontend
cd ..
npm run dev
```

## 🔑 API Key Management UI

### Access the Key Manager

1. Navigate to `/settings/api-keys` in your app
2. Or add the component to your settings page:

```tsx
import SecureAPIKeyManager from '@/components/SecureAPIKeyManager';

function SettingsPage() {
  return (
    <div>
      <SecureAPIKeyManager />
    </div>
  );
}
```

### Features

- **Secure Storage**: Keys are encrypted before storage
- **Format Validation**: Ensures keys match expected patterns
- **Service Validation**: Tests keys with actual API calls
- **Audit Trail**: Logs all key operations
- **Easy Rotation**: Revoke and replace keys easily

## 🛡️ Security Architecture

### 1. **Client Side**
- Input masking (password field)
- Format validation before submission
- No key storage in browser

### 2. **Transport**
- HTTPS only in production
- JWT authentication required
- Rate limiting on key endpoints

### 3. **Server Side**
- Fernet encryption for storage
- SHA-256 hashing for lookups
- Secure key derivation

### 4. **Database**
- Encrypted key storage
- Separate from main data
- Access logging

## 📊 API Endpoints

### Store API Key
```http
POST /api/keys/store
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "service": "openai",
  "api_key": "sk-...",
  "expires_in_days": 90
}
```

### List Keys (Without Exposing)
```http
GET /api/keys/list
Authorization: Bearer <jwt-token>

Response:
[
  {
    "service": "openai",
    "key_hash": "sha256...",
    "created_at": "2024-01-15T...",
    "is_valid": true
  }
]
```

### Validate Key
```http
POST /api/keys/validate/openai
Authorization: Bearer <jwt-token>

Response:
{
  "service": "openai",
  "is_valid": true,
  "validated_at": "2024-01-15T..."
}
```

### Revoke Key
```http
DELETE /api/keys/revoke/openai
Authorization: Bearer <jwt-token>
```

## 🔍 Monitoring & Alerts

### 1. **Failed Validation Alerts**
```python
# Add to your monitoring
if not api_key_manager.validate_key(service):
    alert_admin(f"API key validation failed for {service}")
```

### 2. **Usage Tracking**
```python
# Track API key usage
@track_api_usage
async def use_openai_key():
    key = await api_key_vault.get_key(user_id, "openai")
    # Use the key...
```

### 3. **Expiration Warnings**
```python
# Check for expiring keys daily
async def check_expiring_keys():
    for key in await get_all_keys():
        if key.expires_in_days <= 7:
            notify_user(key.user_id, f"{key.service} key expires soon")
```

## 🚨 Emergency Procedures

### If a Key is Compromised

1. **Immediately Revoke** in the API Key Manager
2. **Generate New Key** from the service provider
3. **Update All Instances** where the key is used
4. **Audit Logs** for any unauthorized usage

### Backup Key Storage

```bash
# Backup encryption key (store securely!)
cp .encryption_key /secure/backup/location/

# Backup encrypted keys database
pg_dump -t api_keys ragboard > api_keys_backup.sql
```

## 🔄 Key Rotation Workflow

### 1. **Schedule Regular Rotation**
```python
# Add to your task scheduler
@celery.task
def rotate_api_keys():
    for service in ['openai', 'anthropic']:
        if should_rotate(service):
            send_rotation_reminder(service)
```

### 2. **Rotation Steps**
1. Generate new key from provider
2. Add new key in API Key Manager
3. Test new key with validation
4. Update production configs
5. Revoke old key after verification

## 📝 Troubleshooting

### Common Issues

1. **"Invalid API key format"**
   - Check key starts with correct prefix
   - Ensure no extra spaces or quotes
   - Verify complete key was copied

2. **"Validation failed"**
   - Check API key permissions
   - Verify service is not down
   - Ensure network connectivity

3. **"Cannot decrypt key"**
   - Check `.encryption_key` file exists
   - Verify file permissions (should be 0600)
   - Ensure same encryption key used

## 🎯 Next Steps

1. **Set Up Your Keys**: Copy `.env.example` to `.env` and add your keys
2. **Test Key Manager**: Access the UI and add a test key
3. **Enable Monitoring**: Set up alerts for key issues
4. **Document Keys**: Keep a secure record of what each key is for
5. **Plan Rotation**: Schedule regular key rotation

## 🔗 Additional Resources

- [OpenAI API Keys](https://platform.openai.com/api-keys)
- [Anthropic Console](https://console.anthropic.com/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Key Management](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)

---

Remember: **Security is not optional**. Take the time to properly secure your API keys!