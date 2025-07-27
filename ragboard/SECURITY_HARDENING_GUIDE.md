# Security Hardening Guide for RAGBOARD

## Overview
This guide provides comprehensive security measures for protecting ragboard and its integrated open-source tools in production environments.

## 1. Authentication & Authorization Security

### JWT Token Security

```python
# backend/app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import secrets

class SecurityConfig:
    # Use strong secret key
    SECRET_KEY = secrets.token_urlsafe(32)
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    
    # Password requirements
    PASSWORD_MIN_LENGTH = 12
    PASSWORD_REQUIRE_UPPERCASE = True
    PASSWORD_REQUIRE_LOWERCASE = True
    PASSWORD_REQUIRE_NUMBERS = True
    PASSWORD_REQUIRE_SPECIAL = True

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # Increase rounds for better security
)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    
    # Add additional claims for security
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": secrets.token_urlsafe(16),  # JWT ID for revocation
    })
    
    return jwt.encode(to_encode, SecurityConfig.SECRET_KEY, algorithm=SecurityConfig.ALGORITHM)

def verify_password_strength(password: str) -> tuple[bool, list[str]]:
    """Verify password meets security requirements"""
    errors = []
    
    if len(password) < SecurityConfig.PASSWORD_MIN_LENGTH:
        errors.append(f"Password must be at least {SecurityConfig.PASSWORD_MIN_LENGTH} characters")
    
    if SecurityConfig.PASSWORD_REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
        errors.append("Password must contain uppercase letters")
    
    if SecurityConfig.PASSWORD_REQUIRE_LOWERCASE and not any(c.islower() for c in password):
        errors.append("Password must contain lowercase letters")
    
    if SecurityConfig.PASSWORD_REQUIRE_NUMBERS and not any(c.isdigit() for c in password):
        errors.append("Password must contain numbers")
    
    if SecurityConfig.PASSWORD_REQUIRE_SPECIAL and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        errors.append("Password must contain special characters")
    
    return len(errors) == 0, errors
```

### CASL Permission Security

```typescript
// src/auth/secureAbilities.ts
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { User, Board } from '../types';

// Secure ability definitions with field-level permissions
export function defineSecureAbilities(user: User | null) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  if (!user) {
    // Anonymous users - minimal permissions
    can('read', 'Board', { isPublic: true });
    cannot('read', 'Board', ['inviteCode', 'settings']);
    return build();
  }

  // Authenticated users
  can('create', 'Board', { 
    // Limit board creation rate
    createdCount: { $lt: 100 } 
  });
  
  // Field-level restrictions
  can('read', 'User', ['id', 'name', 'avatar']);
  cannot('read', 'User', ['email', 'password', 'apiKeys']);
  
  // Prevent privilege escalation
  cannot('update', 'User', ['role', 'subscription']);
  
  // Board access with conditions
  can('read', 'Board', {
    $or: [
      { ownerId: user.id },
      { 'members.userId': user.id },
      { isPublic: true }
    ]
  });
  
  // Secure deletion - only soft delete
  can('delete', 'Board', { ownerId: user.id });
  cannot('delete', 'Board', { hasPaymentData: true });
  
  // Admin permissions with audit
  if (user.role === 'admin' && user.isTwoFactorEnabled) {
    can('manage', 'all');
    // But still restrict sensitive operations
    cannot('delete', 'User', { role: 'admin' });
    cannot('update', 'SystemSettings', { securityConfig: true });
  }
  
  return build();
}
```

## 2. Input Validation & Sanitization

### Frontend Input Validation

```typescript
// src/utils/validation.ts
import DOMPurify from 'dompurify';
import { z } from 'zod';

// Configure DOMPurify for strict sanitization
const purifyConfig = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, purifyConfig);
}

// Zod schemas for validation
export const BoardSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title too long')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Invalid characters in title'),
  description: z.string()
    .max(500, 'Description too long')
    .transform(sanitizeHTML),
  isPublic: z.boolean(),
});

export const FileUploadSchema = z.object({
  file: z.instanceof(File)
    .refine(file => file.size <= 10 * 1024 * 1024, 'File too large (max 10MB)')
    .refine(file => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      return allowedTypes.includes(file.type);
    }, 'Invalid file type'),
});

// Validate and sanitize user input
export function validateUserInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; errors?: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(e => e.message) 
      };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}
```

### Backend Input Validation

