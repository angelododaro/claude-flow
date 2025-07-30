# Performance Testing & Benchmarking Strategy

## Overview

Performance testing ensures RAGBOARD meets speed, scalability, and resource efficiency requirements across all user scenarios.

## Performance Requirements

### Frontend Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| First Contentful Paint (FCP) | < 1.8s | < 3s |
| Largest Contentful Paint (LCP) | < 2.5s | < 4s |
| First Input Delay (FID) | < 100ms | < 300ms |
| Cumulative Layout Shift (CLS) | < 0.1 | < 0.25 |
| Time to Interactive (TTI) | < 3.8s | < 7.3s |
| Total Blocking Time (TBT) | < 200ms | < 600ms |
| JavaScript Bundle Size | < 500KB | < 1MB |
| Initial Load Time (3G) | < 3s | < 5s |

### Backend Performance Targets

| Endpoint Type | p50 | p95 | p99 |
|--------------|-----|-----|-----|
| Simple GET | < 50ms | < 100ms | < 200ms |
| Complex Query | < 100ms | < 300ms | < 500ms |
| File Upload | < 1s | < 3s | < 5s |
| AI Chat Response | < 2s | < 5s | < 10s |
| WebSocket Latency | < 50ms | < 100ms | < 200ms |

### Scalability Targets

- Concurrent Users: 10,000+
- Requests per Second: 5,000+
- WebSocket Connections: 5,000+
- Database Queries/sec: 10,000+
- Vector Search QPS: 1,000+

## Performance Testing Tools

### Frontend Performance

1. **Lighthouse CI**
   - Automated performance audits
   - Core Web Vitals tracking
   - Performance budgets

2. **Web Vitals**
   - Real User Monitoring (RUM)
   - Field data collection
   - Performance analytics

3. **Bundle Analysis**
   - Webpack Bundle Analyzer
   - Source map explorer
   - Tree shaking validation

### Backend Performance

1. **Locust**
   - Load testing
   - Distributed testing
   - Real-time monitoring

2. **pytest-benchmark**
   - Micro-benchmarks
   - Regression detection
   - Statistical analysis

3. **k6**
   - API load testing
   - Scenario testing
   - Cloud scaling

## Frontend Performance Testing

