# Comprehensive Testing Strategy for RAGBOARD Integrations

## Overview
This guide provides a complete testing strategy for all open-source tool integrations, ensuring reliability, performance, and maintainability.

## Testing Stack

```bash
# Frontend Testing
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install --save-dev jest jest-environment-jsdom @types/jest
npm install --save-dev cypress @cypress/react
npm install --save-dev msw whatwg-fetch

# Backend Testing
pip install pytest pytest-asyncio pytest-cov
pip install httpx fakeredis pytest-mock
pip install factory-boy pytest-benchmark
```

## 1. Unit Testing

### Frontend Unit Tests

#### Component Testing (src/__tests__/components/ExportButton.test.tsx)

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportButton } from '../components/ExportButton';
import { exportService } from '../services/exportService';

// Mock the export service
jest.mock('../services/exportService');

describe('ExportButton', () => {
  const mockBoardRef = {
    current: document.createElement('div')
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders export button', () => {
    render(<ExportButton boardRef={mockBoardRef} />);
    
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('shows format options on click', async () => {
    const user = userEvent.setup();
    render(<ExportButton boardRef={mockBoardRef} />);
    
    await user.click(screen.getByRole('button', { name: /export/i }));
    
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('exports as PNG when PNG option is clicked', async () => {
    const user = userEvent.setup();
    const mockExport = jest.fn().mockResolvedValue(undefined);
    (exportService.exportBoard as jest.Mock).mockImplementation(mockExport);
    
    render(<ExportButton boardRef={mockBoardRef} />);
    
    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByText('PNG'));
    
    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith(
        mockBoardRef.current,
        expect.any(Object),
        expect.objectContaining({ format: 'png' })
      );
    });
  });

  it('shows loading state during export', async () => {
    const user = userEvent.setup();
    (exportService.exportBoard as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<ExportButton boardRef={mockBoardRef} />);
    
    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByText('PNG'));
    
    expect(screen.getByText('Exporting...')).toBeInTheDocument();
  });

  it('handles export errors gracefully', async () => {
    const user = userEvent.setup();
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    (exportService.exportBoard as jest.Mock).mockRejectedValue(new Error('Export failed'));
    
    render(<ExportButton boardRef={mockBoardRef} />);
    
    await user.click(screen.getByRole('button', { name: /export/i }));
    await user.click(screen.getByText('PNG'));
    
    await waitFor(() => {
      expect(screen.getByText('Export failed')).toBeInTheDocument();
    });
    
    consoleError.mockRestore();
  });
});
```

#### Hook Testing (src/__tests__/hooks/useMediaRecorder.test.ts)

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMediaRecorder } from '../hooks/useMediaRecorder';

// Mock MediaDevices API
const mockGetUserMedia = jest.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
});

// Mock RecordRTC
jest.mock('recordrtc', () => {
  return jest.fn().mockImplementation(() => ({
    startRecording: jest.fn(),
    stopRecording: jest.fn((callback) => callback()),
    pauseRecording: jest.fn(),
    resumeRecording: jest.fn(),
    getBlob: jest.fn(() => new Blob(['test'], { type: 'audio/wav' })),
  }));
});

describe('useMediaRecorder', () => {
  beforeEach(() => {
    mockGetUserMedia.mockReset();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useMediaRecorder({ type: 'audio' }));
    
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.duration).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('starts recording when startRecording is called', async () => {
    const mockStream = { getTracks: () => [{ stop: jest.fn() }] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    
    const { result } = renderHook(() => useMediaRecorder({ type: 'audio' }));
    
    await act(async () => {
      await result.current.startRecording();
    });
    
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.isRecording).toBe(true);
  });

  it('handles permission denied error', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
    
    const { result } = renderHook(() => useMediaRecorder({ type: 'audio' }));
    
    await act(async () => {
      await result.current.startRecording();
    });
    
    expect(result.current.error).toBe('Permission denied');
    expect(result.current.isRecording).toBe(false);
  });

  it('stops recording and returns blob', async () => {
    const mockStream = { getTracks: () => [{ stop: jest.fn() }] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    
    const { result } = renderHook(() => useMediaRecorder({ type: 'audio' }));
    
    await act(async () => {
      await result.current.startRecording();
    });
    
    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stopRecording();
    });
    
    expect(blob).toBeInstanceOf(Blob);
    expect(result.current.isRecording).toBe(false);
  });
});
```

### Backend Unit Tests

#### Service Testing (backend/tests/test_langchain_service.py)

