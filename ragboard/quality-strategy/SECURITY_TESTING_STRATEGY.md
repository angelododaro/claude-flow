# Security Testing Strategy for RAGBOARD

## Overview

Security testing ensures RAGBOARD protects user data, prevents unauthorized access, and maintains system integrity against various attack vectors.

## Security Requirements

### Authentication & Authorization
- Secure user authentication (JWT/OAuth2)
- Role-based access control (RBAC)
- Multi-factor authentication (MFA)
- Session management
- Password policies

### Data Protection
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- PII data handling
- GDPR compliance
- Data retention policies

### Application Security
- Input validation
- SQL injection prevention
- XSS protection
- CSRF protection
- File upload security
- API rate limiting

### Infrastructure Security
- Secure configuration
- Network segmentation
- Container security
- Secrets management
- Logging and monitoring

## Security Testing Tools

### Static Application Security Testing (SAST)

1. **Frontend (JavaScript/TypeScript)**
   - ESLint security plugins
   - Semgrep
   - SonarQube
   - npm audit

2. **Backend (Python)**
   - Bandit
   - Safety
   - PyLint security checks
   - pip-audit

### Dynamic Application Security Testing (DAST)

1. **OWASP ZAP**
   - Automated scanning
   - API testing
   - Active/passive scanning

2. **Burp Suite**
   - Manual penetration testing
   - Advanced exploitation

### Dependency Scanning

1. **Snyk**
   - Vulnerability detection
   - License compliance
   - Container scanning

2. **Dependabot**
   - Automated updates
   - Security alerts

## Security Test Implementation

### 1. Authentication Security Tests

```python
# tests/security/test_authentication.py
import pytest
import jwt
import time
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token, verify_password

client = TestClient(app)

class TestAuthenticationSecurity:
    def test_password_hashing_security(self):
        """Test password hashing uses secure algorithm."""
        password = "SecurePassword123!"
        from app.core.security import get_password_hash
        
        hashed = get_password_hash(password)
        
        # Should use bcrypt or argon2
        assert hashed.startswith('$2b$') or hashed.startswith('$argon2')
        
        # Hash should be different each time (salt)
        hashed2 = get_password_hash(password)
        assert hashed != hashed2
        
        # Both should verify correctly
        assert verify_password(password, hashed)
        assert verify_password(password, hashed2)
    
    def test_jwt_token_security(self):
        """Test JWT token security features."""
        token = create_access_token({"sub": "user-123"})
        
        # Decode token
        decoded = jwt.decode(
            token, 
            options={"verify_signature": False}
        )
        
        # Check required claims
        assert "exp" in decoded  # Expiration
        assert "iat" in decoded  # Issued at
        assert "jti" in decoded  # JWT ID (for revocation)
        
        # Check expiration time (should be reasonable)
        exp_time = datetime.fromtimestamp(decoded["exp"])
        iat_time = datetime.fromtimestamp(decoded["iat"])
        token_lifetime = exp_time - iat_time
        
        # Token should expire within 1 hour
        assert token_lifetime <= timedelta(hours=1)
    
    def test_brute_force_protection(self):
        """Test login rate limiting."""
        # Attempt multiple failed logins
        for i in range(6):
            response = client.post(
                "/api/v1/auth/login",
                json={
                    "email": "test@example.com",
                    "password": f"wrong{i}"
                }
            )
        
        # Should be rate limited after 5 attempts
        assert response.status_code == 429
        assert "rate limit" in response.json()["detail"].lower()
    
    def test_session_fixation_prevention(self):
        """Test session fixation attack prevention."""
        # Login with valid credentials
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "testpass123"
            }
        )
        
        token1 = response.json()["access_token"]
        
        # Login again
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "testpass123"
            }
        )
        
        token2 = response.json()["access_token"]
        
        # Tokens should be different (new session)
        assert token1 != token2
    
    def test_token_replay_attack_prevention(self):
        """Test token replay attack prevention."""
        token = create_access_token({"sub": "user-123"})
        
        # Use token
        response = client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        # Simulate token revocation
        client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Token should no longer work
        response = client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401
```

### 2. Input Validation Security Tests

