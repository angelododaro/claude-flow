# Deployment and Monitoring Guide for RAGBOARD

## Overview
This guide covers production deployment, monitoring, and maintenance strategies for ragboard with all integrated open-source tools.

## Production Architecture

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  # Frontend (React + Vite)
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    environment:
      - VITE_API_URL=${API_URL}
      - VITE_WS_URL=${WS_URL}
      - VITE_POSTHOG_KEY=${POSTHOG_KEY}
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend

  # Backend (FastAPI)
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - SECRET_KEY=${SECRET_KEY}
    volumes:
      - ./uploads:/app/uploads
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  # PostgreSQL
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=ragboard
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Redis
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  # Yjs WebSocket Server
  yjs-server:
    build:
      context: ./yjs-server
      dockerfile: Dockerfile
    environment:
      - PORT=1234
      - REDIS_URL=${REDIS_URL}
    ports:
      - "1234:1234"
    depends_on:
      - redis

  # PostHog (Self-hosted analytics)
  posthog:
    image: posthog/posthog:latest
    environment:
      - SECRET_KEY=${POSTHOG_SECRET_KEY}
      - DATABASE_URL=${POSTHOG_DATABASE_URL}
    depends_on:
      - posthog-db
      - posthog-redis

  # Celery Worker
  celery:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.core.celery_app worker -l info
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - backend
      - redis

volumes:
  postgres_data:
  redis_data:
  posthog_data:
```

## 1. Frontend Deployment

### Optimized Frontend Build (Dockerfile.frontend)

```dockerfile
# Multi-stage build for optimized production image
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source files
COPY . .

# Build with optimizations
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration (nginx.conf)

```nginx
server {
    listen 80;
    server_name ragboard.com;
    
    # Force HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ragboard.com;
    
    # SSL configuration
    ssl_certificate /etc/ssl/certs/ragboard.crt;
    ssl_certificate_key /etc/ssl/private/ragboard.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://app.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:;" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;
    
    # Root directory
    root /usr/share/nginx/html;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket proxy for Yjs
    location /yjs {
        proxy_pass http://yjs-server:1234;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 2. Backend Deployment

### Backend Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Run with Gunicorn for production
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "4", \
     "--bind", "0.0.0.0:8000", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
```

## 3. Monitoring Setup

### Prometheus Configuration (prometheus.yml)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # FastAPI metrics
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  # PostgreSQL exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Node exporter for system metrics
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

### Application Metrics (backend/app/core/metrics.py)

```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi import Response
import time
from functools import wraps

# Define metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

active_users = Gauge(
    'active_users_total',
    'Number of active users'
)

board_operations_total = Counter(
    'board_operations_total',
    'Total board operations',
    ['operation', 'status']
)

ai_tokens_used = Counter(
    'ai_tokens_used_total',
    'Total AI tokens consumed',
    ['model']
)

websocket_connections = Gauge(
    'websocket_connections_active',
    'Active WebSocket connections'
)

# Middleware for automatic metrics
async def metrics_middleware(request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    
    http_requests_total.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    http_request_duration_seconds.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    return response

# Metrics endpoint
async def metrics_endpoint():
    return Response(
        content=generate_latest(),
        media_type="text/plain"
    )

# Decorator for tracking specific operations
def track_operation(operation_name):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                result = await func(*args, **kwargs)
                board_operations_total.labels(
                    operation=operation_name,
                    status='success'
                ).inc()
                return result
            except Exception as e:
                board_operations_total.labels(
                    operation=operation_name,
                    status='error'
                ).inc()
                raise
        return wrapper
    return decorator
```

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "RAGBOARD Production Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "rate(http_requests_total[5m])",
          "legendFormat": "{{method}} {{endpoint}}"
        }]
      },
      {
        "title": "Response Time (95th percentile)",
        "targets": [{
          "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
          "legendFormat": "{{endpoint}}"
        }]
      },
      {
        "title": "Active Users",
        "targets": [{
          "expr": "active_users_total"
        }]
      },
      {
        "title": "AI Token Usage",
        "targets": [{
          "expr": "rate(ai_tokens_used_total[1h])",
          "legendFormat": "{{model}}"
        }]
      },
      {
        "title": "WebSocket Connections",
        "targets": [{
          "expr": "websocket_connections_active"
        }]
      },
      {
        "title": "Error Rate",
        "targets": [{
          "expr": "rate(http_requests_total{status=~'5..'}[5m])"
        }]
      }
    ]
  }
}
```

## 4. Logging and Tracing

### Structured Logging (backend/app/core/logging.py)

```python
import logging
import json
from pythonjsonlogger import jsonlogger
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Configure structured logging
def setup_logging():
    logHandler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        fmt='%(timestamp)s %(level)s %(name)s %(message)s',
        timestamp=True
    )
    logHandler.setFormatter(formatter)
    
    logger = logging.getLogger()
    logger.addHandler(logHandler)
    logger.setLevel(logging.INFO)
    
    return logger

