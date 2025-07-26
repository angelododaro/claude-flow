#!/usr/bin/env python3
"""
Test script for RAG pipeline functionality.
"""

import asyncio
import sys
import os
from pathlib import Path
from uuid import uuid4

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.rag_pipeline import RAGPipeline
from app.services.vector_db import VectorDBService
from app.services.processing import ProcessingService
from app.core.config import settings

# Set test OpenAI API key if not configured
if not settings.openai_api_key:
    os.environ["OPENAI_API_KEY"] = "test-key-replace-with-actual"
    print("⚠️  Warning: OPENAI_API_KEY not set. Please set it in .env file.")
    print("   Using placeholder key for testing.")


async def test_text_chunking():
    """Test text chunking functionality."""
    print("\n🔧 Testing text chunking...")
    
    pipeline = RAGPipeline()
    
    # Sample text
    sample_text = """
    Artificial Intelligence (AI) is transforming the world in unprecedented ways. 
    From healthcare to finance, AI systems are being deployed to solve complex problems.
    
    Machine learning, a subset of AI, enables computers to learn from data without 
    being explicitly programmed. Deep learning, in particular, has led to breakthroughs
    in computer vision, natural language processing, and speech recognition.
    
    The future of AI holds immense potential, but also raises important ethical 
    questions about privacy, bias, and the impact on employment.
    """
    
    chunks = await pipeline.chunk_text(
        text=sample_text,
        chunk_size=200,
        chunk_overlap=50
    )
    
    print(f"✅ Created {len(chunks)} chunks from text")
    for i, chunk in enumerate(chunks):
        print(f"   Chunk {i+1}: {len(chunk['text'])} chars")
    
    return chunks


async def test_embedding_generation():
    """Test embedding generation."""
    print("\n🔧 Testing embedding generation...")
    
    pipeline = RAGPipeline()
    
    if not settings.openai_api_key or settings.openai_api_key == "test-key-replace-with-actual":
        print("⚠️  Skipping embedding test - no valid OpenAI API key")
        return None
    
    try:
        # Test single embedding
        text = "This is a test sentence for embedding generation."
        embedding = await pipeline.generate_embedding(text)
        
        print(f"✅ Generated embedding with {len(embedding)} dimensions")
        
        # Test batch embeddings
        texts = [
            "First test sentence.",
            "Second test sentence.",
            "Third test sentence."
        ]
        embeddings = await pipeline.generate_embeddings_batch(texts)
        
        print(f"✅ Generated {len(embeddings)} embeddings in batch")
        
        return embeddings
        
    except Exception as e:
        print(f"❌ Embedding generation failed: {e}")
        return None


async def test_vector_db():
    """Test vector database operations."""
    print("\n🔧 Testing vector database...")
    
    vector_service = VectorDBService(provider="chroma")
    
    # Get stats
    stats = await vector_service.get_stats()
    print(f"✅ Vector DB initialized: {stats}")
    
    # Test adding dummy embeddings
    if settings.openai_api_key and settings.openai_api_key != "test-key-replace-with-actual":
        resource_id = uuid4()
        chunks = [
            {"text": "Test chunk 1", "page_number": 1},
            {"text": "Test chunk 2", "page_number": 2}
        ]
        # Generate dummy embeddings (1536 dimensions for OpenAI)
        embeddings = [[0.1] * 1536 for _ in chunks]
        
        count = await vector_service.add_embeddings(
            resource_id=resource_id,
            chunks=chunks,
            embeddings=embeddings
        )
        
        print(f"✅ Added {count} embeddings to vector DB")
        
        # Test search
        query_embedding = [0.1] * 1536
        results = await vector_service.search(
            query_embedding=query_embedding,
            top_k=5
        )
        
        print(f"✅ Search returned {len(results)} results")
    else:
        print("⚠️  Skipping vector DB test - no valid OpenAI API key")


async def test_document_extraction():
    """Test document extraction capabilities."""
    print("\n🔧 Testing document extraction...")
    
    processing_service = ProcessingService()
    
    # Create test files
    test_dir = Path("./test_files")
    test_dir.mkdir(exist_ok=True)
    
    # Test TXT file
    txt_file = test_dir / "test.txt"
    txt_file.write_text("This is a test text file.\nIt has multiple lines.\nAnd some content.")
    
    # Test extraction
    from app.models.resource import Resource, ResourceType
    
    # Create mock resource for TXT
    resource = Resource(
        id=uuid4(),
        name="test.txt",
        resource_type=ResourceType.TEXT,
        file_path=str(txt_file),
        size=txt_file.stat().st_size,
        mime_type="text/plain",
        user_id=uuid4()
    )
    
    text, metadata = await processing_service.extract_text(resource)
    print(f"✅ Extracted {len(text)} chars from TXT file")
    print(f"   Metadata: {metadata}")
    
    # Clean up
    txt_file.unlink()
    test_dir.rmdir()


async def test_rag_context():
    """Test RAG context retrieval."""
    print("\n🔧 Testing RAG context retrieval...")
    
    pipeline = RAGPipeline()
    
    if not settings.openai_api_key or settings.openai_api_key == "test-key-replace-with-actual":
        print("⚠️  Skipping RAG context test - no valid OpenAI API key")
        return
    
    try:
        # Test with a query (even if no documents are indexed)
        query = "What is artificial intelligence?"
        context, citations = await pipeline.get_context(
            query=query,
            top_k=3,
            score_threshold=0.5
        )
        
        if context:
            print(f"✅ Retrieved context: {len(context)} chars")
            print(f"✅ Citations: {len(citations)} sources")
        else:
            print("✅ No context found (expected if no documents indexed)")
            
    except Exception as e:
        print(f"❌ Context retrieval failed: {e}")


async def main():
    """Run all tests."""
    print("🚀 Starting RAG Pipeline Tests")
    print("=" * 50)
    
    # Check dependencies
    from app.services.processing import (
        PDF_AVAILABLE, DOCX_AVAILABLE, OCR_AVAILABLE, 
        WEB_AVAILABLE, YOUTUBE_AVAILABLE, CHROMA_AVAILABLE
    )
    
    print("\n📦 Dependency Status:")
    print(f"   PDF support (PyPDF2): {'✅' if PDF_AVAILABLE else '❌'}")
    print(f"   DOCX support (python-docx): {'✅' if DOCX_AVAILABLE else '❌'}")
    print(f"   OCR support (pytesseract): {'✅' if OCR_AVAILABLE else '❌'}")
    print(f"   Web scraping (BeautifulSoup): {'✅' if WEB_AVAILABLE else '❌'}")
    print(f"   YouTube transcripts: {'✅' if YOUTUBE_AVAILABLE else '❌'}")
    print(f"   ChromaDB: {'✅' if CHROMA_AVAILABLE else '❌'}")
    
    # Run tests
    await test_text_chunking()
    await test_embedding_generation()
    await test_vector_db()
    await test_document_extraction()
    await test_rag_context()
    
    print("\n✅ All tests completed!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())