```python
# tests/security/test_input_validation.py
import pytest
from fastapi.testclient import TestClient

class TestInputValidation:
    @pytest.mark.parametrize("malicious_input", [
        "<script>alert('XSS')</script>",
        "javascript:alert('XSS')",
        "<img src=x onerror=alert('XSS')>",
        "<svg/onload=alert('XSS')>",
        "'><script>alert(String.fromCharCode(88,83,83))</script>",
    ])
    def test_xss_prevention(self, client, auth_headers, malicious_input):
        """Test XSS attack prevention."""
        response = client.post(
            "/api/v1/boards",
            json={
                "title": malicious_input,
                "description": f"Description with {malicious_input}"
            },
            headers=auth_headers
        )
        
        if response.status_code == 200:
            board = response.json()
            # Check that input is properly escaped
            assert "<script>" not in board["title"]
            assert "javascript:" not in board["description"]
            assert "onerror=" not in str(board)
    
    @pytest.mark.parametrize("sql_injection", [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "1'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "1 UNION SELECT * FROM users",
    ])
    def test_sql_injection_prevention(self, client, auth_headers, sql_injection):
        """Test SQL injection prevention."""
        # Try SQL injection in search
        response = client.get(
            f"/api/v1/search?q={sql_injection}",
            headers=auth_headers
        )
        
        # Should not cause error or return unauthorized data
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            # Should return empty or filtered results
            results = response.json()
            assert isinstance(results, list) or isinstance(results, dict)
    
    def test_path_traversal_prevention(self, client, auth_headers):
        """Test path traversal attack prevention."""
        malicious_paths = [
            "../../etc/passwd",
            "..\\..\\windows\\system32\\config\\sam",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
            "....//....//....//etc/passwd",
        ]
        
        for path in malicious_paths:
            response = client.get(
                f"/api/v1/files/{path}",
                headers=auth_headers
            )
            
            # Should be rejected
            assert response.status_code in [400, 403, 404]
            assert "/etc/passwd" not in str(response.content)
    
    def test_command_injection_prevention(self, client, auth_headers):
        """Test command injection prevention."""
        malicious_commands = [
            "test.pdf; rm -rf /",
            "test.pdf && cat /etc/passwd",
            "test.pdf`cat /etc/passwd`",
            "test.pdf$(cat /etc/passwd)",
        ]
        
        for filename in malicious_commands:
            response = client.post(
                "/api/v1/process-file",
                json={"filename": filename},
                headers=auth_headers
            )
            
            # Should sanitize or reject
            assert response.status_code in [400, 422]
```

### 3. API Security Tests

```python
# tests/security/test_api_security.py
import pytest
import time
from fastapi.testclient import TestClient

class TestAPISecurity:
    def test_cors_configuration(self, client):
        """Test CORS is properly configured."""
        response = client.options(
            "/api/v1/boards",
            headers={
                "Origin": "https://evil-site.com",
                "Access-Control-Request-Method": "POST"
            }
        )
        
        # Should not allow arbitrary origins
        assert response.headers.get("Access-Control-Allow-Origin") != "*"
        assert "evil-site.com" not in response.headers.get(
            "Access-Control-Allow-Origin", ""
        )
    
    def test_api_versioning_security(self, client):
        """Test API versioning doesn't expose old vulnerable endpoints."""
        # Try to access deprecated API versions
        old_versions = ["/api/v0/", "/api/beta/", "/api/"]
        
        for version in old_versions:
            response = client.get(f"{version}users")
            assert response.status_code == 404
    
    def test_rate_limiting(self, client, auth_headers):
        """Test API rate limiting."""
        # Make many requests quickly
        responses = []
        for _ in range(150):
            response = client.get(
                "/api/v1/boards",
                headers=auth_headers
            )
            responses.append(response.status_code)
        
        # Should hit rate limit
        assert 429 in responses
    
    def test_api_key_security(self, client):
        """Test API key security requirements."""
        # Test weak API key
        response = client.post(
            "/api/v1/api-keys",
            json={"name": "test-key"},
            headers={"Authorization": "Bearer valid-token"}
        )
        
        if response.status_code == 200:
            api_key = response.json()["key"]
            
            # API key should be sufficiently long and random
            assert len(api_key) >= 32
            # Should contain mix of characters
            assert any(c.isupper() for c in api_key)
            assert any(c.islower() for c in api_key)
            assert any(c.isdigit() for c in api_key)
```

### 4. File Upload Security Tests

