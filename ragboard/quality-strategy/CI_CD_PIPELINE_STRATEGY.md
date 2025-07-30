# CI/CD Pipeline & Quality Gates Strategy

## Overview

This document outlines the comprehensive CI/CD pipeline strategy with integrated quality gates to ensure code quality, security, and performance standards are met before deployment.

## Pipeline Architecture

### Pipeline Stages

```mermaid
graph LR
    A[Commit] --> B[Pre-commit Hooks]
    B --> C[Build & Lint]
    C --> D[Unit Tests]
    D --> E[Integration Tests]
    E --> F[Security Scans]
    F --> G[Performance Tests]
    G --> H[E2E Tests]
    H --> I[Quality Gates]
    I --> J[Deploy to Staging]
    J --> K[Smoke Tests]
    K --> L[Deploy to Production]
```

## Pre-commit Hooks

### Husky Configuration

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS",
      "pre-push": "npm run test:unit"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --bail --findRelatedTests"
    ],
    "*.{py}": [
      "black",
      "isort",
      "flake8",
      "mypy"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

### Pre-commit Python Config

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-json
      - id: detect-private-key
      
  - repo: https://github.com/psf/black
    rev: 23.1.0
    hooks:
      - id: black
        language_version: python3.11
        
  - repo: https://github.com/pycqa/isort
    rev: 5.12.0
    hooks:
      - id: isort
        args: ["--profile", "black"]
        
  - repo: https://github.com/pycqa/flake8
    rev: 6.0.0
    hooks:
      - id: flake8
        args: ['--max-line-length=88', '--extend-ignore=E203']
        
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.0.1
    hooks:
      - id: mypy
        additional_dependencies: [types-all]
        
  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.4
    hooks:
      - id: bandit
        args: ['-ll']
        files: .py$
```

## GitHub Actions CI/CD Pipeline

### Main CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.11'
  COVERAGE_THRESHOLD: 80

jobs:
  code-quality:
    name: Code Quality Checks
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Full history for better analysis
          
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
          
      - name: Install frontend dependencies
        run: |
          cd ragboard
          npm ci
          
      - name: Install backend dependencies
        run: |
          cd ragboard/backend
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
          
      - name: Run frontend linting
        run: |
          cd ragboard
          npm run lint
          npm run type-check
          
      - name: Run backend linting
        run: |
          cd ragboard/backend
          black --check app/
          isort --check-only app/
          flake8 app/
          mypy app/
          
      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          
  frontend-tests:
    name: Frontend Tests
    runs-on: ubuntu-latest
    needs: code-quality
    
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          
      - name: Install dependencies
        run: |
          cd ragboard
          npm ci
          
      - name: Run unit tests
        run: |
          cd ragboard
          npm run test:unit -- --shard=${{ matrix.shard }}/4 --coverage
          
      - name: Upload coverage
        uses: actions/upload-artifact@v3
        with:
          name: frontend-coverage-${{ matrix.shard }}
          path: ragboard/coverage/
          
  backend-tests:
    name: Backend Tests
    runs-on: ubuntu-latest
    needs: code-quality
    
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ragboard_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
          
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
          
      - name: Install dependencies
        run: |
          cd ragboard/backend
          pip install -r requirements.txt
          pip install -r requirements-test.txt
          
      - name: Run migrations
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ragboard_test
        run: |
          cd ragboard/backend
          alembic upgrade head
          
      - name: Run unit tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ragboard_test
          REDIS_URL: redis://localhost:6379
        run: |
          cd ragboard/backend
          pytest tests/unit -v --cov=app --cov-report=xml --cov-report=html
          
      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ragboard_test
          REDIS_URL: redis://localhost:6379
        run: |
          cd ragboard/backend
          pytest tests/integration -v --cov=app --cov-append --cov-report=xml
          
      - name: Upload coverage
        uses: actions/upload-artifact@v3
        with:
          name: backend-coverage
          path: ragboard/backend/htmlcov/
          
  security-scan:
    name: Security Scanning
    runs-on: ubuntu-latest
    needs: [frontend-tests, backend-tests]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --fail-on=all
          
      - name: Run Trivy security scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
          
      - name: Run OWASP dependency check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'RAGBOARD'
          path: '.'
          format: 'HTML'
          args: >
            --enableRetired
            --enableExperimental
            
  performance-test:
    name: Performance Tests
    runs-on: ubuntu-latest
    needs: [frontend-tests, backend-tests]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup environment
        uses: ./.github/actions/setup-test-env
        
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
          
      - name: Run load tests
        run: |
          cd ragboard/performance_tests
          npm install -g k6
          k6 run api-load-test.js --out json=load-test-results.json
          
      - name: Check performance budgets
        run: |
          node scripts/check-performance-budgets.js
          
      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: |
            .lighthouseci/
            ragboard/performance_tests/load-test-results.json
            
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [security-scan, performance-test]
    
    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]
        
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup environment
        uses: ./.github/actions/setup-test-env
        
      - name: Install Playwright browsers
        run: |
          cd ragboard
          npx playwright install --with-deps ${{ matrix.browser }}
          
      - name: Run E2E tests
        run: |
          cd ragboard
          npm run test:e2e:${{ matrix.browser }}
          
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-results-${{ matrix.browser }}
          path: |
            ragboard/playwright-report/
            ragboard/test-results/
            
  quality-gates:
    name: Quality Gates Check
    runs-on: ubuntu-latest
    needs: [frontend-tests, backend-tests, security-scan, performance-test, e2e-tests]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Download all artifacts
        uses: actions/download-artifact@v3
        
      - name: Merge coverage reports
        run: |
          npm install -g nyc
          pip install coverage
          
          # Merge frontend coverage
          nyc merge frontend-coverage-* frontend-coverage.json
          nyc report --reporter=lcov --report-dir=frontend-coverage
          
          # Process backend coverage
          cd ragboard/backend
          coverage xml
          
      - name: Check coverage thresholds
        run: |
          node scripts/check-coverage.js \
            --frontend-threshold=${{ env.COVERAGE_THRESHOLD }} \
            --backend-threshold=${{ env.COVERAGE_THRESHOLD }}
            
      - name: SonarQube scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
          
      - name: Quality gate check
        uses: SonarSource/sonarqube-quality-gate-action@master
        timeout-minutes: 5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          
      - name: Generate quality report
        run: |
          node scripts/generate-quality-report.js \
            --output=quality-report.html
            
      - name: Upload quality report
        uses: actions/upload-artifact@v3
        with:
          name: quality-report
          path: quality-report.html
          
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs')
            const report = fs.readFileSync('quality-report.md', 'utf8')
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            })
```

### Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Pipeline

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  build-and-push:
    name: Build and Push Docker Images
    runs-on: ubuntu-latest
    
    outputs:
      frontend-image: ${{ steps.frontend.outputs.image }}
      backend-image: ${{ steps.backend.outputs.image }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
        
      - name: Login to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ secrets.REGISTRY_URL }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}
          
      - name: Build and push frontend
        id: frontend
        uses: docker/build-push-action@v4
        with:
          context: ./ragboard
          file: ./ragboard/Dockerfile
          push: true
          tags: |
            ${{ secrets.REGISTRY_URL }}/ragboard-frontend:${{ github.sha }}
            ${{ secrets.REGISTRY_URL }}/ragboard-frontend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
          
      - name: Build and push backend
        id: backend
        uses: docker/build-push-action@v4
        with:
          context: ./ragboard/backend
          file: ./ragboard/backend/Dockerfile
          push: true
          tags: |
            ${{ secrets.REGISTRY_URL }}/ragboard-backend:${{ github.sha }}
            ${{ secrets.REGISTRY_URL }}/ragboard-backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
          
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/develop' || github.event.inputs.environment == 'staging'
    environment:
      name: staging
      url: https://staging.ragboard.com
      
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.26.0'
          
      - name: Configure kubectl
        run: |
          echo "${{ secrets.STAGING_KUBECONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=$(pwd)/kubeconfig
          
      - name: Deploy to Kubernetes
        run: |
          helm upgrade --install ragboard ./helm/ragboard \
            --namespace=staging \
            --create-namespace \
            --set frontend.image.tag=${{ github.sha }} \
            --set backend.image.tag=${{ github.sha }} \
            --set environment=staging \
            --values ./helm/ragboard/values.staging.yaml \
            --wait
            
      - name: Run smoke tests
        run: |
          npm run test:smoke -- --url=https://staging.ragboard.com
          
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deployment completed'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build-and-push, deploy-staging]
    if: github.ref == 'refs/heads/main' || github.event.inputs.environment == 'production'
    environment:
      name: production
      url: https://ragboard.com
      
    steps:
      - uses: actions/checkout@v3
      
      - name: Create deployment
        uses: chrnorm/deployment-action@v2
        id: deployment
        with:
          token: ${{ github.token }}
          environment: production
          
      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.26.0'
          
      - name: Configure kubectl
        run: |
          echo "${{ secrets.PROD_KUBECONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=$(pwd)/kubeconfig
          
      - name: Blue-Green Deployment
        run: |
          # Deploy to green environment
          helm upgrade --install ragboard-green ./helm/ragboard \
            --namespace=production \
            --create-namespace \
            --set frontend.image.tag=${{ github.sha }} \
            --set backend.image.tag=${{ github.sha }} \
            --set environment=production \
            --set deployment.slot=green \
            --values ./helm/ragboard/values.production.yaml \
            --wait
            
          # Run smoke tests on green
          npm run test:smoke -- --url=https://green.ragboard.com
          
          # Switch traffic to green
          kubectl patch service ragboard-frontend \
            -n production \
            -p '{"spec":{"selector":{"deployment.slot":"green"}}}'
            
          kubectl patch service ragboard-backend \
            -n production \
            -p '{"spec":{"selector":{"deployment.slot":"green"}}}'
            
          # Wait for traffic switch
          sleep 30
          
          # Scale down blue deployment
          kubectl scale deployment ragboard-frontend-blue \
            -n production \
            --replicas=0
            
          kubectl scale deployment ragboard-backend-blue \
            -n production \
            --replicas=0
            
      - name: Update deployment status
        if: always()
        uses: chrnorm/deployment-status@v2
        with:
          token: ${{ github.token }}
          state: ${{ job.status }}
          deployment-id: ${{ steps.deployment.outputs.deployment_id }}
          
      - name: Rollback on failure
        if: failure()
        run: |
          # Switch traffic back to blue
          kubectl patch service ragboard-frontend \
            -n production \
            -p '{"spec":{"selector":{"deployment.slot":"blue"}}}'
            
          kubectl patch service ragboard-backend \
            -n production \
            -p '{"spec":{"selector":{"deployment.slot":"blue"}}}'
            
          # Scale up blue deployment
          kubectl scale deployment ragboard-frontend-blue \
            -n production \
            --replicas=3
            
          kubectl scale deployment ragboard-backend-blue \
            -n production \
            --replicas=3
