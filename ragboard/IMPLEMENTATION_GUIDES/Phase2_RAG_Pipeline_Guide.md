# Phase 2: RAG Pipeline Implementation Guide

## Overview
This guide details the implementation of a complete Retrieval-Augmented Generation (RAG) pipeline for RAGBOARD, enabling semantic search and context-aware AI conversations.

## Architecture

### RAG Pipeline Components
```
1. Content Extraction → 2. Embedding Generation → 3. Vector Storage
                                                          ↓
6. AI Response ← 5. Context Assembly ← 4. Semantic Retrieval
```

## Implementation Steps

### 1. ChromaDB Setup

**File: `backend/app/modules/rag/vectordb/chromadb_client.py`**
```python
import chromadb
from chromadb.config import Settings
from typing import List, Dict, Optional
import numpy as np

class ChromaDBClient:
    def __init__(self, persist_directory: str = "./chroma_db"):
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
    def create_collection(self, board_id: str) -> chromadb.Collection:
        """Create a collection for each board"""
        collection_name = f"board_{board_id}"
        
        # Delete if exists (for updates)
        try:
            self.client.delete_collection(collection_name)
        except:
            pass
            
        return self.client.create_collection(
            name=collection_name,
            metadata={"board_id": board_id},
            embedding_function=self._get_embedding_function()
        )
    
    def _get_embedding_function(self):
        from chromadb.utils import embedding_functions
        return embedding_functions.OpenAIEmbeddingFunction(
            api_key=os.getenv("OPENAI_API_KEY"),
            model_name="text-embedding-3-small"
        )
    
    def add_documents(
        self, 
        collection_name: str,
        documents: List[str],
        metadatas: List[Dict],
        ids: List[str]
    ):
        collection = self.client.get_collection(collection_name)
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
    
    def search(
        self,
        collection_name: str,
        query: str,
        n_results: int = 5,
        filter: Optional[Dict] = None
    ) -> Dict:
        collection = self.client.get_collection(collection_name)
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=filter
        )
        return results
```

### 2. Content Extraction Pipeline

**File: `backend/app/modules/rag/extractors/content_extractor.py`**
```python
from typing import Dict, Any, List
from abc import ABC, abstractmethod
import PyPDF2
import pytesseract
from PIL import Image
import whisper
import requests
from bs4 import BeautifulSoup

class ContentExtractor(ABC):
    @abstractmethod
    async def extract(self, resource: Dict[str, Any]) -> str:
        pass

class TextNodeExtractor(ContentExtractor):
    async def extract(self, resource: Dict[str, Any]) -> str:
        return resource.get("content", "")

class PDFExtractor(ContentExtractor):
    async def extract(self, resource: Dict[str, Any]) -> str:
        file_path = resource["file_path"]
        text = ""
        
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
                
        return text

class ImageExtractor(ContentExtractor):
    async def extract(self, resource: Dict[str, Any]) -> str:
        image_path = resource["file_path"]
        image = Image.open(image_path)
        
        # OCR for text extraction
        text = pytesseract.image_to_string(image)
        
        # Image description using vision model
        description = await self._get_image_description(image_path)
        
        return f"Text in image: {text}\nImage description: {description}"
    
    async def _get_image_description(self, image_path: str) -> str:
        # Use OpenAI Vision or other vision API
        # Placeholder implementation
        return "Image analysis pending"

class AudioExtractor(ContentExtractor):
    def __init__(self):
        self.model = whisper.load_model("base")
    
    async def extract(self, resource: Dict[str, Any]) -> str:
        audio_path = resource["file_path"]
        result = self.model.transcribe(audio_path)
        return result["text"]

class URLExtractor(ContentExtractor):
    async def extract(self, resource: Dict[str, Any]) -> str:
        url = resource["url"]
        response = requests.get(url)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract main content
        text = soup.get_text(separator=' ', strip=True)
        
        # Limit to reasonable length
        return text[:5000]

class ExtractorFactory:
    extractors = {
        "text": TextNodeExtractor(),
        "pdf": PDFExtractor(),
        "image": ImageExtractor(),
        "audio": AudioExtractor(),
        "url": URLExtractor(),
    }
    
    @classmethod
    def get_extractor(cls, resource_type: str) -> ContentExtractor:
        return cls.extractors.get(resource_type, TextNodeExtractor())
```