```python
# tests/security/test_file_upload_security.py
import pytest
import io
from fastapi.testclient import TestClient

class TestFileUploadSecurity:
    def test_file_type_validation(self, client, auth_headers):
        """Test dangerous file types are rejected."""
        dangerous_files = [
            ("malware.exe", b"MZ\x90\x00", "application/x-msdownload"),
            ("script.js", b"alert('XSS')", "application/javascript"),
            ("shell.php", b"<?php system($_GET['cmd']); ?>", "application/x-php"),
            ("payload.jsp", b"<%@ page import=\"java.io.*\" %>", "application/x-jsp"),
        ]
        
        for filename, content, mimetype in dangerous_files:
            files = {
                "file": (filename, io.BytesIO(content), mimetype)
            }
            
            response = client.post(
                "/api/v1/upload",
                files=files,
                headers={"Authorization": auth_headers["Authorization"]}
            )
            
            # Should reject dangerous files
            assert response.status_code in [400, 415]
            assert "not allowed" in response.json()["detail"].lower()
    
    def test_file_size_limits(self, client, auth_headers):
        """Test file size limits are enforced."""
        # Create large file (101MB)
        large_content = b"X" * (101 * 1024 * 1024)
        
        files = {
            "file": ("large.pdf", io.BytesIO(large_content), "application/pdf")
        }
        
        response = client.post(
            "/api/v1/upload",
            files=files,
            headers={"Authorization": auth_headers["Authorization"]}
        )
        
        # Should reject files over limit
        assert response.status_code == 413
        assert "too large" in response.json()["detail"].lower()
    
    def test_filename_sanitization(self, client, auth_headers):
        """Test malicious filenames are sanitized."""
        malicious_names = [
            "../../../etc/passwd",
            "..\\..\\windows\\system32\\config\\sam",
            "file.pdf.exe",
            "file\x00.pdf",
            "file;rm -rf /.pdf",
        ]
        
        for filename in malicious_names:
            files = {
                "file": (filename, io.BytesIO(b"test content"), "application/pdf")
            }
            
            response = client.post(
                "/api/v1/upload",
                files=files,
                headers={"Authorization": auth_headers["Authorization"]}
            )
            
            if response.status_code == 200:
                # Check filename was sanitized
                stored_name = response.json()["filename"]
                assert ".." not in stored_name
                assert "\\" not in stored_name
                assert ";" not in stored_name
                assert "\x00" not in stored_name
    
    def test_zip_bomb_protection(self, client, auth_headers):
        """Test protection against zip bombs."""
        # Create a compressed file that expands significantly
        import zipfile
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Create a file that compresses well
            large_content = b"0" * (50 * 1024 * 1024)  # 50MB of zeros
            zf.writestr("large.txt", large_content)
        
        zip_buffer.seek(0)
        
        files = {
            "file": ("archive.zip", zip_buffer, "application/zip")
        }
        
        response = client.post(
            "/api/v1/upload",
            files=files,
            headers={"Authorization": auth_headers["Authorization"]}
        )
        
        # Should detect and reject zip bombs
        if response.status_code == 200:
            # Check that extraction is limited
            assert response.json()["extracted_size"] < 100 * 1024 * 1024
```

### 5. OWASP Top 10 Security Tests