```python
# backend/app/api/security/validation.py
from pydantic import BaseModel, validator, constr, conint
from typing import Optional
import re
import bleach
from sqlalchemy import text

class SecureInputMixin:
    """Mixin for secure input validation"""
    
    @validator('*', pre=True)
    def prevent_none_values(cls, v):
        if v is None:
            raise ValueError('None values not allowed')
        return v
    
    @validator('*')
    def prevent_sql_injection(cls, v):
        if isinstance(v, str):
            # Check for SQL injection patterns
            sql_patterns = [
                r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)",
                r"(--|;|'|\"|\/\*|\*\/)",
                r"(\bOR\b.*=.*)",
                r"(\bAND\b.*=.*)",
            ]
            
            for pattern in sql_patterns:
                if re.search(pattern, v, re.IGNORECASE):
                    raise ValueError('Potential SQL injection detected')
        return v

class SecureBoardCreate(BaseModel, SecureInputMixin):
    title: constr(min_length=1, max_length=100, regex=r'^[\w\s\-]+$')
    description: Optional[constr(max_length=500)]
    is_public: bool = False
    
    @validator('description')
    def sanitize_html(cls, v):
        if v:
            # Whitelist allowed HTML tags
            allowed_tags = ['b', 'i', 'em', 'strong', 'a', 'p', 'br']
            allowed_attrs = {'a': ['href']}
            
            return bleach.clean(
                v,
                tags=allowed_tags,
                attributes=allowed_attrs,
                strip=True
            )
        return v

# Parameterized queries to prevent SQL injection
async def get_board_secure(board_id: str, user_id: str):
    # Use parameterized query
    query = text("""
        SELECT * FROM boards 
        WHERE id = :board_id 
        AND (owner_id = :user_id OR :user_id = ANY(member_ids))
    """)
    
    result = await db.execute(
        query,
        {"board_id": board_id, "user_id": user_id}
    )
    return result.first()
```

## 3. API Security

### Rate Limiting

```python
# backend/app/middleware/rate_limit.py
from fastapi import Request, HTTPException
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
import redis
from datetime import timedelta

# Initialize Redis for distributed rate limiting
redis_client = redis.from_url(settings.REDIS_URL)

class AdvancedRateLimiter:
    def __init__(self):
        self.limiter = Limiter(
            key_func=self.get_rate_limit_key,
            default_limits=["100/minute", "1000/hour"],
            storage_uri=settings.REDIS_URL,
        )
    
    def get_rate_limit_key(self, request: Request) -> str:
        """Generate rate limit key based on user and IP"""
        user_id = getattr(request.state, "user_id", None)
        ip_address = get_remote_address(request)
        
        if user_id:
            # Authenticated users get higher limits
            return f"user:{user_id}"
        else:
            # Anonymous users limited by IP
            return f"ip:{ip_address}"
    
    def custom_limits(self, request: Request) -> str:
        """Different limits for different endpoints"""
        path = request.url.path
        
        # Strict limits for expensive operations
        if "/export" in path:
            return "10/hour"
        elif "/ai/" in path:
            return "50/hour"
        elif "/upload" in path:
            return "20/hour"
        
        # Standard limits
        return "100/minute"

# Distributed rate limiting with sliding window
class SlidingWindowRateLimiter:
    def __init__(self, redis_client, window_size: int = 60):
        self.redis = redis_client
        self.window_size = window_size
    
    async def is_allowed(self, key: str, limit: int) -> bool:
        now = time.time()
        window_start = now - self.window_size
        
        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcount(key, window_start, now)
        pipe.expire(key, self.window_size * 2)
        
        results = pipe.execute()
        request_count = results[2]
        
        return request_count <= limit
```

### CORS Configuration

```python
# backend/app/core/security/cors.py
from fastapi.middleware.cors import CORSMiddleware

def configure_cors(app):
    # Strict CORS configuration
    origins = []
    
    if settings.ENVIRONMENT == "production":
        origins = [
            "https://ragboard.com",
            "https://www.ragboard.com",
            "https://app.ragboard.com",
        ]
    else:
        # Development only
        origins = ["http://localhost:3000", "http://localhost:5173"]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["X-Total-Count", "X-Request-ID"],
        max_age=86400,  # 24 hours
    )
```

## 4. File Upload Security