### 3. Embedding Generation

**File: `backend/app/modules/rag/embeddings/embedding_service.py`**
```python
from typing import List, Dict
import openai
from tenacity import retry, stop_after_attempt, wait_exponential
import tiktoken

class EmbeddingService:
    def __init__(self, model: str = "text-embedding-3-small"):
        self.model = model
        self.encoding = tiktoken.encoding_for_model(model)
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def chunk_text(self, text: str, max_tokens: int = 512) -> List[str]:
        """Split text into chunks that fit within token limits"""
        tokens = self.encoding.encode(text)
        chunks = []
        
        for i in range(0, len(tokens), max_tokens):
            chunk_tokens = tokens[i:i + max_tokens]
            chunk_text = self.encoding.decode(chunk_tokens)
            chunks.append(chunk_text)
            
        return chunks
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts"""
        response = await openai.Embedding.acreate(
            model=self.model,
            input=texts
        )
        
        return [item['embedding'] for item in response['data']]
    
    async def process_resource(self, resource_id: str, content: str) -> List[Dict]:
        """Process a resource into chunks with embeddings"""
        chunks = self.chunk_text(content)
        embeddings = await self.generate_embeddings(chunks)
        
        return [
            {
                "id": f"{resource_id}_chunk_{i}",
                "text": chunk,
                "embedding": embedding,
                "metadata": {
                    "resource_id": resource_id,
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }
            }
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
```

### 4. RAG Processing Service

**File: `backend/app/modules/rag/services/rag_processor.py`**
```python
from typing import List, Dict, Any
import asyncio
from ..extractors.content_extractor import ExtractorFactory
from ..embeddings.embedding_service import EmbeddingService
from ..vectordb.chromadb_client import ChromaDBClient

class RAGProcessor:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.chromadb = ChromaDBClient()
        
    async def process_board(self, board_id: str, resources: List[Dict[str, Any]]):
        """Process all resources in a board"""
        collection = self.chromadb.create_collection(board_id)
        
        # Process resources in parallel
        tasks = []
        for resource in resources:
            task = self.process_resource(resource, board_id)
            tasks.append(task)
            
        results = await asyncio.gather(*tasks)
        
        # Add to vector database
        all_documents = []
        all_metadatas = []
        all_ids = []
        
        for chunks in results:
            if chunks:
                for chunk in chunks:
                    all_documents.append(chunk["text"])
                    all_metadatas.append(chunk["metadata"])
                    all_ids.append(chunk["id"])
        
        if all_documents:
            self.chromadb.add_documents(
                collection_name=f"board_{board_id}",
                documents=all_documents,
                metadatas=all_metadatas,
                ids=all_ids
            )
    
    async def process_resource(self, resource: Dict[str, Any], board_id: str) -> List[Dict]:
        """Process a single resource"""
        try:
            # Extract content
            extractor = ExtractorFactory.get_extractor(resource["type"])
            content = await extractor.extract(resource)
            
            if not content:
                return []
            
            # Generate embeddings
            chunks = await self.embedding_service.process_resource(
                resource["id"],
                content
            )
            
            # Add board context to metadata
            for chunk in chunks:
                chunk["metadata"].update({
                    "board_id": board_id,
                    "resource_type": resource["type"],
                    "resource_title": resource.get("title", "Untitled"),
                    "created_at": resource.get("created_at")
                })
                
            return chunks
            
        except Exception as e:
            print(f"Error processing resource {resource['id']}: {e}")
            return []
```

### 5. Semantic Search Implementation