```python
import pytest
from unittest.mock import Mock, patch
from app.services.langchain_service import LangChainService
from langchain.schema import Document

@pytest.fixture
def langchain_service():
    with patch('app.services.langchain_service.ChatOpenAI') as mock_llm:
        mock_llm.return_value = Mock()
        service = LangChainService()
        yield service

class TestLangChainService:
    @pytest.mark.asyncio
    async def test_create_rag_chain(self, langchain_service):
        """Test RAG chain creation"""
        board_id = "test_board"
        user_id = "test_user"
        
        chain = await langchain_service.create_rag_chain(board_id, user_id)
        
        assert chain is not None
        assert hasattr(chain, 'arun')
    
    @pytest.mark.asyncio
    async def test_document_splitting(self, langchain_service):
        """Test document text splitting"""
        text = "This is a long document. " * 100
        documents = [Document(page_content=text, metadata={"source": "test"})]
        
        splits = langchain_service.text_splitter.split_documents(documents)
        
        assert len(splits) > 1
        assert all(len(doc.page_content) <= 1000 for doc in splits)
    
    def test_estimate_complexity(self, langchain_service):
        """Test complexity estimation"""
        from app.services.chain_router import ChainRouter, TaskComplexity
        
        router = ChainRouter(langchain_service)
        
        simple_text = "Hello"
        complex_text = "Explain quantum physics " * 50
        
        assert router.estimate_complexity(simple_text) == TaskComplexity.SIMPLE
        assert router.estimate_complexity(complex_text) == TaskComplexity.COMPLEX
    
    @pytest.mark.asyncio
    async def test_cost_tracking(self, langchain_service):
        """Test cost tracking for API calls"""
        from app.services.chain_router import ChainRouter
        
        router = ChainRouter(langchain_service)
        
        with patch('langchain.callbacks.get_openai_callback') as mock_callback:
            mock_cb = Mock()
            mock_cb.total_tokens = 100
            mock_cb.total_cost = 0.002
            mock_callback.return_value.__enter__.return_value = mock_cb
            
            result = await router.route_request(
                "chat",
                "Test input",
                use_rag=False
            )
            
            assert result["tokens_used"] == 100
            assert result["cost"] == 0.002
```

## 2. Integration Testing

### API Integration Tests (backend/tests/test_api_integration.py)

```python
import pytest
from httpx import AsyncClient
from app.main import app
from app.models.user import User
from tests.factories import UserFactory, BoardFactory

@pytest.mark.asyncio
class TestExportAPI:
    async def test_export_board_as_png(self, client: AsyncClient, auth_headers):
        """Test board export endpoint"""
        board = BoardFactory()
        
        response = await client.post(
            f"/api/boards/{board.id}/export",
            headers=auth_headers,
            json={"format": "png", "scale": 2}
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
    
    async def test_export_requires_authentication(self, client: AsyncClient):
        """Test export requires auth"""
        response = await client.post("/api/boards/123/export")
        assert response.status_code == 401
    
    async def test_export_validates_board_access(self, client: AsyncClient, auth_headers):
        """Test user can only export their boards"""
        other_user_board = BoardFactory(owner_id="other_user")
        
        response = await client.post(
            f"/api/boards/{other_user_board.id}/export",
            headers=auth_headers
        )
        
        assert response.status_code == 403
```

### WebSocket Integration Tests (backend/tests/test_websocket.py)

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_websocket_yjs_sync():
    client = TestClient(app)
    
    with client.websocket_connect("/ws/yjs/board-123") as websocket:
        # Send sync step 1
        websocket.send_bytes(b'\x00' + b'sync-data')
        
        # Receive sync response
        data = websocket.receive_bytes()
        assert data[0] == 1  # Sync step 2
        
        # Send update
        websocket.send_bytes(b'\x02' + b'update-data')
        
        # Should broadcast to other clients
        # (in real test, would have multiple connections)
