# 🔐 RAGBOARD Security & Deployment Requirements

## 🛡️ Security Architecture

### Multi-Layer Security Model

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend Security                      │
├─────────────────────────────────────────────────────────┤
│  • CASL Authorization  • CSP Headers  • Input Validation │
│  • XSS Protection     • CSRF Tokens   • Secure Storage  │
├─────────────────────────────────────────────────────────┤
│                    API Gateway                           │
├─────────────────────────────────────────────────────────┤
│  • JWT Validation     • Rate Limiting  • API Keys       │
│  • Request Signing    • IP Whitelisting • WAF Rules     │
├─────────────────────────────────────────────────────────┤
│                   Backend Security                       │
├─────────────────────────────────────────────────────────┤
│  • RLS Policies       • Data Encryption • Audit Logs    │
│  • Secret Management  • Input Sanitization • RBAC       │
├─────────────────────────────────────────────────────────┤
│                 Infrastructure Security                  │
├─────────────────────────────────────────────────────────┤
│  • Network Isolation  • TLS/SSL       • Firewall Rules  │
│  • Container Security • SIEM Integration • Backup Enc.  │
└─────────────────────────────────────────────────────────┘
```

## 🔑 Authentication & Authorization

### Supabase Auth Configuration

```typescript
// src/lib/auth/supabase.config.ts

export const supabaseAuthConfig = {
  // OAuth Providers
  providers: {
    google: {
      enabled: true,
      scopes: ['email', 'profile'],
      redirectUrl: process.env.NEXT_PUBLIC_AUTH_REDIRECT
    },
    github: {
      enabled: true,
      scopes: ['read:user', 'user:email']
    },
    microsoft: {
      enabled: true,
      scopes: ['openid', 'email', 'profile']
    }
  },
  
  // Session Configuration
  session: {
    expiryMargin: 300, // 5 minutes
    autoRefresh: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  
  // Security Settings
  security: {
    captchaEnabled: true,
    captchaProvider: 'hcaptcha',
    mfaEnabled: true,
    mfaFactors: ['totp', 'sms'],
    passwordPolicy: {
      minLength: 12,
      requireNumbers: true,
      requireSymbols: true,
      requireUppercase: true,
      preventCommon: true
    }
  }
}
```

### CASL Permission System

```typescript
// src/lib/auth/abilities.ts

import { defineAbility, AbilityBuilder } from '@casl/ability'

export type Actions = 'create' | 'read' | 'update' | 'delete' | 'share' | 'export'
export type Subjects = 'Board' | 'Node' | 'Comment' | 'User' | 'all'

export const defineAbilitiesFor = (user: User) => {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility)
  
  // Guest permissions
  can('read', 'Board', { isPublic: true })
  
  if (user) {
    // Authenticated user permissions
    can('create', 'Board')
    can('read', 'Board', { 
      $or: [
        { ownerId: user.id },
        { collaborators: { $in: [user.id] } },
        { isPublic: true }
      ]
    })
    can('update', 'Board', { ownerId: user.id })
    can('delete', 'Board', { ownerId: user.id })
    can('share', 'Board', { ownerId: user.id })
    
    // Node permissions inherit from board
    can(['create', 'read', 'update', 'delete'], 'Node', {
      boardId: { $in: user.accessibleBoardIds }
    })
    
    // Admin overrides
    if (user.role === 'admin') {
      can('manage', 'all')
    }
  }
  
  // Explicit denials
  cannot('delete', 'Board', { isTemplate: true })
  cannot('share', 'Board', { tier: 'personal', ownerId: { $ne: user?.id } })
  
  return build()
}
```

### Row-Level Security (RLS)

```sql
-- PostgreSQL RLS Policies

-- Enable RLS on tables
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Board access policies
CREATE POLICY "Users can view their own boards"
  ON boards FOR SELECT
  USING (auth.uid() = owner_id OR is_public = true);

CREATE POLICY "Users can view shared boards"
  ON boards FOR SELECT
  USING (auth.uid() = ANY(collaborators));

CREATE POLICY "Users can update their own boards"
  ON boards FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own boards"
  ON boards FOR DELETE
  USING (auth.uid() = owner_id);

-- Node access inherits from board
CREATE POLICY "Users can manage nodes in accessible boards"
  ON nodes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = nodes.board_id
      AND (boards.owner_id = auth.uid() OR auth.uid() = ANY(boards.collaborators))
    )
  );

-- Audit log policy
CREATE POLICY "Users can only view their own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid() OR auth.uid() IN (
    SELECT id FROM users WHERE role = 'admin'
  ));
```

## 🔒 Data Security

### Encryption Strategy

```yaml
At Rest:
  Database:
    - PostgreSQL: Transparent Data Encryption (TDE)
    - Encryption key: AWS KMS / Azure Key Vault
    - Backup encryption: AES-256
  
  File Storage:
    - MinIO: Server-side encryption (SSE-S3)
    - Client-side encryption for sensitive files
    - Encryption keys rotated monthly