# Configure OpenTelemetry tracing
def setup_tracing():
    trace.set_tracer_provider(TracerProvider())
    tracer_provider = trace.get_tracer_provider()
    
    # Configure OTLP exporter (e.g., to Jaeger)
    otlp_exporter = OTLPSpanExporter(
        endpoint="http://jaeger:4317",
        insecure=True
    )
    
    span_processor = BatchSpanProcessor(otlp_exporter)
    tracer_provider.add_span_processor(span_processor)
    
    return trace.get_tracer(__name__)

# Request ID middleware
from starlette.middleware.base import BaseHTTPMiddleware
import uuid

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        logger = logging.getLogger(__name__)
        logger.info({
            "event": "request_started",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client": request.client.host
        })
        
        response = await call_next(request)
        
        logger.info({
            "event": "request_completed",
            "request_id": request_id,
            "status_code": response.status_code
        })
        
        response.headers["X-Request-ID"] = request_id
        return response
```

### Error Tracking with Sentry

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

def setup_sentry():
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.1,  # 10% of transactions
        profiles_sample_rate=0.1,  # 10% profiling
        environment=settings.ENVIRONMENT,
        release=settings.APP_VERSION,
        before_send=filter_sensitive_data,
    )

def filter_sensitive_data(event, hint):
    # Remove sensitive data before sending to Sentry
    if 'request' in event and 'headers' in event['request']:
        event['request']['headers'] = {
            k: v for k, v in event['request']['headers'].items()
            if k.lower() not in ['authorization', 'cookie', 'x-api-key']
        }
    return event
```

## 5. Health Checks and Readiness

### Comprehensive Health Check (backend/app/api/endpoints/health.py)

```python
from fastapi import APIRouter, status
from app.db.session import SessionLocal
from app.core.config import settings
import redis
import httpx
from datetime import datetime

router = APIRouter()

@router.get("/health")
async def health_check():
    """Basic health check"""
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@router.get("/health/ready")
async def readiness_check():
    """Detailed readiness check"""
    checks = {
        "database": False,
        "redis": False,
        "storage": False,
        "ai_service": False,
    }
    
    # Check database
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        checks["database"] = True
    except Exception as e:
        pass
    
    # Check Redis
    try:
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        checks["redis"] = True
    except Exception:
        pass
    
    # Check S3/Storage
    try:
        # Check if storage is accessible
        # boto3 client check here
        checks["storage"] = True
    except Exception:
        pass
    
    # Check AI service
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                timeout=5.0
            )
            checks["ai_service"] = response.status_code == 200
    except Exception:
        pass
    
    all_healthy = all(checks.values())
    
    return {
        "status": "ready" if all_healthy else "not ready",
        "checks": checks,
        "timestamp": datetime.utcnow()
    }
```

## 6. Backup and Disaster Recovery

### Automated Backup Script (scripts/backup.sh)

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/backups"
S3_BUCKET="ragboard-backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Database backup
echo "Backing up PostgreSQL..."
PGPASSWORD=$DB_PASSWORD pg_dump \
  -h postgres \
  -U $DB_USER \
  -d ragboard \
  -f "$BACKUP_DIR/db_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/db_$DATE.sql"

# Backup uploads directory
echo "Backing up uploads..."
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" /app/uploads

# Upload to S3
echo "Uploading to S3..."
aws s3 cp "$BACKUP_DIR/db_$DATE.sql.gz" "s3://$S3_BUCKET/db/"
aws s3 cp "$BACKUP_DIR/uploads_$DATE.tar.gz" "s3://$S3_BUCKET/uploads/"

# Clean up old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete
aws s3 ls "s3://$S3_BUCKET/db/" | \
  awk '{print $4}' | \
  while read -r file; do
    if [[ $(aws s3api head-object --bucket $S3_BUCKET --key "db/$file" \
      --query "LastModified" --output text | \
      xargs -I {} date -d {} +%s) -lt $(date -d "$RETENTION_DAYS days ago" +%s) ]]; then
      aws s3 rm "s3://$S3_BUCKET/db/$file"
    fi
  done

