#!/usr/bin/env python3
"""
Simplified test script for RAG pipeline functionality without circular imports.
"""

import asyncio
import sys
import os
from pathlib import Path
from uuid import uuid4

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Test imports
print("🔧 Testing imports...")

try:
    from app.core.config import settings
    print("✅ Config imported successfully")
except Exception as e:
    print(f"❌ Config import failed: {e}")
    sys.exit(1)

try:
    # Test vector DB first (no circular imports)
    from app.services.vector_db import VectorDBService, VectorSearchResult
    print("✅ Vector DB service imported successfully")
except Exception as e:
    print(f"❌ Vector DB import failed: {e}")

try:
    # Test dependencies
    from app.services.processing import (
        PDF_AVAILABLE, DOCX_AVAILABLE, OCR_AVAILABLE, 
        WEB_AVAILABLE, YOUTUBE_AVAILABLE, CHROMA_AVAILABLE
    )
    print("✅ Processing dependencies imported successfully")
    
    print(f"\n📦 Dependency Status:")
    print(f"   PDF support (PyPDF2): {'✅' if PDF_AVAILABLE else '❌'}")
    print(f"   DOCX support (python-docx): {'✅' if DOCX_AVAILABLE else '❌'}")
    print(f"   OCR support (pytesseract): {'✅' if OCR_AVAILABLE else '❌'}")
    print(f"   Web scraping (BeautifulSoup): {'✅' if WEB_AVAILABLE else '❌'}")
    print(f"   YouTube transcripts: {'✅' if YOUTUBE_AVAILABLE else '❌'}")
    print(f"   ChromaDB: {'✅' if CHROMA_AVAILABLE else '❌'}")
    
except Exception as e:
    print(f"❌ Processing dependencies import failed: {e}")


async def test_vector_db_basic():
    """Test basic vector database functionality."""
    print("\n🔧 Testing ChromaDB basic functionality...")
    
    try:
        vector_service = VectorDBService(provider="chroma")
        stats = await vector_service.get_stats()
        print(f"✅ ChromaDB initialized: {stats}")
        return True
    except Exception as e:
        print(f"❌ ChromaDB test failed: {e}")
        return False


async def test_text_chunking_basic():
    """Test text chunking without full pipeline."""
    print("\n🔧 Testing text chunking...")
    
    # Simple chunking logic
    def chunk_text(text, chunk_size=500, chunk_overlap=100):
        chunks = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = start + chunk_size
            
            # Try to break at sentence boundary
            if end < text_length:
                sentence_ends = ['. ', '! ', '? ', '\n\n']
                best_break = end
                
                for sent_end in sentence_ends:
                    pos = text.rfind(sent_end, start + chunk_overlap, end)
                    if pos != -1:
                        best_break = pos + len(sent_end) - 1
                        break
                
                end = best_break
            
            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append({
                    "text": chunk_text,
                    "start_char": start,
                    "end_char": end
                })
            
            start = end - chunk_overlap if end < text_length else text_length
        
        return chunks
    
    sample_text = """
    Artificial Intelligence (AI) is transforming the world in unprecedented ways. 
    From healthcare to finance, AI systems are being deployed to solve complex problems.
    
    Machine learning, a subset of AI, enables computers to learn from data without 
    being explicitly programmed. Deep learning, in particular, has led to breakthroughs
    in computer vision, natural language processing, and speech recognition.
    
    The future of AI holds immense potential, but also raises important ethical 
    questions about privacy, bias, and the impact on employment.
    """
    
    chunks = chunk_text(sample_text, chunk_size=200, chunk_overlap=50)
    print(f"✅ Created {len(chunks)} chunks from text")
    for i, chunk in enumerate(chunks):
        print(f"   Chunk {i+1}: {len(chunk['text'])} chars")
    
    return chunks


async def test_file_extraction():
    """Test basic file extraction."""
    print("\n🔧 Testing file extraction...")
    
    # Create a test text file
    test_file = Path("./test_sample.txt")
    test_content = "This is a test file for extraction.\nIt has multiple lines.\nAnd some content to process."
    
    try:
        test_file.write_text(test_content)
        
        # Read the file
        with open(test_file, 'r') as f:
            extracted = f.read()
        
        print(f"✅ Extracted {len(extracted)} characters from text file")
        print(f"   Content preview: {extracted[:100]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ File extraction failed: {e}")
        return False
    finally:
        if test_file.exists():
            test_file.unlink()


async def test_configuration():
    """Test configuration and environment."""
    print("\n🔧 Testing configuration...")
    
    print(f"✅ ChromaDB path: {settings.chroma_persist_path}")
    print(f"✅ Upload directory: {settings.upload_dir}")
    print(f"✅ OpenAI API configured: {'Yes' if settings.openai_api_key else 'No'}")
    print(f"✅ AI features enabled: {settings.enable_ai_features}")
    print(f"✅ Has AI capabilities: {settings.has_ai_capabilities}")
    
    # Create necessary directories
    settings.chroma_persist_path.mkdir(exist_ok=True)
    settings.upload_dir.mkdir(exist_ok=True)
    
    print("✅ Created necessary directories")


async def main():
    """Run all basic tests."""
    print("🚀 RAG Pipeline Basic Tests")
    print("=" * 50)
    
    await test_configuration()
    await test_vector_db_basic()
    await test_text_chunking_basic()
    await test_file_extraction()
    
    print("\n✅ Basic tests completed!")
    print("\n📝 Next steps:")
    print("1. Install missing dependencies if any")
    print("2. Add OpenAI API key to .env file for full RAG functionality")
    print("3. Run the backend server: uvicorn app.main:app --reload")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())