```python
# tests/security/test_owasp_top10.py
import pytest
from fastapi.testclient import TestClient

class TestOWASPTop10:
    def test_broken_access_control(self, client):
        """Test for broken access control (A01:2021)."""
        # Create two users
        user1_token = self.create_user_and_login(client, "user1@test.com")
        user2_token = self.create_user_and_login(client, "user2@test.com")
        
        # User1 creates a private board
        response = client.post(
            "/api/v1/boards",
            json={"title": "Private Board", "is_public": False},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        board_id = response.json()["id"]
        
        # User2 tries to access User1's private board
        response = client.get(
            f"/api/v1/boards/{board_id}",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        # Should be forbidden
        assert response.status_code == 403
    
    def test_cryptographic_failures(self, client):
        """Test for cryptographic failures (A02:2021)."""
        # Test that sensitive data is encrypted
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "crypto@test.com",
                "password": "TestPassword123!"
            }
        )
        
        # Check database directly (in real test)
        # Password should be hashed, not plain text
        # assert user.password != "TestPassword123!"
        # assert user.password.startswith("$2b$") or user.password.startswith("$argon2")
    
    def test_injection(self, client, auth_headers):
        """Test for injection vulnerabilities (A03:2021)."""
        # NoSQL injection attempt
        response = client.post(
            "/api/v1/search",
            json={
                "query": {"$ne": None},  # MongoDB injection attempt
                "filter": {"$where": "this.password.length > 0"}
            },
            headers=auth_headers
        )
        
        # Should handle safely
        assert response.status_code in [200, 400, 422]
        if response.status_code == 200:
            # Should not return all documents
            assert len(response.json()["results"]) < 100
    
    def test_insecure_design(self, client):
        """Test for insecure design (A04:2021)."""
        # Test rate limiting on sensitive operations
        for i in range(10):
            response = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": f"test{i}@example.com"}
            )
        
        # Should implement rate limiting
        assert response.status_code == 429
    
    def test_security_misconfiguration(self, client):
        """Test for security misconfiguration (A05:2021)."""
        # Test that debug mode is disabled
        response = client.get("/debug")
        assert response.status_code == 404
        
        # Test that error messages don't leak information
        response = client.get("/api/v1/cause-error")
        if response.status_code == 500:
            error = response.json()
            assert "Traceback" not in str(error)
            assert "File " not in str(error)
            assert "line " not in str(error)
    
    def test_vulnerable_components(self):
        """Test for vulnerable and outdated components (A06:2021)."""
        import subprocess
        
        # Run security audit
        result = subprocess.run(
            ["npm", "audit", "--json"],
            capture_output=True,
            text=True
        )
        
        audit_data = json.loads(result.stdout)
        
        # No high or critical vulnerabilities
        assert audit_data.get("metadata", {}).get("vulnerabilities", {}).get("high", 0) == 0
        assert audit_data.get("metadata", {}).get("vulnerabilities", {}).get("critical", 0) == 0
    
    def test_identification_failures(self, client):
        """Test for identification and authentication failures (A07:2021)."""
        # Test account enumeration prevention
        response1 = client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "wrongpass"
            }
        )
        
        response2 = client.post(
            "/api/v1/auth/login",
            json={
                "email": "existing@example.com",
                "password": "wrongpass"
            }
        )
        
        # Error messages should be identical
        assert response1.json()["detail"] == response2.json()["detail"]
        assert "Invalid credentials" in response1.json()["detail"]
    
    def test_data_integrity_failures(self, client, auth_headers):
        """Test for software and data integrity failures (A08:2021)."""
        # Test that data tampering is detected
        response = client.get(
            "/api/v1/boards/test-board",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            # Verify response includes integrity check
            assert "etag" in response.headers or "x-content-hash" in response.headers
    
    def test_security_logging_monitoring(self, client):
        """Test for security logging and monitoring failures (A09:2021)."""
        # Attempt suspicious activity
        for i in range(5):
            client.post(
                "/api/v1/auth/login",
                json={
                    "email": "attacker@evil.com",
                    "password": f"attempt{i}"
                }
            )
        
        # Check that security events are logged
        # In real test, would check log files or monitoring system
        # assert security_event_logged("multiple_failed_logins")
    
    def test_ssrf(self, client, auth_headers):
        """Test for Server-Side Request Forgery (A10:2021)."""
        # Try to make server request internal resources
        ssrf_urls = [
            "http://localhost:8000/admin",
            "http://127.0.0.1:22",
            "http://169.254.169.254/latest/meta-data/",  # AWS metadata
            "file:///etc/passwd",
        ]
        
        for url in ssrf_urls:
            response = client.post(
                "/api/v1/fetch-url",
                json={"url": url},
                headers=auth_headers
            )
            
            # Should block internal requests
            assert response.status_code in [400, 403]
            assert "not allowed" in response.json()["detail"].lower()
```

## Security Testing in CI/CD

### GitHub Actions Security Workflow

```yaml
# .github/workflows/security-tests.yml
name: Security Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily security scan

jobs:
  dependency-scanning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/python@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
          
      - name: Run npm audit
        run: |
          cd ragboard
          npm audit --production
          
      - name: Run pip-audit
        run: |
          pip install pip-audit
          cd ragboard/backend
          pip-audit -r requirements.txt
  
  sast-scanning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Bandit security linter
        run: |
          pip install bandit
          bandit -r ragboard/backend/app -f json -o bandit-report.json
          
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/python
            p/javascript
            p/typescript
            p/react
            
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
  
  container-scanning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t ragboard:test .
        
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'ragboard:test'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
  
  dast-scanning:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          
    steps:
      - uses: actions/checkout@v3
      
      - name: Start application
        run: |
          docker-compose up -d
          sleep 30  # Wait for app to start
          
      - name: Run OWASP ZAP scan
        uses: zaproxy/action-full-scan@v0.4.0
        with:
          target: 'http://localhost:8000'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'
          
      - name: Run Nuclei security scanner
        run: |
          docker run --rm -v $(pwd):/app projectdiscovery/nuclei \
            -u http://localhost:8000 \
            -t cves/ -t exposures/ -t vulnerabilities/ \
            -severity critical,high,medium
  
  security-unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          
      - name: Install dependencies
        run: |
          cd ragboard/backend
          pip install -r requirements.txt
          pip install -r requirements-test.txt
          
      - name: Run security tests
        run: |
          cd ragboard/backend
          pytest tests/security/ -v --cov=app --cov-report=xml
          
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./ragboard/backend/coverage.xml
          flags: security-tests
```