echo "Backup completed successfully"
```

### Restore Procedure

```bash
#!/bin/bash

# Restore from backup
BACKUP_DATE=$1

# Download from S3
aws s3 cp "s3://$S3_BUCKET/db/db_$BACKUP_DATE.sql.gz" /tmp/
aws s3 cp "s3://$S3_BUCKET/uploads/uploads_$BACKUP_DATE.tar.gz" /tmp/

# Restore database
gunzip /tmp/db_$BACKUP_DATE.sql.gz
PGPASSWORD=$DB_PASSWORD psql \
  -h postgres \
  -U $DB_USER \
  -d ragboard \
  -f /tmp/db_$BACKUP_DATE.sql

# Restore uploads
tar -xzf /tmp/uploads_$BACKUP_DATE.tar.gz -C /

echo "Restore completed"
```

## 7. Performance Monitoring

### Custom Performance Metrics (frontend/src/utils/performance.ts)

```typescript
class PerformanceMonitor {
  private observer: PerformanceObserver;

  constructor() {
    this.setupObserver();
    this.measureCoreWebVitals();
  }

  private setupObserver() {
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Send to analytics
        posthog.capture('performance_metric', {
          metric_name: entry.name,
          duration: entry.duration,
          entry_type: entry.entryType,
        });
      }
    });

    this.observer.observe({ entryTypes: ['measure', 'navigation'] });
  }

  private measureCoreWebVitals() {
    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      posthog.capture('web_vital', {
        metric: 'LCP',
        value: lastEntry.renderTime || lastEntry.loadTime,
      });
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // First Input Delay
    new PerformanceObserver((list) => {
      const firstInput = list.getEntries()[0];
      posthog.capture('web_vital', {
        metric: 'FID',
        value: firstInput.processingStart - firstInput.startTime,
      });
    }).observe({ type: 'first-input', buffered: true });

    // Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      posthog.capture('web_vital', {
        metric: 'CLS',
        value: clsValue,
      });
    }).observe({ type: 'layout-shift', buffered: true });
  }

  measureBoardOperation(operation: string, fn: () => Promise<any>) {
    const startMark = `${operation}-start`;
    const endMark = `${operation}-end`;
    const measureName = `${operation}-duration`;

    performance.mark(startMark);
    
    return fn().finally(() => {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
    });
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

## 8. Deployment Checklist

### Pre-deployment

- [ ] All tests passing (unit, integration, E2E)
- [ ] Security scan completed (OWASP ZAP, Snyk)
- [ ] Performance benchmarks met
- [ ] Database migrations tested
- [ ] Backup procedure verified
- [ ] Monitoring dashboards configured
- [ ] Load testing completed
- [ ] SSL certificates valid

### Deployment Steps

1. **Blue-Green Deployment**
   ```bash
   # Deploy to green environment
   docker-compose -f docker-compose.green.yml up -d
   
   # Run smoke tests
   ./scripts/smoke-tests.sh green
   
   # Switch traffic
   ./scripts/switch-traffic.sh green
   
   # Monitor for issues (30 minutes)
   
   # If issues, rollback
   ./scripts/switch-traffic.sh blue
   ```

2. **Database Migration**
   ```bash
   # Run migrations in transaction
   alembic upgrade head
   
   # Verify migration
   alembic current
   ```

3. **Cache Warming**
   ```bash
   # Warm up caches
   python scripts/warm_cache.py
   ```

### Post-deployment

- [ ] Verify all health checks passing
- [ ] Check error rates in monitoring
- [ ] Verify key user flows working
- [ ] Check performance metrics
- [ ] Monitor for anomalies (24 hours)
- [ ] Update status page

## 9. Incident Response

### Runbook Template

```markdown
# Service Degradation Runbook

## Symptoms
- Response time > 2s for API calls
- Error rate > 1%
- WebSocket disconnections

## Diagnosis Steps
1. Check Grafana dashboard for anomalies
2. Check recent deployments
3. Review error logs in Kibana
4. Check database connections
5. Verify external service status

## Mitigation Steps
1. Enable circuit breakers
2. Increase cache TTL
3. Scale up services
4. Enable read-only mode if needed

## Escalation
- On-call engineer: +1-XXX-XXX-XXXX
- Engineering lead: +1-XXX-XXX-XXXX
```

This completes the comprehensive deployment and monitoring guide for ragboard with all integrated tools.