### Lighthouse CI Configuration

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:5173/',
        'http://localhost:5173/boards/sample',
        'http://localhost:5173/dashboard',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttling: {
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 150,
          downloadThroughputKbps: 1638.4,
          uploadThroughputKbps: 675,
        },
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'max-potential-fid': ['error', { maxNumericValue: 100 }],
        'js-bundles': ['error', { maxSize: 512000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
```

### React Performance Profiling

```typescript
// src/utils/performance.ts
import { Profiler, ProfilerOnRenderCallback } from 'react'

interface PerformanceMetrics {
  componentName: string
  phase: 'mount' | 'update'
  actualDuration: number
  baseDuration: number
  startTime: number
  commitTime: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private observers: Map<string, PerformanceObserver> = new Map()

  startMonitoring() {
    // Monitor Long Tasks
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.warn('Long Task detected:', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name,
          })
          
          // Send to analytics
          this.reportMetric('long-task', {
            duration: entry.duration,
            timestamp: entry.startTime,
          })
        }
      })
      
      longTaskObserver.observe({ entryTypes: ['longtask'] })
      this.observers.set('longtask', longTaskObserver)
    }

    // Monitor Layout Shifts
    const clsObserver = new PerformanceObserver((list) => {
      let clsScore = 0
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsScore += (entry as any).value
        }
      }
      
      this.reportMetric('cls', { score: clsScore })
    })
    
    clsObserver.observe({ entryTypes: ['layout-shift'] })
    this.observers.set('cls', clsObserver)
  }

  onRender: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    const metric: PerformanceMetrics = {
      componentName: id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
    }
    
    this.metrics.push(metric)
    
    // Alert on slow renders
    if (actualDuration > 16) { // Over 1 frame at 60fps
      console.warn(`Slow render detected in ${id}:`, actualDuration)
    }
    
    // Report to analytics
    this.reportMetric('react-render', metric)
  }

  reportWebVitals(metric: any) {
    const { name, value, id } = metric
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Web Vital ${name}:`, value)
    }
    
    // Send to analytics endpoint
    this.reportMetric('web-vital', {
      metricName: name,
      value,
      id,
    })
  }

  private reportMetric(type: string, data: any) {
    // Queue metrics for batch sending
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, data, timestamp: Date.now() }),
        })
      })
    }
  }

  getMetrics() {
    return this.metrics
  }

  stop() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
  }
}

export const performanceMonitor = new PerformanceMonitor()

// HOC for performance profiling
export function withPerformanceProfiler<P extends object>(
  Component: React.ComponentType<P>,
  id: string
) {
  return (props: P) => (
    <Profiler id={id} onRender={performanceMonitor.onRender}>
      <Component {...props} />
    </Profiler>
  )
}
```

### Bundle Size Optimization

```javascript
// webpack.config.js
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const CompressionPlugin = require('compression-webpack-plugin')

module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    usedExports: true,
    sideEffects: false,
  },
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE ? 'server' : 'disabled',
    }),
    new CompressionPlugin({
      algorithm: 'brotli',
      test: /\.(js|css|html|svg)$/,
      threshold: 10240,
      minRatio: 0.8,
    }),
  ],
}
```

## Backend Performance Testing

### Locust Load Testing

```python
# performance_tests/locustfile.py
from locust import HttpUser, task, between, events
import json
import random
import time
from websocket import create_connection

class RAGBoardUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login and get auth token."""
        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "email": f"test{random.randint(1, 1000)}@example.com",
                "password": "testpass123"
            }
        )
        
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.headers = {}
    
    @task(3)
    def view_dashboard(self):
        """Load user dashboard."""
        with self.client.get(
            "/api/v1/users/dashboard",
            headers=self.headers,
            catch_response=True
        ) as response:
            if response.elapsed.total_seconds() > 0.5:
                response.failure(f"Dashboard too slow: {response.elapsed.total_seconds()}s")
    
    @task(5)
    def load_board(self):
        """Load a board with nodes."""
        board_id = random.choice(["board-1", "board-2", "board-3"])
        
        start_time = time.time()
        
        # Load board data
        board_response = self.client.get(
            f"/api/v1/boards/{board_id}",
            headers=self.headers
        )
        
        # Load nodes
        nodes_response = self.client.get(
            f"/api/v1/boards/{board_id}/nodes",
            headers=self.headers
        )
        
        total_time = time.time() - start_time
        
        if total_time > 1.0:
            events.request_failure.fire(
                request_type="Board Load",
                name="Complete Board Load",
                response_time=total_time * 1000,
                response_length=0,
                exception=f"Board load too slow: {total_time}s"
            )
    
    @task(4)
    def search_vectors(self):
        """Perform vector search."""
        queries = [
            "machine learning",
            "data analysis",
            "project management",
            "research methods"
        ]
        
        with self.client.post(
            "/api/v1/search/vectors",
            json={
                "query": random.choice(queries),
                "limit": 10,
                "threshold": 0.7
            },
            headers=self.headers,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                results = response.json()
                if len(results["results"]) == 0:
                    response.failure("No search results returned")
            
            # Fail if search takes too long
            if response.elapsed.total_seconds() > 0.3:
                response.failure(f"Search too slow: {response.elapsed.total_seconds()}s")
    
    @task(2)
    def upload_file(self):
        """Upload a file."""
        with open("test_files/sample.pdf", "rb") as f:
            files = {"file": ("sample.pdf", f, "application/pdf")}
            
            with self.client.post(
                "/api/v1/upload",
                files=files,
                headers={"Authorization": self.headers["Authorization"]},
                catch_response=True
            ) as response:
                if response.elapsed.total_seconds() > 3.0:
                    response.failure(f"Upload too slow: {response.elapsed.total_seconds()}s")
    
    @task(3)
    def ai_chat(self):
        """Send AI chat message."""
        with self.client.post(
            "/api/v1/ai/chat",
            json={
                "message": "What is the summary of my uploaded documents?",
                "context": {"board_id": "board-1"}
            },
            headers=self.headers,
            catch_response=True,
            timeout=30
        ) as response:
            if response.elapsed.total_seconds() > 5.0:
                response.failure(f"AI response too slow: {response.elapsed.total_seconds()}s")


class WebSocketUser(HttpUser):
    """Test WebSocket performance."""
    
    def on_start(self):
        """Establish WebSocket connection."""
        self.ws = create_connection(
            f"ws://{self.host.replace('http://', '')}/ws"
        )
        self.ws_connected = True
    
    def on_stop(self):
        """Close WebSocket connection."""
        if hasattr(self, 'ws') and self.ws:
            self.ws.close()
    
    @task
    def send_cursor_update(self):
        """Send cursor position update."""
        if self.ws_connected:
            start_time = time.time()
            
            self.ws.send(json.dumps({
                "type": "cursor_move",
                "data": {
                    "x": random.randint(0, 1920),
                    "y": random.randint(0, 1080),
                    "user_id": self.user_id
                }
            }))
            
            # Wait for acknowledgment
            response = self.ws.recv()
            response_time = (time.time() - start_time) * 1000
            
            events.request_success.fire(
                request_type="WebSocket",
                name="Cursor Update",
                response_time=response_time,
                response_length=len(response)
            )


# Custom load test shapes
class StagesShape(LoadTestShape):
    """Progressive load test with stages."""
    
    stages = [
        {"duration": 60, "users": 10, "spawn_rate": 1},
        {"duration": 180, "users": 50, "spawn_rate": 2},
        {"duration": 300, "users": 100, "spawn_rate": 5},
        {"duration": 420, "users": 500, "spawn_rate": 10},
        {"duration": 600, "users": 1000, "spawn_rate": 20},
    ]
    
    def tick(self):
        run_time = self.get_run_time()
        
        for stage in self.stages:
            if run_time < stage["duration"]:
                return stage["users"], stage["spawn_rate"]
        
        return None
```

### Pytest Benchmarks

```python
# tests/performance/test_benchmarks.py
import pytest
import numpy as np
from app.services.vector_db import VectorDBService
from app.services.text_processor import TextProcessor

@pytest.mark.benchmark(group="vector-operations")
def test_vector_search_performance(benchmark, vector_service):
    """Benchmark vector search performance."""
    # Setup test data
    query_vector = np.random.rand(384).tolist()
    
    def search():
        return vector_service.search_similar(
            collection="test_collection",
            query_vector=query_vector,
            n_results=10
        )
    
    result = benchmark.pedantic(
        search,
        rounds=100,
        iterations=5,
        warmup_rounds=10
    )
    
    # Assert performance requirements
    assert benchmark.stats["mean"] < 0.05  # 50ms average
    assert benchmark.stats["max"] < 0.1    # 100ms max


@pytest.mark.benchmark(group="text-processing")
def test_text_chunking_performance(benchmark, text_processor):
    """Benchmark text chunking performance."""
    # Large document (100KB)
    large_text = "Lorem ipsum " * 10000
    
    result = benchmark(text_processor.chunk_text, large_text)
    
    # Performance assertions
    assert benchmark.stats["mean"] < 0.1  # 100ms for 100KB
    assert len(result) > 0


@pytest.mark.benchmark(group="database")
def test_bulk_insert_performance(benchmark, db_session):
    """Benchmark bulk insert performance."""
    from app.models.document import Document
    
    # Generate test documents
    documents = [
        Document(
            title=f"Document {i}",
            content=f"Content for document {i}" * 100,
            user_id="test-user"
        )
        for i in range(1000)
    ]
    
    def bulk_insert():
        db_session.bulk_save_objects(documents)
        db_session.commit()
        db_session.rollback()  # Rollback for test
    
    benchmark(bulk_insert)
    
    # Should insert 1000 documents in under 1 second
    assert benchmark.stats["mean"] < 1.0
```

### K6 API Testing

```javascript
// performance_tests/api-load-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')
const searchDuration = new Trend('search_duration')
const uploadDuration = new Trend('upload_duration')

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up more
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.1'],  // Error rate under 10%
    search_duration: ['p(95)<300'],
    upload_duration: ['p(95)<3000'],
  },
}

const BASE_URL = __ENV.API_URL || 'http://localhost:8000'

export function setup() {
  // Login and get token
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: 'loadtest@example.com',
      password: 'loadtest123',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  
  const token = JSON.parse(loginRes.body).access_token
  return { token }
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  }
  
  // Scenario weights
  const scenario = Math.random()
  
  if (scenario < 0.4) {
    // 40% - Search operations
    const searchStart = new Date()
    const searchRes = http.post(
      `${BASE_URL}/api/v1/search/vectors`,
      JSON.stringify({
        query: 'machine learning algorithms',
        limit: 20,
      }),
      { headers }
    )
    searchDuration.add(new Date() - searchStart)
    
    check(searchRes, {
      'search status is 200': (r) => r.status === 200,
      'search returns results': (r) => JSON.parse(r.body).results.length > 0,
      'search is fast': (r) => r.timings.duration < 300,
    })
    
    errorRate.add(searchRes.status !== 200)
    
  } else if (scenario < 0.7) {
    // 30% - Board operations
    const boardRes = http.get(
      `${BASE_URL}/api/v1/boards/sample-board`,
      { headers }
    )
    
    check(boardRes, {
      'board loads successfully': (r) => r.status === 200,
      'board has nodes': (r) => JSON.parse(r.body).nodes.length > 0,
    })
    
    errorRate.add(boardRes.status !== 200)
    
  } else if (scenario < 0.9) {
    // 20% - File operations
    const uploadStart = new Date()
    const fileData = open('./test_files/sample.pdf', 'b')
    
    const uploadRes = http.post(
      `${BASE_URL}/api/v1/upload`,
      {
        file: http.file(fileData, 'sample.pdf'),
      },
      { headers: { 'Authorization': headers.Authorization } }
    )
    uploadDuration.add(new Date() - uploadStart)
    
    check(uploadRes, {
      'upload successful': (r) => r.status === 200,
      'upload returns file id': (r) => JSON.parse(r.body).file_id !== undefined,
    })
    
    errorRate.add(uploadRes.status !== 200)
    
  } else {
    // 10% - AI Chat
    const chatRes = http.post(
      `${BASE_URL}/api/v1/ai/chat`,
      JSON.stringify({
        message: 'Summarize the key points from my documents',
        context: { board_id: 'sample-board' },
      }),
      { headers, timeout: '30s' }
    )
    
    check(chatRes, {
      'chat responds': (r) => r.status === 200,
      'chat returns message': (r) => JSON.parse(r.body).response !== undefined,
      'chat response time acceptable': (r) => r.timings.duration < 10000,
    })
    
    errorRate.add(chatRes.status !== 200)
  }
  
  sleep(1)
}

export function handleSummary(data) {
  return {
    'performance-report.html': htmlReport(data),
    'performance-summary.json': JSON.stringify(data, null, 2),
  }
}
```

## Database Performance Optimization

### Query Performance Testing

```python
# tests/performance/test_database_performance.py
import pytest
import time
from sqlalchemy import text
from app.models import Board, Node, User

class TestDatabasePerformance:
    @pytest.mark.performance
    def test_complex_board_query_performance(self, db_session):
        """Test performance of complex board queries."""
        # Measure query with relationships
        start = time.time()
        
        boards = db_session.query(Board).join(
            Board.nodes
        ).filter(
            Board.is_public == True,
            Board.deleted_at == None
        ).options(
            selectinload(Board.nodes),
            selectinload(Board.owner),
            selectinload(Board.collaborators)
        ).limit(50).all()
        
        query_time = time.time() - start
        
        # Should complete within 100ms
        assert query_time < 0.1
        
        # Verify query plan
        explain = db_session.execute(
            text("EXPLAIN ANALYZE " + str(query.statement.compile()))
        ).fetchall()
        
        # Check for index usage
        assert any("Index Scan" in str(row) for row in explain)
    
    @pytest.mark.performance
    def test_vector_search_query_performance(self, db_session):
        """Test vector similarity search performance."""
        import numpy as np
        
        # Generate random vector
        query_vector = np.random.rand(384)
        
        start = time.time()
        
        # Simulated vector search query
        results = db_session.execute(
            text("""
                SELECT id, content, 
                       1 - (embedding <=> :query_vector) as similarity
                FROM documents
                WHERE 1 - (embedding <=> :query_vector) > 0.7
                ORDER BY similarity DESC
                LIMIT 20
            """),
            {"query_vector": query_vector.tolist()}
        ).fetchall()
        
        query_time = time.time() - start
        
        # Vector search should be fast with index
        assert query_time < 0.05  # 50ms
```

## CI/CD Performance Gates

```yaml
# .github/workflows/performance-tests.yml
name: Performance Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  frontend-performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        run: npm run build
        
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
          
      - name: Upload Lighthouse reports
        uses: actions/upload-artifact@v3
        with:
          name: lighthouse-reports
          path: .lighthouseci/
          
      - name: Check bundle size
        run: npm run analyze:size
        
  backend-performance:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
          
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-test.txt
          
      - name: Run benchmark tests
        run: |
          pytest tests/performance/ \
            --benchmark-only \
            --benchmark-json=benchmark-results.json
            
      - name: Compare benchmarks
        uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'pytest'
          output-file-path: benchmark-results.json
          fail-on-alert: true
          alert-threshold: '150%'
          
  load-testing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start services
        run: docker-compose up -d
        
      - name: Wait for services
        run: |
          timeout 300 bash -c 'until curl -f http://localhost:8000/health; do sleep 5; done'
          
      - name: Run Locust tests
        run: |
          pip install locust
          locust -f performance_tests/locustfile.py \
            --headless \
            --users 100 \
            --spawn-rate 10 \
            --run-time 5m \
            --html performance-report.html
            
      - name: Upload performance reports
        uses: actions/upload-artifact@v3
        with:
          name: performance-reports
          path: performance-report.html
```

## Performance Monitoring Dashboard

```typescript
// src/monitoring/performance-dashboard.tsx
import React, { useEffect, useState } from 'react'
import { Line, Bar } from 'react-chartjs-2'

interface PerformanceMetrics {
  timestamp: number
  fcp: number
  lcp: number
  fid: number
  cls: number
  ttfb: number
  renderTime: number
  apiLatency: number
}

export const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([])
  const [realTimeMetrics, setRealTimeMetrics] = useState<any>({})
  
  useEffect(() => {
    // Collect Web Vitals
    if ('web-vital' in window) {
      window['web-vital'].onCLS(metric => updateMetric('cls', metric.value))
      window['web-vital'].onFID(metric => updateMetric('fid', metric.value))
      window['web-vital'].onLCP(metric => updateMetric('lcp', metric.value))
    }
    
    // Monitor React renders
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach(entry => {
        if (entry.entryType === 'measure' && entry.name.startsWith('⚛️')) {
          updateMetric('renderTime', entry.duration)
        }
      })
    })
    
    observer.observe({ entryTypes: ['measure'] })
    
    return () => observer.disconnect()
  }, [])
  
  const updateMetric = (name: string, value: number) => {
    setRealTimeMetrics(prev => ({ ...prev, [name]: value }))
  }
  
  return (
    <div className="performance-dashboard">
      <h2>Performance Monitoring</h2>
      
      <div className="metrics-grid">
        <MetricCard
          title="First Contentful Paint"
          value={realTimeMetrics.fcp}
          target={1800}
          unit="ms"
        />
        <MetricCard
          title="Largest Contentful Paint"
          value={realTimeMetrics.lcp}
          target={2500}
          unit="ms"
        />
        <MetricCard
          title="First Input Delay"
          value={realTimeMetrics.fid}
          target={100}
          unit="ms"
        />
        <MetricCard
          title="Cumulative Layout Shift"
          value={realTimeMetrics.cls}
          target={0.1}
          unit=""
        />
      </div>
      
      <div className="charts">
        <Line
          data={{
            labels: metrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
            datasets: [
              {
                label: 'API Latency',
                data: metrics.map(m => m.apiLatency),
                borderColor: 'rgb(75, 192, 192)',
              },
              {
                label: 'Render Time',
                data: metrics.map(m => m.renderTime),
                borderColor: 'rgb(255, 99, 132)',
              },
            ],
          }}
          options={{
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Performance Trends',
              },
            },
          }}
        />
      </div>
    </div>
  )
}
```

## Best Practices

1. **Continuous Monitoring**: Track performance metrics in production
2. **Performance Budgets**: Set and enforce strict performance budgets
3. **Regular Audits**: Run performance audits on every deployment
4. **User-Centric Metrics**: Focus on metrics that impact user experience
5. **Incremental Optimization**: Make small, measurable improvements
6. **A/B Testing**: Test performance optimizations with real users
7. **Mobile-First**: Optimize for mobile devices and slow networks
8. **Caching Strategy**: Implement effective caching at all levels
9. **Code Splitting**: Lazy load components and routes
10. **Database Optimization**: Regular query analysis and indexing