**File: `backend/app/modules/rag/retrieval/semantic_search.py`**
```python
from typing import List, Dict, Optional
from ..vectordb.chromadb_client import ChromaDBClient

class SemanticSearch:
    def __init__(self):
        self.chromadb = ChromaDBClient()
    
    async def search(
        self,
        board_id: str,
        query: str,
        n_results: int = 5,
        resource_types: Optional[List[str]] = None,
        date_range: Optional[Dict] = None
    ) -> List[Dict]:
        """Perform semantic search on board content"""
        
        # Build filter
        filter_conditions = {}
        if resource_types:
            filter_conditions["resource_type"] = {"$in": resource_types}
        if date_range:
            filter_conditions["created_at"] = {
                "$gte": date_range.get("start"),
                "$lte": date_range.get("end")
            }
        
        # Search
        results = self.chromadb.search(
            collection_name=f"board_{board_id}",
            query=query,
            n_results=n_results,
            filter=filter_conditions if filter_conditions else None
        )
        
        # Format results
        formatted_results = []
        for i, doc in enumerate(results['documents'][0]):
            formatted_results.append({
                "text": doc,
                "metadata": results['metadatas'][0][i],
                "distance": results['distances'][0][i],
                "id": results['ids'][0][i]
            })
        
        return formatted_results
    
    async def get_context_for_chat(
        self,
        board_id: str,
        query: str,
        max_tokens: int = 2000
    ) -> str:
        """Get relevant context for AI chat"""
        results = await self.search(board_id, query, n_results=10)
        
        context_parts = []
        token_count = 0
        
        for result in results:
            text = result['text']
            metadata = result['metadata']
            
            # Format context entry
            context_entry = f"[{metadata['resource_type']} - {metadata['resource_title']}]\n{text}\n"
            
            # Simple token estimation (rough)
            entry_tokens = len(context_entry.split()) * 1.3
            
            if token_count + entry_tokens <= max_tokens:
                context_parts.append(context_entry)
                token_count += entry_tokens
            else:
                break
        
        return "\n---\n".join(context_parts)
```

### 6. WebSocket Real-time Updates

**File: `backend/app/modules/realtime/websocket_manager.py`**
```python
from typing import Dict, Set
from fastapi import WebSocket
import json
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_boards: Dict[WebSocket, str] = {}
    
    async def connect(self, websocket: WebSocket, board_id: str):
        await websocket.accept()
        
        if board_id not in self.active_connections:
            self.active_connections[board_id] = set()
            
        self.active_connections[board_id].add(websocket)
        self.user_boards[websocket] = board_id
        
        # Notify others
        await self.broadcast(board_id, {
            "type": "user_joined",
            "board_id": board_id
        }, exclude=websocket)
    
    def disconnect(self, websocket: WebSocket):
        board_id = self.user_boards.get(websocket)
        if board_id and board_id in self.active_connections:
            self.active_connections[board_id].discard(websocket)
            if not self.active_connections[board_id]:
                del self.active_connections[board_id]
        
        if websocket in self.user_boards:
            del self.user_boards[websocket]
    
    async def broadcast(
        self, 
        board_id: str, 
        message: dict,
        exclude: Optional[WebSocket] = None
    ):
        if board_id in self.active_connections:
            connections = self.active_connections[board_id].copy()
            
            for connection in connections:
                if connection != exclude:
                    try:
                        await connection.send_json(message)
                    except:
                        # Remove dead connections
                        self.disconnect(connection)
    
    async def send_personal_message(self, websocket: WebSocket, message: dict):
        await websocket.send_json(message)

# Global instance
manager = ConnectionManager()
```

**File: `backend/app/modules/realtime/handlers.py`**
```python
from fastapi import WebSocket, WebSocketDisconnect
from .websocket_manager import manager
from ..rag.services.rag_processor import RAGProcessor

async def handle_websocket_connection(websocket: WebSocket, board_id: str):
    await manager.connect(websocket, board_id)
    rag_processor = RAGProcessor()
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "resource_added":
                # Process new resource
                await rag_processor.process_resource(
                    data["resource"],
                    board_id
                )
                
                # Broadcast update
                await manager.broadcast(board_id, {
                    "type": "resource_processed",
                    "resource_id": data["resource"]["id"]
                })
                
            elif data["type"] == "search_request":
                # Handle search
                search_service = SemanticSearch()
                results = await search_service.search(
                    board_id,
                    data["query"]
                )
                
                await manager.send_personal_message(websocket, {
                    "type": "search_results",
                    "results": results
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

### 7. Frontend Integration

**File: `src/modules/rag-pipeline/hooks/useRAGSearch.ts`**
```typescript
import { useState, useCallback } from 'react';
import axios from 'axios';