In Transit:
  - TLS 1.3 minimum for all connections
  - Certificate pinning for mobile apps
  - HSTS headers with preload
  - Perfect Forward Secrecy (PFS)

Application Level:
  - Sensitive fields encrypted with AES-256-GCM
  - Encryption keys in secure vault
  - Field-level encryption for PII
```

### Input Validation & Sanitization

```typescript
// src/lib/security/validation.ts

import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import { escape } from 'lodash'

// Input schemas
export const boardSchema = z.object({
  title: z.string().min(1).max(255).transform(escape),
  description: z.string().max(1000).optional().transform(val => 
    val ? DOMPurify.sanitize(val) : undefined
  ),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(20).optional()
})

export const nodeSchema = z.object({
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'folder', 'ai_chat']),
  content: z.any().refine(validateNodeContent),
  position: z.object({
    x: z.number().min(-10000).max(10000),
    y: z.number().min(-10000).max(10000)
  }),
  metadata: z.record(z.unknown()).optional()
})

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File).refine(
    file => file.size <= 100 * 1024 * 1024, // 100MB
    'File size must be less than 100MB'
  ).refine(
    file => ALLOWED_MIME_TYPES.includes(file.type),
    'Invalid file type'
  ),
  scanForVirus: z.boolean().default(true)
})

// SQL injection prevention
export const sanitizeSQL = (input: string): string => {
  return input.replace(/['";\\]/g, '')
}

// XSS prevention for rich text
export const sanitizeRichText = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false
  })
}
```

### API Security

```python
# backend/app/middleware/security.py

from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta
import redis
from typing import Optional

class SecurityMiddleware:
    def __init__(self):
        self.redis_client = redis.Redis()
        self.bearer = HTTPBearer()
    
    async def verify_jwt(self, credentials: HTTPAuthorizationCredentials) -> dict:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(
                credentials.credentials,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            # Check if token is blacklisted
            if self.redis_client.get(f"blacklist:{credentials.credentials}"):
                raise HTTPException(status_code=401, detail="Token revoked")
            
            # Verify expiration
            if payload.get("exp", 0) < datetime.utcnow().timestamp():
                raise HTTPException(status_code=401, detail="Token expired")
            
            return payload
            
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
    
    async def rate_limit(self, request: Request, limit: int = 100, window: int = 3600):
        """Rate limiting per user/IP"""
        identifier = request.client.host
        if hasattr(request.state, "user"):
            identifier = f"user:{request.state.user.id}"
        
        key = f"rate_limit:{identifier}:{request.url.path}"
        
        current = self.redis_client.incr(key)
        if current == 1:
            self.redis_client.expire(key, window)
        
        if current > limit:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {window} seconds."
            )
    
    async def validate_api_key(self, api_key: str, required_scopes: list = None):
        """Validate API key and check scopes"""
        key_data = await db.get_api_key(api_key)
        
        if not key_data or not key_data.is_active:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        if required_scopes:
            if not all(scope in key_data.scopes for scope in required_scopes):
                raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Log API key usage
        await self.log_api_usage(api_key, request)
        
        return key_data
```

### Content Security Policy

```typescript
// src/middleware/security-headers.ts

export const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "connect-src 'self' https://api.openai.com https://api.anthropic.com wss://",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '),
  
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
}
```

## 🚀 Deployment Architecture

### Production Infrastructure

```yaml
Frontend Deployment:
  Platform: Vercel
  Configuration:
    - Edge Functions for API routes
    - ISR for static pages
    - Image optimization
    - Web Analytics
    - Preview deployments
    - Custom domains with SSL
  
  Environment Variables:
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    - NEXT_PUBLIC_API_URL
    - NEXT_PUBLIC_WEBSOCKET_URL

Backend Deployment:
  Platform: Fly.io
  Configuration:
    Services:
      - API Server (2-4 instances)
      - WebSocket Server (2 instances)
      - Background Workers (1-2 instances)
    
    Resources:
      - CPU: 2 shared vCPUs
      - RAM: 2GB per instance
      - Disk: 10GB persistent volume
    
    Scaling:
      - Horizontal autoscaling
      - Load balancing
      - Health checks
      - Zero-downtime deployments

Database:
  Primary: Supabase PostgreSQL
  Configuration:
    - Plan: Pro tier
    - Compute: 4GB RAM, 2 vCPUs
    - Storage: 100GB SSD
    - Backups: Daily automated
    - Point-in-time recovery: 7 days
    - Read replicas: 1 for analytics

Vector Database:
  Service: Hosted ChromaDB / Qdrant Cloud
  Configuration:
    - Memory: 8GB
    - Storage: 50GB
    - Replicas: 2
    - Backups: Daily

Object Storage:
  Service: MinIO / Cloudflare R2
  Configuration:
    - Storage: 1TB
    - Bandwidth: 100GB/month
    - CDN: Cloudflare
    - Backup: Cross-region replication