```python
# backend/app/services/secure_upload.py
import magic
import hashlib
from PIL import Image
import io
import uuid
from typing import BinaryIO

class SecureFileUploader:
    ALLOWED_MIME_TYPES = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/webp': ['.webp'],
        'application/pdf': ['.pdf'],
        'audio/wav': ['.wav'],
        'audio/mpeg': ['.mp3'],
        'video/mp4': ['.mp4'],
    }
    
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_IMAGE_DIMENSIONS = (4096, 4096)
    
    async def validate_and_process_file(
        self,
        file: BinaryIO,
        filename: str
    ) -> dict:
        # Read file content
        content = await file.read()
        
        # Check file size
        if len(content) > self.MAX_FILE_SIZE:
            raise ValueError("File too large")
        
        # Verify MIME type using python-magic
        mime = magic.from_buffer(content, mime=True)
        if mime not in self.ALLOWED_MIME_TYPES:
            raise ValueError(f"File type not allowed: {mime}")
        
        # Additional validation for images
        if mime.startswith('image/'):
            await self._validate_image(content)
        
        # Generate secure filename
        file_hash = hashlib.sha256(content).hexdigest()
        extension = self.ALLOWED_MIME_TYPES[mime][0]
        secure_filename = f"{uuid.uuid4()}_{file_hash[:8]}{extension}"
        
        # Scan for malware (integrate with ClamAV)
        if settings.ENABLE_VIRUS_SCAN:
            await self._scan_for_malware(content)
        
        return {
            'content': content,
            'filename': secure_filename,
            'mime_type': mime,
            'size': len(content),
            'hash': file_hash,
        }
    
    async def _validate_image(self, content: bytes):
        """Validate image and remove EXIF data"""
        try:
            img = Image.open(io.BytesIO(content))
            
            # Check dimensions
            if img.size[0] > self.MAX_IMAGE_DIMENSIONS[0] or \
               img.size[1] > self.MAX_IMAGE_DIMENSIONS[1]:
                raise ValueError("Image dimensions too large")
            
            # Remove EXIF data for privacy
            if hasattr(img, '_getexif'):
                # Create new image without EXIF
                data = list(img.getdata())
                img_without_exif = Image.new(img.mode, img.size)
                img_without_exif.putdata(data)
                
                # Convert back to bytes
                output = io.BytesIO()
                img_without_exif.save(output, format=img.format)
                return output.getvalue()
                
        except Exception as e:
            raise ValueError(f"Invalid image file: {str(e)}")
        
        return content
    
    async def _scan_for_malware(self, content: bytes):
        """Integrate with ClamAV for virus scanning"""
        import pyclamd
        
        try:
            cd = pyclamd.ClamdUnixSocket()
            result = cd.scan_stream(content)
            
            if result and result[0] == 'FOUND':
                raise ValueError("Malware detected in file")
                
        except pyclamd.ConnectionError:
            # Log error but don't block upload
            logger.error("ClamAV connection failed")
```

## 5. WebSocket Security

```typescript
// src/services/secureWebSocket.ts
import { io, Socket } from 'socket.io-client';

class SecureWebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageQueue: any[] = [];
  
  connect(token: string, boardId: string) {
    // Validate inputs
    if (!this.isValidToken(token) || !this.isValidBoardId(boardId)) {
      throw new Error('Invalid connection parameters');
    }
    
    this.socket = io(process.env.VITE_WS_URL!, {
      auth: { token },
      query: { boardId },
      transports: ['websocket'], // Prevent fallback to polling
      secure: true, // Force TLS
      rejectUnauthorized: true,
      timeout: 10000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    
    this.setupSecurityHandlers();
  }
  
  private setupSecurityHandlers() {
    if (!this.socket) return;
    
    // Handle authentication errors
    this.socket.on('connect_error', (error) => {
      if (error.message === 'Authentication failed') {
        this.handleAuthFailure();
      }
    });
    
    // Validate incoming messages
    this.socket.on('message', (data) => {
      if (!this.validateMessage(data)) {
        console.error('Invalid message received:', data);
        return;
      }
      
      // Process validated message
      this.processMessage(data);
    });
    
    // Rate limit outgoing messages
    this.socket.use((packet, next) => {
      if (this.isRateLimited()) {
        return next(new Error('Rate limit exceeded'));
      }
      next();
    });
  }
  
  private validateMessage(data: any): boolean {
    // Validate message structure
    if (!data || typeof data !== 'object') return false;
    if (!data.type || typeof data.type !== 'string') return false;
    if (!data.timestamp || !this.isValidTimestamp(data.timestamp)) return false;
    
    // Validate message types
    const allowedTypes = ['cursor', 'update', 'presence', 'sync'];
    if (!allowedTypes.includes(data.type)) return false;
    
    // Additional validation based on type
    switch (data.type) {
      case 'update':
        return this.validateUpdateMessage(data);
      case 'cursor':
        return this.validateCursorMessage(data);
      default:
        return true;
    }
  }
  
  private isValidTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const oneMinuteAhead = now + (60 * 1000);
    
    // Reject messages too old or too far in future
    return timestamp > fiveMinutesAgo && timestamp < oneMinuteAhead;
  }
  
  private isRateLimited(): boolean {
    // Implement token bucket algorithm
    // Allow 10 messages per second
    return false; // Implement actual logic
  }
}
```