## Security Headers Configuration

```python
# app/middleware/security.py
from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import hashlib
import secrets

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Generate nonce for CSP
        nonce = secrets.token_urlsafe(16)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )
        
        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            f"default-src 'self'; "
            f"script-src 'self' 'nonce-{nonce}' https://cdn.jsdelivr.net; "
            f"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            f"img-src 'self' data: https:; "
            f"font-src 'self' https://fonts.gstatic.com; "
            f"connect-src 'self' wss: https://api.openai.com; "
            f"frame-ancestors 'none'; "
            f"base-uri 'self'; "
            f"form-action 'self';"
        )
        
        # Add nonce to response for use in templates
        response.headers["X-Nonce"] = nonce
        
        return response

def setup_security_middleware(app: FastAPI):
    # HTTPS redirect in production
    if app.state.settings.ENVIRONMENT == "production":
        app.add_middleware(HTTPSRedirectMiddleware)
    
    # Trusted host validation
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=app.state.settings.ALLOWED_HOSTS
    )
    
    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)
```

## Security Monitoring & Alerting

```python
# app/monitoring/security_monitor.py
import logging
from datetime import datetime, timedelta
from typing import Dict, List
from collections import defaultdict
import asyncio

class SecurityMonitor:
    def __init__(self):
        self.failed_login_attempts: Dict[str, List[datetime]] = defaultdict(list)
        self.suspicious_activities: List[Dict] = []
        self.logger = logging.getLogger("security")
    
    async def log_failed_login(self, email: str, ip_address: str):
        """Track failed login attempts."""
        now = datetime.utcnow()
        self.failed_login_attempts[email].append(now)
        
        # Clean old attempts
        cutoff = now - timedelta(minutes=15)
        self.failed_login_attempts[email] = [
            attempt for attempt in self.failed_login_attempts[email]
            if attempt > cutoff
        ]
        
        # Check for brute force
        if len(self.failed_login_attempts[email]) >= 5:
            await self.alert_brute_force(email, ip_address)
    
    async def alert_brute_force(self, email: str, ip_address: str):
        """Alert on potential brute force attack."""
        alert = {
            "type": "brute_force",
            "email": email,
            "ip_address": ip_address,
            "timestamp": datetime.utcnow(),
            "attempts": len(self.failed_login_attempts[email])
        }
        
        self.logger.critical(f"Brute force attack detected: {alert}")
        await self.send_security_alert(alert)
    
    async def log_suspicious_file_upload(
        self, 
        user_id: str, 
        filename: str, 
        reason: str
    ):
        """Log suspicious file upload attempts."""
        event = {
            "type": "suspicious_file_upload",
            "user_id": user_id,
            "filename": filename,
            "reason": reason,
            "timestamp": datetime.utcnow()
        }
        
        self.suspicious_activities.append(event)
        self.logger.warning(f"Suspicious file upload: {event}")
        
        # Alert if pattern detected
        recent_suspicious = [
            e for e in self.suspicious_activities
            if e["timestamp"] > datetime.utcnow() - timedelta(minutes=5)
        ]
        
        if len(recent_suspicious) >= 3:
            await self.send_security_alert({
                "type": "multiple_suspicious_uploads",
                "count": len(recent_suspicious),
                "events": recent_suspicious
            })
    
    async def send_security_alert(self, alert: Dict):
        """Send security alert to monitoring system."""
        # Integration with monitoring service
        # Example: Send to Slack, email, SIEM, etc.
        pass
```

## Best Practices

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal permissions for all components
3. **Input Validation**: Validate all user inputs
4. **Output Encoding**: Encode all outputs
5. **Secure Defaults**: Security by default configuration
6. **Fail Securely**: Handle errors without exposing information
7. **Regular Updates**: Keep dependencies updated
8. **Security Training**: Regular security training for team
9. **Incident Response**: Have an incident response plan
10. **Continuous Monitoring**: Monitor for security events