Cache Layer:
  Service: Redis Cloud
  Configuration:
    - Memory: 2GB
    - Persistence: AOF every 1s
    - Replication: Multi-AZ
    - Eviction: LRU
```

### Docker Configuration

```dockerfile
# Frontend Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

# Backend Dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y \
    gcc \
    tesseract-ocr \
    poppler-utils \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ragboard-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ragboard-api
  template:
    metadata:
      labels:
        app: ragboard-api
    spec:
      containers:
      - name: api
        image: ragboard/api:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ragboard-secrets
              key: database-url
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: ragboard-api-service
spec:
  selector:
    app: ragboard-api
  ports:
  - port: 80
    targetPort: 8000
  type: LoadBalancer
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          npm test
          npm run test:e2e
          python -m pytest

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      - name: Run OWASP dependency check
        uses: dependency-check/Dependency-Check_Action@main

  deploy-frontend:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: vercel/action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-backend:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### Monitoring & Observability

```yaml
Monitoring Stack:
  Metrics:
    - Prometheus + Grafana
    - Custom dashboards for:
      - API response times
      - WebSocket connections
      - AI model latency
      - Database performance
      - Cache hit rates
  
  Logging:
    - Centralized: LogDNA / DataDog
    - Log levels: ERROR, WARN, INFO, DEBUG
    - Structured logging (JSON)
    - Request correlation IDs
    - PII redaction
  
  Tracing:
    - OpenTelemetry
    - Jaeger for visualization
    - Trace critical paths:
      - User authentication
      - AI pipeline
      - File processing
      - Real-time sync
  
  Alerts:
    - PagerDuty integration
    - Alert conditions:
      - API errors > 1%
      - Response time > 2s
      - Database connections > 80%
      - Memory usage > 90%
      - Disk space < 10%
  
  Uptime Monitoring:
    - Pingdom / UptimeRobot
    - Status page: status.ragboard.com
    - Health checks every 60s
    - Multi-region monitoring
```

### Backup & Disaster Recovery

```yaml
Backup Strategy:
  Database:
    - Automated daily backups
    - Point-in-time recovery (7 days)
    - Cross-region replication
    - Monthly backup testing
  
  File Storage:
    - Continuous replication
    - Version history (30 days)
    - Immutable backups
  
  Configuration:
    - Infrastructure as Code (Terraform)
    - Encrypted secret storage
    - Version controlled
  
Recovery Objectives:
  - RTO (Recovery Time): < 1 hour
  - RPO (Recovery Point): < 15 minutes
  
Disaster Recovery Plan:
  1. Automated failover to secondary region
  2. Database restore from latest backup
  3. File storage sync from replica
  4. DNS update to new endpoints
  5. Health verification
  6. User notification
```

### Performance Optimization

```yaml
Frontend:
  - Code splitting by route
  - Lazy loading for heavy components
  - Image optimization (WebP, AVIF)
  - Service Worker caching
  - Preload critical resources
  - Bundle size budget: 200KB

Backend:
  - Database query optimization
  - Connection pooling
  - Redis caching strategy
  - Async processing
  - Rate limiting
  - Response compression

CDN Configuration:
  - Cloudflare Pro
  - Cache static assets
  - Edge workers for API routing
  - DDoS protection
  - WAF rules
```

### Compliance & Regulations

```yaml
GDPR Compliance:
  - Data minimization
  - Right to deletion
  - Data portability
  - Consent management
  - Privacy by design
  - Data processing agreements

SOC 2 Requirements:
  - Access controls
  - Encryption standards
  - Audit logging
  - Incident response
  - Vendor management
  - Security training

HIPAA Considerations:
  - PHI encryption
  - Access audit trails
  - BAA agreements
  - Minimum necessary rule
  - Breach notification
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Security audit completed
- [ ] Penetration testing passed
- [ ] Load testing completed
- [ ] Backup procedures tested
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] SSL certificates valid
- [ ] Environment variables set
- [ ] Database migrations ready
- [ ] API rate limits configured

### Deployment
- [ ] Blue-green deployment setup
- [ ] Database backup taken
- [ ] Frontend deployed to CDN
- [ ] Backend services deployed
- [ ] WebSocket servers running
- [ ] Background workers active
- [ ] Health checks passing
- [ ] Smoke tests passed
- [ ] Monitoring active
- [ ] Rollback plan ready

### Post-Deployment
- [ ] User acceptance testing
- [ ] Performance benchmarks met
- [ ] Security scans clean
- [ ] Documentation published
- [ ] Team training completed
- [ ] Support channels ready
- [ ] Analytics tracking verified
- [ ] Backup verification
- [ ] Incident response tested
- [ ] Go-live announcement

---

*This document provides comprehensive security and deployment requirements for RAGBOARD, ensuring a secure, scalable, and reliable production environment.*