## 6. Data Encryption

```python
# backend/app/core/encryption.py
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os

class EncryptionService:
    def __init__(self):
        self.master_key = self._derive_key(settings.MASTER_KEY_SEED)
        self.fernet = Fernet(self.master_key)
    
    def _derive_key(self, seed: str) -> bytes:
        """Derive encryption key from seed"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=settings.ENCRYPTION_SALT.encode(),
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(seed.encode()))
        return key
    
    def encrypt_sensitive_data(self, data: str) -> str:
        """Encrypt sensitive data like API keys"""
        return self.fernet.encrypt(data.encode()).decode()
    
    def decrypt_sensitive_data(self, encrypted: str) -> str:
        """Decrypt sensitive data"""
        return self.fernet.decrypt(encrypted.encode()).decode()
    
    def hash_pii(self, data: str) -> str:
        """One-way hash for PII data"""
        import hashlib
        salt = settings.PII_HASH_SALT
        return hashlib.pbkdf2_hmac(
            'sha256',
            data.encode(),
            salt.encode(),
            100000
        ).hex()

# Usage in models
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email_hash = Column(String, unique=True, index=True)
    encrypted_email = Column(String)  # For recovery purposes
    
    @property
    def email(self):
        return encryption_service.decrypt_sensitive_data(self.encrypted_email)
    
    @email.setter
    def email(self, value):
        self.email_hash = encryption_service.hash_pii(value.lower())
        self.encrypted_email = encryption_service.encrypt_sensitive_data(value)
```

## 7. Security Headers

```python
# backend/app/middleware/security_headers.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Content Security Policy
        csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.posthog.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data:",
            "connect-src 'self' wss: https://api.openai.com https://app.posthog.com",
            "media-src 'self' blob:",
            "object-src 'none'",
            "frame-src 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests",
        ]
        
        response.headers["Content-Security-Policy"] = "; ".join(csp)
        
        # Strict Transport Security (only for HTTPS)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        return response
```

## 8. Audit Logging

```python
# backend/app/services/audit_log.py
from enum import Enum
from datetime import datetime
import json

class AuditEventType(Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    BOARD_CREATE = "board_create"
    BOARD_DELETE = "board_delete"
    PERMISSION_CHANGE = "permission_change"
    DATA_EXPORT = "data_export"
    ADMIN_ACTION = "admin_action"
    SECURITY_ALERT = "security_alert"

class AuditLogger:
    def __init__(self):
        self.redis = redis.from_url(settings.REDIS_URL)
    
    async def log_event(
        self,
        event_type: AuditEventType,
        user_id: str,
        details: dict,
        ip_address: str,
        user_agent: str
    ):
        event = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type.value,
            "user_id": user_id,
            "ip_address": self._hash_ip(ip_address),
            "user_agent": user_agent,
            "details": details,
        }
        
        # Store in Redis with TTL
        key = f"audit:{event['id']}"
        self.redis.setex(
            key,
            timedelta(days=90),  # 90 day retention
            json.dumps(event)
        )
        
        # Also store in database for permanent record
        await self._store_in_database(event)
        
        # Alert on suspicious events
        if event_type == AuditEventType.SECURITY_ALERT:
            await self._send_security_alert(event)
    
    def _hash_ip(self, ip: str) -> str:
        """Hash IP for privacy while maintaining uniqueness"""
        parts = ip.split('.')
        if len(parts) == 4:
            # Keep first two octets, hash last two
            return f"{parts[0]}.{parts[1]}.{hashlib.md5('.'.join(parts[2:]).encode()).hexdigest()[:8]}"
        return hashlib.md5(ip.encode()).hexdigest()[:16]
```

## 9. Session Security

