#!/usr/bin/env python3
"""
Example usage of the RAG pipeline for RAGBOARD.
Shows how to process documents and perform semantic search.
"""

import asyncio
import sys
import os
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.rag_pipeline import RAGPipeline
from app.services.processing import ProcessingService
from app.models.resource import Resource, ResourceType
from app.core.config import settings


async def example_process_document():
    """Example: Process a document and store embeddings."""
    print("\n📄 Example: Processing a Document")
    print("-" * 40)
    
    # Initialize services
    processing_service = ProcessingService()
    rag_pipeline = RAGPipeline()
    
    # Create a sample text file
    sample_file = Path("./sample_document.txt")
    sample_content = """
    Introduction to Machine Learning
    
    Machine learning is a subset of artificial intelligence (AI) that provides systems 
    the ability to automatically learn and improve from experience without being 
    explicitly programmed. Machine learning focuses on the development of computer 
    programs that can access data and use it to learn for themselves.
    
    Types of Machine Learning:
    
    1. Supervised Learning: The algorithm learns from labeled training data, helping 
    to predict outcomes for unforeseen data. Examples include classification and 
    regression problems.
    
    2. Unsupervised Learning: The algorithm learns from unlabeled data, finding 
    hidden patterns or intrinsic structures in input data. Examples include 
    clustering and dimensionality reduction.
    
    3. Reinforcement Learning: The algorithm learns to make decisions by taking 
    certain actions and observing the rewards/results. It's commonly used in 
    robotics, gaming, and navigation.
    
    Applications of Machine Learning:
    - Image and speech recognition
    - Medical diagnosis
    - Financial modeling
    - Recommendation systems
    - Autonomous vehicles
    
    The future of machine learning is promising, with ongoing research in areas 
    like deep learning, neural networks, and quantum machine learning.
    """
    
    sample_file.write_text(sample_content)
    
    # Create a resource object
    resource = Resource(
        id=uuid4(),
        name="Machine Learning Introduction",
        resource_type=ResourceType.TEXT,
        file_path=str(sample_file),
        size=len(sample_content),
        mime_type="text/plain",
        user_id=uuid4()
    )
    
    try:
        # Extract text
        print("1️⃣ Extracting text from document...")
        extracted_text, metadata = await processing_service.extract_text(resource)
        print(f"   ✅ Extracted {len(extracted_text)} characters")
        
        # Chunk the text
        print("\n2️⃣ Chunking text...")
        chunks = await rag_pipeline.chunk_text(
            text=extracted_text,
            chunk_size=500,
            chunk_overlap=100
        )
        print(f"   ✅ Created {len(chunks)} chunks")
        
        # Generate embeddings (requires valid OpenAI API key)
        if settings.has_ai_capabilities:
            print("\n3️⃣ Generating embeddings...")
            chunk_texts = [chunk["text"] for chunk in chunks]
            embeddings = await rag_pipeline.generate_embeddings_batch(chunk_texts)
            print(f"   ✅ Generated {len(embeddings)} embeddings")
            
            # Store in vector database
            print("\n4️⃣ Storing in vector database...")
            from app.services.vector_db import VectorDBService
            vector_service = VectorDBService()
            
            await vector_service.add_embeddings(
                resource_id=resource.id,
                chunks=chunks,
                embeddings=embeddings
            )
            print("   ✅ Stored embeddings in ChromaDB")
        else:
            print("\n⚠️  Skipping embedding generation - no AI API key configured")
    
    finally:
        # Cleanup
        sample_file.unlink()
    
    return resource.id


async def example_semantic_search(resource_id: uuid4 = None):
    """Example: Perform semantic search on indexed documents."""
    print("\n🔍 Example: Semantic Search")
    print("-" * 40)
    
    if not settings.has_ai_capabilities:
        print("⚠️  Cannot perform semantic search - no AI API key configured")
        return
    
    rag_pipeline = RAGPipeline()
    
    # Example queries
    queries = [
        "What is supervised learning?",
        "Tell me about reinforcement learning applications",
        "How does machine learning work?",
        "What are the types of ML algorithms?"
    ]
    
    for query in queries:
        print(f"\n📝 Query: '{query}'")
        
        try:
            # Get context using RAG
            context, citations = await rag_pipeline.get_context(
                query=query,
                resource_ids=[resource_id] if resource_id else None,
                top_k=3,
                score_threshold=0.5,
                max_context_length=1000
            )
            
            if context:
                print(f"✅ Found relevant context ({len(context)} chars)")
                print("\n--- Context ---")
                print(context[:500] + "..." if len(context) > 500 else context)
                print("\n--- Citations ---")
                for i, citation in enumerate(citations, 1):
                    print(f"{i}. {citation['resource_name']} (score: {citation['relevance_score']:.2f})")
            else:
                print("❌ No relevant context found")
                
        except Exception as e:
            print(f"❌ Search failed: {e}")


async def example_ai_chat_with_rag():
    """Example: AI chat enhanced with RAG context."""
    print("\n💬 Example: AI Chat with RAG")
    print("-" * 40)
    
    if not settings.has_ai_capabilities:
        print("⚠️  Cannot perform AI chat - no AI API key configured")
        return
    
    from app.services.ai_chat import AIChatService
    
    chat_service = AIChatService()
    
    # Example conversation with RAG context
    messages = [
        "What types of machine learning are there?",
        "Can you explain supervised learning in more detail?",
        "What are some real-world applications?"
    ]
    
    conversation_history = []
    
    for message in messages:
        print(f"\n👤 User: {message}")
        
        # Get RAG context for the message
        rag_pipeline = RAGPipeline()
        context, citations = await rag_pipeline.get_context(
            query=message,
            top_k=3
        )
        
        # Enhanced prompt with context
        enhanced_prompt = f"""Based on the following context, please answer the user's question.

Context:
{context}

User Question: {message}

Please provide a helpful and accurate response based on the context provided."""
        
        try:
            # Get AI response
            response = await chat_service.get_completion(
                messages=conversation_history + [{"role": "user", "content": enhanced_prompt}],
                model=settings.default_ai_model
            )
            
            print(f"🤖 AI: {response}")
            
            # Update conversation history
            conversation_history.extend([
                {"role": "user", "content": message},
                {"role": "assistant", "content": response}
            ])
            
        except Exception as e:
            print(f"❌ AI chat failed: {e}")


async def main():
    """Run all examples."""
    print("🚀 RAG Pipeline Usage Examples")
    print("=" * 50)
    
    # Check configuration
    print("\n⚙️  Configuration Status:")
    print(f"   OpenAI API Key: {'✅ Configured' if settings.openai_api_key else '❌ Not configured'}")
    print(f"   ChromaDB Path: {settings.chroma_persist_path}")
    
    if not settings.has_ai_capabilities:
        print("\n⚠️  Warning: No AI API keys configured.")
        print("   Add OPENAI_API_KEY to your .env file for full functionality.")
    
    # Run examples
    print("\n" + "=" * 50)
    
    # Process a document
    resource_id = await example_process_document()
    
    # Perform semantic search
    await example_semantic_search(resource_id)
    
    # AI chat with RAG
    await example_ai_chat_with_rag()
    
    print("\n✅ All examples completed!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())