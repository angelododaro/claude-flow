# Unit Testing Strategy for RAGBOARD

## Frontend Unit Testing with Vitest

### Test Structure

```
ragboard/
├── src/
│   ├── components/
│   │   ├── __tests__/
│   │   │   ├── AIChatPanel.test.tsx
│   │   │   ├── BoardHeader.test.tsx
│   │   │   └── ResourceNode.test.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── __tests__/
│   │   │   ├── useWebSocket.test.ts
│   │   │   └── useVectorSearch.test.ts
│   │   └── ...
│   ├── services/
│   │   ├── __tests__/
│   │   │   ├── api.test.ts
│   │   │   └── auth.test.ts
│   │   └── ...
│   └── store/
│       ├── __tests__/
│       │   └── boardStore.test.ts
│       └── ...
├── vitest.config.ts
├── vitest.setup.ts
└── test-utils/
    ├── render.tsx
    ├── providers.tsx
    └── mocks/
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test-utils/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/*',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    reporters: ['default', 'html'],
    outputFile: {
      html: './test-results/index.html',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### Component Testing Examples

#### 1. React Component Test

```typescript
// src/components/__tests__/AIChatPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/test-utils'
import { AIChatPanel } from '../AIChatPanel'
import { mockChatResponse } from '@/test-utils/mocks'

describe('AIChatPanel', () => {
  const mockOnSend = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders chat interface correctly', () => {
    render(<AIChatPanel onSend={mockOnSend} />)
    
    expect(screen.getByPlaceholderText(/ask ai/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('handles message submission', async () => {
    render(<AIChatPanel onSend={mockOnSend} />)
    
    const input = screen.getByPlaceholderText(/ask ai/i)
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(sendButton)
    
    await waitFor(() => {
      expect(mockOnSend).toHaveBeenCalledWith('Test message')
      expect(input).toHaveValue('')
    })
  })

  it('displays loading state during API call', async () => {
    render(<AIChatPanel onSend={mockOnSend} isLoading />)
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('handles keyboard shortcuts', async () => {
    render(<AIChatPanel onSend={mockOnSend} />)
    
    const input = screen.getByPlaceholderText(/ask ai/i)
    
    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
    
    await waitFor(() => {
      expect(mockOnSend).toHaveBeenCalledWith('Test message')
    })
  })
})
```

#### 2. Custom Hook Test

```typescript
// src/hooks/__tests__/useWebSocket.test.ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWebSocket } from '../useWebSocket'
import WS from 'vitest-websocket-mock'

describe('useWebSocket', () => {
  let server: WS
  
  beforeEach(async () => {
    server = new WS('ws://localhost:8000/ws')
  })

  afterEach(() => {
    WS.clean()
  })

  it('connects to WebSocket server', async () => {
    const { result } = renderHook(() => 
      useWebSocket('ws://localhost:8000/ws')
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })
  })

  it('sends messages correctly', async () => {
    const { result } = renderHook(() => 
      useWebSocket('ws://localhost:8000/ws')
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      result.current.sendMessage({ type: 'chat', content: 'Hello' })
    })

    await expect(server).toReceiveMessage(
      JSON.stringify({ type: 'chat', content: 'Hello' })
    )
  })

  it('receives messages correctly', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => 
      useWebSocket('ws://localhost:8000/ws', { onMessage })
    )

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    server.send(JSON.stringify({ type: 'notification', data: 'New message' }))

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith({
        type: 'notification',
        data: 'New message'
      })
    })
  })
})
```

#### 3. Store Test (Zustand)

```typescript
// src/store/__tests__/boardStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useBoardStore } from '../boardStore'

describe('boardStore', () => {
  beforeEach(() => {
    // Reset store state
    useBoardStore.setState({
      nodes: [],
      edges: [],
      selectedNodeId: null,
    })
  })

  it('adds a new node', () => {
    const { result } = renderHook(() => useBoardStore())

    act(() => {
      result.current.addNode({
        id: 'node-1',
        type: 'text',
        position: { x: 100, y: 100 },
        data: { content: 'Test node' },
      })
    })

    expect(result.current.nodes).toHaveLength(1)
    expect(result.current.nodes[0]).toMatchObject({
      id: 'node-1',
      type: 'text',
      data: { content: 'Test node' },
    })
  })

  it('updates node position', () => {
    const { result } = renderHook(() => useBoardStore())

    // Add initial node
    act(() => {
      result.current.addNode({
        id: 'node-1',
        type: 'text',
        position: { x: 100, y: 100 },
        data: { content: 'Test node' },
      })
    })

    // Update position
    act(() => {
      result.current.updateNodePosition('node-1', { x: 200, y: 200 })
    })

    expect(result.current.nodes[0].position).toEqual({ x: 200, y: 200 })
  })

  it('handles node selection', () => {
    const { result } = renderHook(() => useBoardStore())

    act(() => {
      result.current.selectNode('node-1')
    })

    expect(result.current.selectedNodeId).toBe('node-1')

    act(() => {
      result.current.deselectNode()
    })

    expect(result.current.selectedNodeId).toBeNull()
  })
})
```

### Service Testing Examples

```typescript
// src/services/__tests__/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient, uploadFile, searchVectors } from '../api'
import { server } from '@/test-utils/msw/server'
import { rest } from 'msw'

