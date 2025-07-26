# RAGBOARD RAG Pipeline Documentation

## Overview

The RAG (Retrieval-Augmented Generation) pipeline in RAGBOARD provides powerful document processing, embedding generation, and semantic search capabilities. It enables AI-powered chat with context from your documents.

## Architecture

### Core Components

1. **Document Processing Service** (`app/services/processing.py`)
   - Extracts text from various file formats
   - Supports PDF, DOCX, TXT, images (OCR), audio, video, and web pages
   - Handles file upload and processing queue

2. **RAG Pipeline** (`app/services/rag_pipeline.py`)
   - Text chunking with configurable overlap
   - Embedding generation using OpenAI API
   - Context retrieval for queries
   - Reranking for improved relevance

3. **Vector Database Service** (`app/services/vector_db.py`)
   - ChromaDB integration (default)
   - Optional Pinecone and Weaviate support
   - Efficient similarity search
   - Metadata filtering

## Setup

### 1. Install Dependencies

```bash
cd ragboard/backend
./setup_rag.sh
```

Or manually:

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file with:

```env
# Required for embeddings and AI chat
OPENAI_API_KEY=your-openai-api-key-here

# Optional
ANTHROPIC_API_KEY=your-anthropic-api-key

# Vector Database (ChromaDB by default)
CHROMA_PERSIST_DIRECTORY=./chroma_db
CHROMA_COLLECTION_NAME=ragboard_vectors
```

### 3. System Dependencies

For OCR support (optional):
```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr

# macOS
brew install tesseract
```

## Usage

### Processing Documents

```python
from app.services.processing import ProcessingService
from app.models.resource import Resource, ResourceType

# Initialize service
processing_service = ProcessingService()

# Create resource
resource = Resource(
    id=uuid4(),
    name="document.pdf",
    resource_type=ResourceType.PDF,
    file_path="/path/to/document.pdf",
    user_id=user_id
)

# Process document (extracts text and generates embeddings)
await processing_service.process_resource(resource.id)
```

### Semantic Search

```python
from app.services.rag_pipeline import RAGPipeline

pipeline = RAGPipeline()

# Search for relevant content
context, citations = await pipeline.get_context(
    query="What is machine learning?",
    resource_ids=[resource_id],  # Optional: filter by resources
    top_k=5,                     # Number of chunks to retrieve
    score_threshold=0.7,         # Minimum similarity score
    max_context_length=3000      # Maximum context length
)
```

### AI Chat with RAG

```python
from app.services.ai_chat import AIChatService
from app.services.rag_pipeline import RAGPipeline

# Get context for query
rag_pipeline = RAGPipeline()
context, citations = await rag_pipeline.get_context(query=user_message)

# Enhance prompt with context
enhanced_prompt = f"""
Context: {context}

Question: {user_message}

Please answer based on the provided context.
"""

# Get AI response
chat_service = AIChatService()
response = await chat_service.get_completion(
    messages=[{"role": "user", "content": enhanced_prompt}]
)
```

## Supported File Types

### Documents
- **PDF**: Text extraction with PyPDF2
- **DOCX**: Full document parsing including tables
- **TXT/MD/CSV**: Direct text extraction

### Media
- **Images**: OCR with Tesseract (JPG, PNG, etc.)
- **Audio**: Transcription with Whisper (MP3, WAV, etc.)
- **Video**: YouTube transcripts or audio extraction

### Web
- **Web Pages**: Content extraction with BeautifulSoup
- **YouTube**: Automatic transcript extraction

## Configuration Options

### Text Chunking
```python
chunks = await pipeline.chunk_text(
    text=content,
    chunk_size=1000,        # Characters per chunk
    chunk_overlap=200,      # Overlap between chunks
    metadata={"source": "document.pdf"}
)
```

### Embedding Models
```python
# Default: OpenAI text-embedding-3-small
embeddings = await pipeline.generate_embedding(
    text="sample text",
    model="text-embedding-3-small"  # Or text-embedding-3-large
)
```

### Vector Search
```python
results = await vector_service.search(
    query_embedding=embedding,
    resource_ids=[id1, id2],  # Optional filtering
    top_k=10,                 # Result count
    score_threshold=0.5       # Minimum score
)
```

## Advanced Features

### Batch Processing
```python
# Process multiple documents
for resource_id in resource_ids:
    await processing_service.queue_resource(resource_id)
```

### Reranking
```python
# Improve result relevance with LLM reranking
reranked_results = await pipeline.rerank_results(
    query="specific question",
    results=search_results,
    model="gpt-3.5-turbo"
)
```

### Custom Metadata
```python
# Add metadata to chunks
chunks = await pipeline.chunk_text(
    text=content,
    metadata={
        "chapter": "Introduction",
        "page": 1,
        "author": "John Doe"
    }
)
```

## Performance Optimization

### 1. Batch Operations
- Use `generate_embeddings_batch()` for multiple texts
- Process documents in parallel when possible

### 2. Caching
- ChromaDB persists embeddings locally
- Reuse embeddings for unchanged documents

### 3. Chunk Size Tuning
- Smaller chunks (500-1000): Better precision
- Larger chunks (1000-2000): More context

## Troubleshooting

### Common Issues

1. **"OpenAI API key not configured"**
   - Add `OPENAI_API_KEY` to `.env` file

2. **"No text extracted from resource"**
   - Check file format support
   - Verify file path is correct
   - For PDFs: ensure text is not image-based

3. **Low relevance scores**
   - Adjust chunk size and overlap
   - Use reranking for better results
   - Check embedding model compatibility

### Debug Mode

Enable detailed logging:
```env
LOG_LEVEL=DEBUG
```

## API Integration

### REST Endpoints

```python
# Process resource
POST /api/v1/resources/{resource_id}/process

# Search
POST /api/v1/search
{
    "query": "search text",
    "resource_ids": ["uuid1", "uuid2"],
    "limit": 10
}

# Get context for chat
POST /api/v1/chat/context
{
    "message": "user question",
    "resource_ids": ["uuid1"]
}
```

## Testing

Run the test suite:
```bash
python test_rag_pipeline.py
```

Run usage examples:
```bash
python example_rag_usage.py
```

## Best Practices

1. **Document Preparation**
   - Use high-quality PDFs with text layers
   - Organize content with clear structure
   - Add meaningful filenames

2. **Chunking Strategy**
   - Adjust chunk size based on content type
   - Use larger overlap for technical documents
   - Consider sentence boundaries

3. **Search Optimization**
   - Use specific queries
   - Filter by relevant resources
   - Adjust score thresholds based on use case

4. **Cost Management**
   - Monitor OpenAI API usage
   - Cache embeddings locally
   - Use smaller embedding models when appropriate

## Future Enhancements

- [ ] Support for more file formats (EPUB, RTF)
- [ ] Multi-language support
- [ ] Custom embedding models
- [ ] Hybrid search (keyword + semantic)
- [ ] Automatic document categorization
- [ ] Real-time document updates