interface SearchResult {
  text: string;
  metadata: {
    resource_id: string;
    resource_type: string;
    resource_title: string;
  };
  distance: number;
}

export function useRAGSearch(boardId: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  const search = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const response = await axios.post(`/api/boards/${boardId}/search`, {
        query,
        n_results: 5
      });
      
      setResults(response.data.results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);
  
  return { search, results, loading };
}
```

**File: `src/modules/rag-pipeline/components/RAGSearchPanel.tsx`**
```typescript
import { useState } from 'react';
import { useRAGSearch } from '../hooks/useRAGSearch';
import { Search } from 'lucide-react';

export function RAGSearchPanel({ boardId }: { boardId: string }) {
  const [query, setQuery] = useState('');
  const { search, results, loading } = useRAGSearch(boardId);
  
  const handleSearch = () => {
    if (query.trim()) {
      search(query);
    }
  };
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search board content..."
          className="flex-1 px-3 py-2 border rounded"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>
      
      {loading && <div>Searching...</div>}
      
      <div className="space-y-2">
        {results.map((result, idx) => (
          <div key={idx} className="p-3 border rounded">
            <div className="text-sm text-gray-500">
              {result.metadata.resource_type} - {result.metadata.resource_title}
            </div>
            <div className="text-sm mt-1">
              {result.text.substring(0, 200)}...
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## API Endpoints

```python
# backend/app/api/endpoints/rag.py
from fastapi import APIRouter, Depends, BackgroundTasks
from ..modules.rag.services.rag_processor import RAGProcessor
from ..modules.rag.retrieval.semantic_search import SemanticSearch

router = APIRouter()

@router.post("/boards/{board_id}/process")
async def process_board_content(
    board_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Trigger RAG processing for a board"""
    processor = RAGProcessor()
    
    # Get board resources
    resources = await get_board_resources(board_id)
    
    # Process in background
    background_tasks.add_task(
        processor.process_board,
        board_id,
        resources
    )
    
    return {"message": "Processing started"}

@router.post("/boards/{board_id}/search")
async def search_board(
    board_id: str,
    query: str,
    n_results: int = 5,
    current_user = Depends(get_current_user)
):
    """Search board content"""
    search_service = SemanticSearch()
    results = await search_service.search(board_id, query, n_results)
    
    return {"results": results}

@router.get("/boards/{board_id}/context")
async def get_chat_context(
    board_id: str,
    query: str,
    current_user = Depends(get_current_user)
):
    """Get context for AI chat"""
    search_service = SemanticSearch()
    context = await search_service.get_context_for_chat(board_id, query)
    
    return {"context": context}
```

## Testing

```python
# tests/test_rag_pipeline.py
import pytest
from ..modules.rag.services.rag_processor import RAGProcessor

@pytest.mark.asyncio
async def test_text_extraction():
    processor = RAGProcessor()
    resource = {
        "id": "test_1",
        "type": "text",
        "content": "This is a test document"
    }
    
    chunks = await processor.process_resource(resource, "board_1")
    assert len(chunks) > 0
    assert chunks[0]["text"] == "This is a test document"

@pytest.mark.asyncio
async def test_semantic_search():
    search = SemanticSearch()
    # First add some test data
    # Then test search
    results = await search.search("board_1", "test query")
    assert isinstance(results, list)
```

## Performance Considerations

1. **Batch Processing**: Process multiple resources in parallel
2. **Incremental Updates**: Only process new/changed resources
3. **Caching**: Cache embeddings for unchanged content
4. **Token Optimization**: Efficient chunking strategies
5. **Rate Limiting**: Respect API rate limits

## Next Steps

After implementing the RAG pipeline:
1. Add support for more file types
2. Implement hybrid search (semantic + keyword)
3. Add relevance feedback
4. Optimize embedding models
5. Implement streaming responses

This completes the Phase 2 RAG Pipeline implementation guide.