describe('API Service', () => {
  describe('uploadFile', () => {
    it('uploads file successfully', async () => {
      const file = new File(['test content'], 'test.txt', { 
        type: 'text/plain' 
      })

      const result = await uploadFile(file)

      expect(result).toMatchObject({
        id: expect.any(String),
        filename: 'test.txt',
        size: 12,
        status: 'uploaded',
      })
    })

    it('handles upload errors', async () => {
      server.use(
        rest.post('/api/upload', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ 
            error: 'Upload failed' 
          }))
        })
      )

      const file = new File(['test'], 'test.txt')

      await expect(uploadFile(file)).rejects.toThrow('Upload failed')
    })
  })

  describe('searchVectors', () => {
    it('searches vectors with query', async () => {
      const results = await searchVectors('machine learning')

      expect(results).toHaveLength(3)
      expect(results[0]).toMatchObject({
        id: expect.any(String),
        content: expect.stringContaining('machine learning'),
        score: expect.any(Number),
      })
    })

    it('handles empty results', async () => {
      server.use(
        rest.post('/api/search', (req, res, ctx) => {
          return res(ctx.json({ results: [] }))
        })
      )

      const results = await searchVectors('nonexistent query')
      expect(results).toHaveLength(0)
    })
  })
})
```

## Backend Unit Testing with pytest

### Test Structure

```
ragboard/backend/
├── app/
│   ├── api/
│   │   └── endpoints/
│   │       └── __tests__/
│   ├── services/
│   │   └── __tests__/
│   ├── models/
│   │   └── __tests__/
│   └── core/
│       └── __tests__/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   └── conftest.py
├── pytest.ini
└── .coveragerc
```

### pytest Configuration

```ini
# pytest.ini
[tool:pytest]
python_files = test_*.py *_test.py
python_classes = Test*
python_functions = test_*
testpaths = tests app
addopts = 
    --verbose
    --cov=app
    --cov-report=term-missing
    --cov-report=html
    --cov-report=xml
    --cov-fail-under=80
    --maxfail=1
    --strict-markers
    -p no:warnings
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow running tests
    auth: Authentication tests
    api: API endpoint tests
```

### Backend Test Examples

#### 1. Service Test

```python
# app/services/__tests__/test_vector_db.py
import pytest
from unittest.mock import Mock, patch
from app.services.vector_db import VectorDBService
import numpy as np

class TestVectorDBService:
    @pytest.fixture
    def vector_service(self):
        """Create a VectorDBService instance for testing."""
        with patch('app.services.vector_db.ChromaClient') as mock_client:
            service = VectorDBService()
            service.client = mock_client
            yield service

    def test_add_document(self, vector_service):
        """Test adding a document to the vector database."""
        # Arrange
        mock_collection = Mock()
        vector_service.client.get_or_create_collection.return_value = mock_collection
        
        document = {
            'id': 'doc-123',
            'content': 'Test document content',
            'metadata': {'source': 'test'}
        }
        
        # Act
        result = vector_service.add_document(
            collection_name='test_collection',
            document=document
        )
        
        # Assert
        mock_collection.add.assert_called_once_with(
            ids=['doc-123'],
            documents=['Test document content'],
            metadatas=[{'source': 'test'}]
        )
        assert result == 'doc-123'

    def test_search_similar(self, vector_service):
        """Test searching for similar documents."""
        # Arrange
        mock_collection = Mock()
        vector_service.client.get_collection.return_value = mock_collection
        
        mock_collection.query.return_value = {
            'ids': [['doc-1', 'doc-2']],
            'documents': [['Document 1', 'Document 2']],
            'distances': [[0.1, 0.3]],
            'metadatas': [[{'source': 'file1'}, {'source': 'file2'}]]
        }
        
        # Act
        results = vector_service.search_similar(
            collection_name='test_collection',
            query='test query',
            n_results=2
        )
        
        # Assert
        assert len(results) == 2
        assert results[0]['id'] == 'doc-1'
        assert results[0]['distance'] == 0.1
        assert results[1]['id'] == 'doc-2'
        
    def test_delete_document(self, vector_service):
        """Test deleting a document from the vector database."""
        # Arrange
        mock_collection = Mock()
        vector_service.client.get_collection.return_value = mock_collection
        
        # Act
        vector_service.delete_document(
            collection_name='test_collection',
            document_id='doc-123'
        )
        
        # Assert
        mock_collection.delete.assert_called_once_with(ids=['doc-123'])

    @pytest.mark.parametrize('embedding_dim,expected', [
        (384, 384),
        (768, 768),
        (1536, 1536),
    ])
    def test_embedding_dimensions(self, vector_service, embedding_dim, expected):
        """Test different embedding dimensions."""
        mock_embedding = np.random.rand(embedding_dim)
        
        with patch.object(vector_service, '_generate_embedding', 
                         return_value=mock_embedding):
            embedding = vector_service.get_embedding('test text')
            
        assert len(embedding) == expected