```

## 3. End-to-End Testing

### Cypress E2E Tests (cypress/e2e/export-flow.cy.ts)

```typescript
describe('Export Flow', () => {
  beforeEach(() => {
    cy.login();
    cy.createBoard('Test Board');
  });

  it('exports board as PNG', () => {
    // Add some content to board
    cy.get('[data-testid="add-text-node"]').click();
    cy.get('[data-testid="node-input"]').type('Test content');
    
    // Open export modal
    cy.get('[data-testid="export-button"]').click();
    
    // Select PNG format
    cy.get('[data-testid="format-png"]').click();
    
    // Configure options
    cy.get('[data-testid="scale-slider"]').invoke('val', 2).trigger('input');
    
    // Export
    cy.get('[data-testid="export-confirm"]').click();
    
    // Verify download
    cy.readFile('cypress/downloads/board-export.png').should('exist');
  });

  it('exports board with custom background', () => {
    cy.get('[data-testid="export-button"]').click();
    cy.get('[data-testid="background-color"]').click();
    cy.get('[data-testid="color-picker"]').invoke('val', '#f0f0f0');
    cy.get('[data-testid="export-confirm"]').click();
    
    // Verify export completed
    cy.get('[data-testid="export-success"]').should('be.visible');
  });
});
```

### Voice Recording E2E (cypress/e2e/voice-recording.cy.ts)

```typescript
describe('Voice Recording', () => {
  beforeEach(() => {
    cy.login();
    cy.createBoard('Voice Test Board');
    // Grant microphone permission
    cy.grantMicrophonePermission();
  });

  it('records and saves voice note', () => {
    // Start recording
    cy.get('[data-testid="voice-record-button"]').click();
    
    // Verify recording state
    cy.get('[data-testid="recording-indicator"]').should('be.visible');
    cy.get('[data-testid="recording-timer"]').should('contain', '0:0');
    
    // Wait for 3 seconds
    cy.wait(3000);
    
    // Stop recording
    cy.get('[data-testid="stop-recording"]').click();
    
    // Verify voice note added to board
    cy.get('[data-testid="voice-note-node"]').should('exist');
    
    // Play the recording
    cy.get('[data-testid="voice-note-play"]').click();
    cy.get('[data-testid="voice-note-pause"]').should('be.visible');
  });

  it('handles recording errors gracefully', () => {
    // Revoke microphone permission
    cy.revokeMicrophonePermission();
    
    // Try to record
    cy.get('[data-testid="voice-record-button"]').click();
    
    // Should show error
    cy.get('[data-testid="permission-error"]')
      .should('contain', 'Microphone access required');
  });
});
```

## 4. Performance Testing

### Load Testing (tests/performance/test_load.py)

```python
import asyncio
import time
from locust import HttpUser, task, between
import websocket

class RagboardUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        # Login
        response = self.client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "password"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def view_board(self):
        self.client.get("/api/boards/123", headers=self.headers)
    
    @task(2)
    def add_node(self):
        self.client.post("/api/boards/123/nodes", headers=self.headers, json={
            "type": "text",
            "position": {"x": 100, "y": 100},
            "data": {"text": "Test node"}
        })
    
    @task(1)
    def export_board(self):
        with self.client.post(
            "/api/boards/123/export",
            headers=self.headers,
            json={"format": "png"},
            catch_response=True
        ) as response:
            if response.elapsed.total_seconds() > 5:
                response.failure("Export took too long")
```

### Frontend Performance Tests (src/__tests__/performance/render.test.tsx)

```typescript
import { render } from '@testing-library/react';
import { BoardCanvas } from '../components/BoardCanvas';
import { generateLargeBoard } from '../utils/testHelpers';

describe('Performance Tests', () => {
  it('renders large board within acceptable time', () => {
    const largeBoard = generateLargeBoard(1000); // 1000 nodes
    
    const startTime = performance.now();
    render(<BoardCanvas nodes={largeBoard.nodes} edges={largeBoard.edges} />);
    const renderTime = performance.now() - startTime;
    
    expect(renderTime).toBeLessThan(1000); // Should render in under 1 second
  });

  it('handles rapid node additions efficiently', async () => {
    const { rerender } = render(<BoardCanvas nodes={[]} edges={[]} />);
    
    const measurements: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      const nodes = Array.from({ length: i }, (_, index) => ({
        id: `node-${index}`,
        type: 'text',
        position: { x: index * 100, y: 100 },
        data: { text: `Node ${index}` },
      }));
      
      const startTime = performance.now();
      rerender(<BoardCanvas nodes={nodes} edges={[]} />);
      measurements.push(performance.now() - startTime);
    }
    
    // Average render time should not increase dramatically
    const avgFirstHalf = measurements.slice(0, 50).reduce((a, b) => a + b) / 50;
    const avgSecondHalf = measurements.slice(50).reduce((a, b) => a + b) / 50;
    
    expect(avgSecondHalf / avgFirstHalf).toBeLessThan(2); // Less than 2x slowdown
  });
});
```

## 5. Accessibility Testing

### ARIA and Keyboard Navigation (src/__tests__/a11y/accessibility.test.tsx)

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';

expect.extend(toHaveNoViolations);

describe('Accessibility Tests', () => {
  it('export modal has no accessibility violations', async () => {
    const { container } = render(<ExportModal isOpen={true} onClose={jest.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('voice recorder is keyboard accessible', async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<VoiceRecorder />);
    
    const recordButton = getByRole('button', { name: /record/i });
    
    // Can focus with tab
    await user.tab();
    expect(recordButton).toHaveFocus();
    
    // Can activate with Enter
    await user.keyboard('{Enter}');
    expect(getByRole('button', { name: /stop/i })).toBeInTheDocument();
    
    // Can activate with Space
    await user.keyboard(' ');
    expect(getByRole('button', { name: /record/i })).toBeInTheDocument();
  });

  it('provides proper ARIA labels', () => {
    const { getByLabelText } = render(<VideoPlayer src="test.mp4" />);
    
    expect(getByLabelText('Play video')).toBeInTheDocument();
    expect(getByLabelText('Video progress')).toBeInTheDocument();
    expect(getByLabelText('Volume control')).toBeInTheDocument();
  });
});
```