```

## Quality Gate Configuration

### SonarQube Configuration

```properties
# sonar-project.properties
sonar.projectKey=ragboard
sonar.organization=ragboard-org
sonar.projectName=RAGBOARD
sonar.projectVersion=1.0

# Source paths
sonar.sources=ragboard/src,ragboard/backend/app
sonar.tests=ragboard/src/**/*.test.tsx,ragboard/backend/tests

# Exclusions
sonar.exclusions=**/*.test.tsx,**/*.spec.ts,**/node_modules/**,**/venv/**

# Coverage
sonar.javascript.lcov.reportPaths=ragboard/coverage/lcov.info
sonar.python.coverage.reportPaths=ragboard/backend/coverage.xml

# Quality Gates
sonar.qualitygate.wait=true
```

### Quality Gate Criteria

```javascript
// scripts/quality-gates.js
const qualityGates = {
  coverage: {
    overall: 80,
    newCode: 90,
    perFile: 70
  },
  
  codeSmells: {
    rating: 'A',
    maxNew: 0
  },
  
  bugs: {
    rating: 'A',
    maxNew: 0
  },
  
  vulnerabilities: {
    rating: 'A',
    maxNew: 0
  },
  
  securityHotspots: {
    reviewed: 100,
    maxNew: 0
  },
  
  duplications: {
    maxPercentage: 3,
    maxNewPercentage: 1
  },
  
  performance: {
    lighthouse: {
      performance: 90,
      accessibility: 95,
      bestPractices: 90,
      seo: 90
    },
    bundleSize: {
      maxSizeKB: 500,
      maxIncreasePercent: 5
    },
    loadTime: {
      maxSeconds: 3
    }
  },
  
  tests: {
    minPassing: 100,
    maxSkipped: 0,
    maxFlaky: 0
  }
}

module.exports = { qualityGates }
```

## Monitoring & Alerting

### Pipeline Monitoring Dashboard

```typescript
// monitoring/pipeline-dashboard.ts
import { DashboardConfig } from './types'

export const pipelineDashboard: DashboardConfig = {
  name: 'CI/CD Pipeline Monitoring',
  
  metrics: [
    {
      name: 'Build Success Rate',
      query: 'avg(github_actions_workflow_run_conclusion{conclusion="success"})',
      threshold: 0.95,
      unit: 'ratio'
    },
    {
      name: 'Average Build Time',
      query: 'avg(github_actions_workflow_run_duration_seconds)',
      threshold: 600,
      unit: 'seconds'
    },
    {
      name: 'Test Execution Time',
      query: 'avg(github_actions_job_duration_seconds{job_name=~".*test.*"})',
      threshold: 300,
      unit: 'seconds'
    },
    {
      name: 'Deployment Frequency',
      query: 'rate(deployments_total[1h])',
      threshold: 0.5,
      unit: 'per hour'
    },
    {
      name: 'Failed Deployments',
      query: 'sum(rate(deployments_total{status="failed"}[1h]))',
      threshold: 0,
      unit: 'count'
    }
  ],
  
  alerts: [
    {
      name: 'Pipeline Failure',
      condition: 'github_actions_workflow_run_conclusion{conclusion="failure"} > 0',
      severity: 'critical',
      channels: ['slack', 'pagerduty']
    },
    {
      name: 'Long Running Pipeline',
      condition: 'github_actions_workflow_run_duration_seconds > 1800',
      severity: 'warning',
      channels: ['slack']
    },
    {
      name: 'Quality Gate Failed',
      condition: 'sonarqube_quality_gate_status != 1',
      severity: 'critical',
      channels: ['slack', 'email']
    }
  ]
}
```

## Best Practices

1. **Fail Fast**: Catch issues early in the pipeline
2. **Parallel Execution**: Run independent jobs in parallel
3. **Caching**: Cache dependencies and build artifacts
4. **Incremental Testing**: Only test changed code when possible
5. **Clear Feedback**: Provide clear, actionable feedback
6. **Automated Rollback**: Implement automatic rollback on failure
7. **Feature Flags**: Use feature flags for gradual rollouts
8. **Monitoring**: Monitor pipeline performance and reliability
9. **Documentation**: Keep pipeline documentation up to date
10. **Security**: Secure secrets and credentials properly