```

#### 2. API Endpoint Test

```python
# app/api/endpoints/__tests__/test_auth.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

class TestAuthEndpoints:
    def test_login_success(self):
        """Test successful login."""
        with patch('app.api.endpoints.auth.authenticate_user') as mock_auth:
            mock_auth.return_value = {
                'id': 'user-123',
                'email': 'test@example.com',
                'is_active': True
            }
            
            response = client.post(
                '/api/v1/auth/login',
                json={
                    'email': 'test@example.com',
                    'password': 'testpass123'
                }
            )
            
        assert response.status_code == 200
        data = response.json()
        assert 'access_token' in data
        assert data['token_type'] == 'bearer'
        
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        with patch('app.api.endpoints.auth.authenticate_user') as mock_auth:
            mock_auth.return_value = None
            
            response = client.post(
                '/api/v1/auth/login',
                json={
                    'email': 'test@example.com',
                    'password': 'wrongpass'
                }
            )
            
        assert response.status_code == 401
        assert response.json()['detail'] == 'Invalid credentials'
        
    def test_protected_route_with_token(self):
        """Test accessing protected route with valid token."""
        token = create_access_token({'sub': 'user-123'})
        
        response = client.get(
            '/api/v1/users/me',
            headers={'Authorization': f'Bearer {token}'}
        )
        
        assert response.status_code == 200
        
    def test_protected_route_without_token(self):
        """Test accessing protected route without token."""
        response = client.get('/api/v1/users/me')
        
        assert response.status_code == 401
        assert response.json()['detail'] == 'Not authenticated'
```

#### 3. Model Test

```python
# app/models/__tests__/test_board.py
import pytest
from sqlalchemy.orm import Session
from app.models.board import Board
from app.models.user import User
from datetime import datetime

class TestBoardModel:
    def test_create_board(self, db: Session):
        """Test creating a new board."""
        # Create user
        user = User(
            email='test@example.com',
            hashed_password='hashed',
            is_active=True
        )
        db.add(user)
        db.commit()
        
        # Create board
        board = Board(
            title='Test Board',
            description='Test Description',
            owner_id=user.id,
            is_public=False
        )
        db.add(board)
        db.commit()
        
        # Assert
        assert board.id is not None
        assert board.title == 'Test Board'
        assert board.owner_id == user.id
        assert board.created_at is not None
        assert isinstance(board.created_at, datetime)
        
    def test_board_relationships(self, db: Session, test_user: User):
        """Test board relationships."""
        board = Board(
            title='Test Board',
            owner_id=test_user.id
        )
        db.add(board)
        db.commit()
        
        # Test owner relationship
        assert board.owner.id == test_user.id
        assert board.owner.email == test_user.email
        
        # Test reverse relationship
        assert board in test_user.boards
        
    def test_board_soft_delete(self, db: Session, test_board: Board):
        """Test soft deleting a board."""
        board_id = test_board.id
        
        # Soft delete
        test_board.soft_delete()
        db.commit()
        
        # Board should still exist but be marked as deleted
        board = db.query(Board).filter(Board.id == board_id).first()
        assert board is not None
        assert board.deleted_at is not None
        
        # Should not appear in active boards query
        active_boards = db.query(Board).filter(
            Board.deleted_at == None
        ).all()
        assert test_board not in active_boards
```

### Test Utilities

#### Frontend Test Utils

```typescript
// test-utils/render.tsx
import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { AllProviders } from './providers'

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
```

#### Backend Fixtures

```python
# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
from app.models.user import User
from app.core.security import get_password_hash

@pytest.fixture(scope='session')
def db_engine():
    """Create a test database engine."""
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope='function')
def db(db_engine):
    """Create a new database session for each test."""
    connection = db_engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection)
    session = SessionLocal()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def test_user(db):
    """Create a test user."""
    user = User(
        email='testuser@example.com',
        hashed_password=get_password_hash('testpass123'),
        is_active=True,
        is_superuser=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
```

## Coverage Requirements

### Frontend Coverage
- Components: 85% minimum
- Hooks: 90% minimum
- Services: 90% minimum
- Stores: 85% minimum
- Utils: 95% minimum

### Backend Coverage
- API Endpoints: 90% minimum
- Services: 85% minimum
- Models: 80% minimum
- Core utilities: 95% minimum

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Dependencies**: Use MSW for frontend, unittest.mock for backend
3. **Test Data Builders**: Use factories for complex test data
4. **Descriptive Names**: Test names should describe the behavior
5. **Fast Tests**: Unit tests should run in milliseconds
6. **Continuous Refactoring**: Refactor tests as code evolves