## 6. Security Testing

### Input Validation Tests (backend/tests/test_security.py)

```python
import pytest
from app.api.endpoints.export import validate_export_options

class TestSecurityValidation:
    def test_export_validates_scale_parameter(self):
        """Prevent DoS via huge scale values"""
        with pytest.raises(ValueError):
            validate_export_options({"format": "png", "scale": 100})
    
    def test_export_validates_format_parameter(self):
        """Prevent arbitrary format injection"""
        with pytest.raises(ValueError):
            validate_export_options({"format": "../../etc/passwd"})
    
    def test_filename_sanitization(self):
        """Test filename sanitization"""
        from app.utils.security import sanitize_filename
        
        assert sanitize_filename("../../../etc/passwd") == "etcpasswd"
        assert sanitize_filename("file<script>.pdf") == "filescript.pdf"
        assert sanitize_filename("normal-file.png") == "normal-file.png"
```

### XSS Prevention Tests (src/__tests__/security/xss.test.tsx)

```typescript
describe('XSS Prevention', () => {
  it('sanitizes user input in rich text editor', () => {
    const { container } = render(
      <RichTextEditor 
        initialContent='<script>alert("XSS")</script>Hello' 
      />
    );
    
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.textContent).toContain('Hello');
  });

  it('escapes HTML in exported JSON', async () => {
    const maliciousData = {
      text: '<img src=x onerror=alert("XSS")>',
    };
    
    const exported = await exportService.exportBoard(
      document.createElement('div'),
      { nodes: [{ data: maliciousData }] },
      { format: 'json' }
    );
    
    const json = JSON.parse(exported);
    expect(json.nodes[0].data.text).not.toContain('onerror');
  });
});
```

## 7. Test Utilities

### Mock Service Worker Setup (src/mocks/handlers.ts)

```typescript
import { rest } from 'msw';

export const handlers = [
  rest.post('/api/boards/:boardId/export', (req, res, ctx) => {
    const { format } = req.body as any;
    
    if (format === 'png') {
      return res(
        ctx.status(200),
        ctx.set('Content-Type', 'image/png'),
        ctx.body(new ArrayBuffer(8))
      );
    }
    
    return res(ctx.status(400));
  }),

  rest.post('/api/upload/audio', async (req, res, ctx) => {
    return res(
      ctx.json({
        url: 'https://storage.example.com/audio/test.wav',
        duration: 5.2,
      })
    );
  }),
];
```

### Test Factories (backend/tests/factories.py)

```python
import factory
from factory.alchemy import SQLAlchemyModelFactory
from app.models import User, Board, Resource

class UserFactory(SQLAlchemyModelFactory):
    class Meta:
        model = User
        sqlalchemy_session_persistence = "commit"
    
    id = factory.Faker("uuid4")
    email = factory.Faker("email")
    name = factory.Faker("name")
    
class BoardFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Board
    
    id = factory.Faker("uuid4")
    title = factory.Faker("sentence", nb_words=3)
    owner = factory.SubFactory(UserFactory)
    
class ResourceFactory(SQLAlchemyModelFactory):
    class Meta:
        model = Resource
    
    id = factory.Faker("uuid4")
    type = factory.Faker("random_element", elements=["text", "image", "video"])
    board = factory.SubFactory(BoardFactory)
```

## 8. Continuous Integration

### GitHub Actions Workflow (.github/workflows/test.yml)

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-test.txt
      
      - name: Run tests
        run: pytest --cov=app --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: cypress-io/github-action@v5
        with:
          build: npm run build
          start: npm run preview
          wait-on: 'http://localhost:3000'
          wait-on-timeout: 120
```

## Testing Best Practices

1. **Test Pyramid**: 70% unit, 20% integration, 10% E2E
2. **Fast Feedback**: Unit tests < 100ms, integration < 1s
3. **Isolation**: Mock external dependencies
4. **Deterministic**: No flaky tests
5. **Coverage**: Aim for >80% code coverage
6. **Accessibility**: Test with screen readers
7. **Performance**: Set performance budgets
8. **Security**: Include security in CI/CD