```typescript
// src/services/sessionSecurity.ts
class SessionManager {
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout
  private sessionTimer: NodeJS.Timeout | null = null;
  private activityTimer: NodeJS.Timeout | null = null;
  
  startSession(token: string) {
    this.resetSessionTimer();
    this.trackActivity();
    
    // Bind activity listeners
    document.addEventListener('mousemove', this.onActivity);
    document.addEventListener('keypress', this.onActivity);
    document.addEventListener('click', this.onActivity);
  }
  
  private resetSessionTimer() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
    
    // Warning before timeout
    this.sessionTimer = setTimeout(() => {
      this.showTimeoutWarning();
    }, this.SESSION_TIMEOUT - this.WARNING_TIME);
    
    // Actual timeout
    setTimeout(() => {
      this.handleSessionTimeout();
    }, this.SESSION_TIMEOUT);
  }
  
  private onActivity = () => {
    this.resetSessionTimer();
    
    // Rate limit activity tracking
    if (this.activityTimer) return;
    
    this.activityTimer = setTimeout(() => {
      this.activityTimer = null;
    }, 1000);
    
    // Send heartbeat to server
    this.sendHeartbeat();
  };
  
  private async sendHeartbeat() {
    try {
      await api.post('/api/auth/heartbeat');
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }
  
  private showTimeoutWarning() {
    // Show warning modal
    const remaining = 5; // minutes
    alert(`Your session will expire in ${remaining} minutes. Please save your work.`);
  }
  
  private handleSessionTimeout() {
    // Clear sensitive data
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.clear();
    
    // Redirect to login
    window.location.href = '/login?reason=timeout';
  }
}
```

## 10. Security Monitoring

```python
# backend/app/services/security_monitor.py
class SecurityMonitor:
    def __init__(self):
        self.anomaly_threshold = 5
        self.time_window = 300  # 5 minutes
    
    async def detect_brute_force(self, email: str, ip: str) -> bool:
        key = f"failed_login:{email}:{ip}"
        attempts = await self.redis.incr(key)
        await self.redis.expire(key, self.time_window)
        
        if attempts > self.anomaly_threshold:
            await self.handle_brute_force(email, ip)
            return True
        return False
    
    async def detect_suspicious_activity(self, user_id: str, action: str):
        # Track unusual patterns
        patterns = [
            self.check_rapid_api_calls,
            self.check_unusual_access_times,
            self.check_geographic_anomalies,
            self.check_permission_escalation,
        ]
        
        for check in patterns:
            if await check(user_id, action):
                await self.trigger_security_alert(user_id, action)
                break
    
    async def check_rapid_api_calls(self, user_id: str, action: str) -> bool:
        key = f"api_calls:{user_id}"
        count = await self.redis.incr(key)
        await self.redis.expire(key, 60)  # 1 minute window
        
        return count > 100  # More than 100 calls per minute
```

## Security Checklist

### Development
- [ ] Enable strict mode in TypeScript
- [ ] Use ESLint security plugin
- [ ] Implement pre-commit hooks for security
- [ ] Regular dependency updates
- [ ] Security training for developers

### Testing
- [ ] Penetration testing
- [ ] OWASP ZAP scanning
- [ ] SQL injection testing
- [ ] XSS vulnerability testing
- [ ] Authentication bypass testing

### Production
- [ ] Enable HTTPS everywhere
- [ ] Implement WAF (Web Application Firewall)
- [ ] Regular security audits
- [ ] Incident response plan
- [ ] Security monitoring and alerts

### Compliance
- [ ] GDPR compliance
- [ ] CCPA compliance
- [ ] SOC 2 certification
- [ ] Regular security assessments
- [ ] Data retention policies

## Incident Response

```python
# backend/app/services/incident_response.py
class IncidentResponse:
    async def handle_security_incident(self, incident_type: str, details: dict):
        # 1. Isolate affected systems
        await self.isolate_affected_resources(details)
        
        # 2. Notify security team
        await self.notify_security_team(incident_type, details)
        
        # 3. Preserve evidence
        await self.preserve_evidence(details)
        
        # 4. Contain the breach
        await self.contain_breach(incident_type, details)
        
        # 5. Assess damage
        damage_report = await self.assess_damage(details)
        
        # 6. Notify affected users if necessary
        if damage_report.requires_notification:
            await self.notify_affected_users(damage_report)
        
        # 7. Document everything
        await self.document_incident(incident_type, details, damage_report)
```

Remember: Security is not a one-time implementation but an ongoing process. Regular audits, updates, and training are essential for maintaining a secure application.