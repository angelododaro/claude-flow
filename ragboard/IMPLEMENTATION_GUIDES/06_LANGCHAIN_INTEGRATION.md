# LangChain Python Integration Guide for RAGBOARD

## Overview
Integrate LangChain into ragboard's FastAPI backend to optimize AI interactions, reduce costs, and enable advanced RAG (Retrieval-Augmented Generation) capabilities.

## Installation

```bash
# Backend dependencies
pip install langchain langchain-openai langchain-anthropic langchain-community
pip install tiktoken faiss-cpu
pip install langchain-experimental  # For advanced features
```

## Implementation Steps

### 1. LangChain Service Configuration (backend/app/services/langchain_service.py)

```python
from langchain.chat_models import ChatOpenAI, ChatAnthropic
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS, Chroma
from langchain.memory import ConversationSummaryBufferMemory
from langchain.chains import ConversationalRetrievalChain
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import PyPDFLoader, TextLoader
from langchain.prompts import PromptTemplate, ChatPromptTemplate
from langchain.callbacks import get_openai_callback
from typing import List, Dict, Any
import asyncio
from app.core.config import settings

class LangChainService:
    def __init__(self):
        # Initialize LLMs with fallback
        self.primary_llm = ChatOpenAI(
            temperature=0.7,
            model="gpt-3.5-turbo-16k",
            openai_api_key=settings.OPENAI_API_KEY,
            request_timeout=30,
            max_retries=3
        )
        
        self.fallback_llm = ChatAnthropic(
            temperature=0.7,
            model="claude-2",
            anthropic_api_key=settings.ANTHROPIC_API_KEY,
        )
        
        # Initialize embeddings
        self.embeddings = OpenAIEmbeddings(
            openai_api_key=settings.OPENAI_API_KEY
        )
        
        # Text splitter for documents
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", "!", "?", " ", ""]
        )
        
    async def create_rag_chain(
        self, 
        board_id: str,
        user_id: str,
        vectorstore: Any = None
    ) -> ConversationalRetrievalChain:
        """Create a RAG chain for board-specific context"""
        
        # Load or create vector store
        if not vectorstore:
            vectorstore = await self._get_board_vectorstore(board_id)
        
        # Create memory for conversation
        memory = ConversationSummaryBufferMemory(
            llm=self.primary_llm,
            memory_key="chat_history",
            return_messages=True,
            max_token_limit=2000
        )
        
        # Custom prompt for board context
        prompt_template = """You are an AI assistant for RAGBOARD. 
        Use the following context from the board to answer questions:
        
        Context: {context}
        
        Chat History: {chat_history}
        
        Human: {question}
        
        Provide a helpful, accurate response based on the board content.
        If you don't know something, say so clearly.
        
        Assistant:"""
        
        PROMPT = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "chat_history", "question"]
        )
        
        # Create retrieval chain
        chain = ConversationalRetrievalChain.from_llm(
            llm=self.primary_llm,
            retriever=vectorstore.as_retriever(
                search_type="mmr",  # Maximum Marginal Relevance
                search_kwargs={"k": 5, "fetch_k": 10}
            ),
            memory=memory,
            combine_docs_chain_kwargs={"prompt": PROMPT},
            return_source_documents=True,
            verbose=True
        )
        
        return chain
    
    async def _get_board_vectorstore(self, board_id: str) -> FAISS:
        """Get or create vector store for board"""
        # Check if exists in ChromaDB
        collection_name = f"board_{board_id}"
        
        # For demo, create FAISS in-memory
        # In production, use persistent ChromaDB
        documents = await self._load_board_documents(board_id)
        
        if documents:
            texts = self.text_splitter.split_documents(documents)
            vectorstore = FAISS.from_documents(
                texts,
                self.embeddings
            )
            return vectorstore
        
        # Return empty vector store
        return FAISS.from_texts([""], self.embeddings)
```

### 2. Smart Prompt Optimization (backend/app/services/prompt_optimizer.py)

```python
from langchain.prompts import FewShotPromptTemplate
from langchain.prompts.example_selector import MaxMarginalRelevanceExampleSelector
from langchain.schema import Document
import json

class PromptOptimizer:
    def __init__(self, embeddings):
        self.embeddings = embeddings
        self.example_store = {}
        
    def create_optimized_prompt(
        self,
        task_type: str,
        examples: List[Dict[str, str]] = None
    ) -> FewShotPromptTemplate:
        """Create optimized prompts with few-shot examples"""
        
        # Task-specific templates
        templates = {
            "summarization": {
                "prefix": "Summarize the following content concisely:",
                "suffix": "Summary:",
                "input_variables": ["content"],
                "example_prompt": PromptTemplate(
                    input_variables=["content", "summary"],
                    template="Content: {content}\nSummary: {summary}"
                )
            },
            "question_answering": {
                "prefix": "Answer questions based on the context:",
                "suffix": "Answer:",
                "input_variables": ["context", "question"],
                "example_prompt": PromptTemplate(
                    input_variables=["context", "question", "answer"],
                    template="Context: {context}\nQuestion: {question}\nAnswer: {answer}"
                )
            },
            "content_generation": {
                "prefix": "Generate content based on the following:",
                "suffix": "Generated content:",
                "input_variables": ["topic", "style"],
                "example_prompt": PromptTemplate(
                    input_variables=["topic", "style", "content"],
                    template="Topic: {topic}\nStyle: {style}\nContent: {content}"
                )
            }
        }
        
        template_config = templates.get(task_type, templates["question_answering"])
        
        if examples:
            # Use semantic similarity to select best examples
            example_selector = MaxMarginalRelevanceExampleSelector.from_examples(
                examples,
                self.embeddings,
                FAISS,
                k=3,  # Select top 3 most relevant examples
            )
            
            return FewShotPromptTemplate(
                example_selector=example_selector,
                example_prompt=template_config["example_prompt"],
                prefix=template_config["prefix"],
                suffix=template_config["suffix"],
                input_variables=template_config["input_variables"],
            )
        
        # Return simple prompt if no examples
        return PromptTemplate(
            template=f"{template_config['prefix']}\n{{input}}\n{template_config['suffix']}",
            input_variables=["input"]
        )
```

### 3. Cost-Optimized Chain Router (backend/app/services/chain_router.py)

```python
from langchain.chains import LLMChain
from langchain.callbacks import get_openai_callback
from enum import Enum
import tiktoken

class TaskComplexity(Enum):
    SIMPLE = "simple"
    MEDIUM = "medium"
    COMPLEX = "complex"

class ChainRouter:
    def __init__(self, langchain_service: LangChainService):
        self.service = langchain_service
        self.encoding = tiktoken.encoding_for_model("gpt-3.5-turbo")
        
    def estimate_complexity(self, input_text: str, context_size: int = 0) -> TaskComplexity:
        """Estimate task complexity to route to appropriate model"""
        token_count = len(self.encoding.encode(input_text))
        
        # Simple heuristics (customize based on your needs)
        if token_count < 100 and context_size < 1000:
            return TaskComplexity.SIMPLE
        elif token_count < 500 and context_size < 5000:
            return TaskComplexity.MEDIUM
        else:
            return TaskComplexity.COMPLEX
    
    async def route_request(
        self,
        task: str,
        input_text: str,
        context: str = None,
        use_rag: bool = False
    ) -> Dict[str, Any]:
        """Route request to appropriate model based on complexity"""
        
        complexity = self.estimate_complexity(input_text, len(context or ""))
        
        # Select model based on complexity
        if complexity == TaskComplexity.SIMPLE:
            # Use cheaper, faster model
            llm = ChatOpenAI(
                model="gpt-3.5-turbo",
                temperature=0.3,
                max_tokens=500
            )
        elif complexity == TaskComplexity.MEDIUM:
            llm = self.service.primary_llm
        else:
            # Use more powerful model for complex tasks
            llm = ChatOpenAI(
                model="gpt-4",
                temperature=0.7,
                max_tokens=2000
            )
        
        # Track costs
        with get_openai_callback() as cb:
            if use_rag:
                # Use RAG chain for context-aware responses
                chain = await self.service.create_rag_chain("board_id", "user_id")
                result = await chain.arun(input_text)
            else:
                # Simple completion
                chain = LLMChain(llm=llm, prompt=PromptTemplate(
                    template="{input}",
                    input_variables=["input"]
                ))
                result = await chain.arun(input_text)
            
            return {
                "result": result,
                "complexity": complexity.value,
                "tokens_used": cb.total_tokens,
                "cost": cb.total_cost,
                "model": llm.model_name
            }
```

### 4. Advanced RAG Pipeline (backend/app/services/advanced_rag.py)

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain.chains import HypotheticalDocumentEmbedder

class AdvancedRAGPipeline:
    def __init__(self, langchain_service: LangChainService):
        self.service = langchain_service
        
    def create_hybrid_retriever(self, vectorstore):
        """Create hybrid retriever with multiple strategies"""
        
        # 1. Multi-query retriever - generates multiple queries
        multi_query_retriever = MultiQueryRetriever.from_llm(
            retriever=vectorstore.as_retriever(),
            llm=self.service.primary_llm
        )
        
        # 2. Contextual compression - filters irrelevant content
        compressor = LLMChainExtractor.from_llm(self.service.primary_llm)
        compression_retriever = ContextualCompressionRetriever(
            base_compressor=compressor,
            base_retriever=multi_query_retriever
        )
        
        return compression_retriever
    
    async def smart_document_processing(self, documents: List[Document]) -> List[Document]:
        """Process documents with smart chunking and metadata"""
        
        processed_docs = []
        
        for doc in documents:
            # Smart chunking based on document type
            if doc.metadata.get("type") == "code":
                # Use AST-aware splitting for code
                chunks = self._split_code_intelligently(doc.page_content)
            elif doc.metadata.get("type") == "markdown":
                # Respect markdown structure
                chunks = self._split_markdown_intelligently(doc.page_content)
            else:
                # Default splitting
                chunks = self.service.text_splitter.split_text(doc.page_content)
            
            # Add rich metadata
            for i, chunk in enumerate(chunks):
                processed_docs.append(Document(
                    page_content=chunk,
                    metadata={
                        **doc.metadata,
                        "chunk_id": i,
                        "total_chunks": len(chunks),
                        "semantic_type": self._classify_content(chunk)
                    }
                ))
        
        return processed_docs
    
    def _classify_content(self, text: str) -> str:
        """Classify content type for better retrieval"""
        # Simple heuristic classification
        if any(keyword in text.lower() for keyword in ["def ", "class ", "function"]):
            return "code"
        elif any(keyword in text.lower() for keyword in ["conclusion", "summary", "abstract"]):
            return "summary"
        elif "?" in text:
            return "question"
        else:
            return "general"
```

### 5. Integration with Existing AI Chat (backend/app/services/ai_chat.py)

```python
from app.services.langchain_service import LangChainService
from app.services.chain_router import ChainRouter

class EnhancedAIChatService:
    def __init__(self):
        self.langchain = LangChainService()
        self.router = ChainRouter(self.langchain)
        self.conversation_chains = {}  # Cache chains per board
        
    async def process_message(
        self,
        board_id: str,
        user_id: str,
        message: str,
        use_rag: bool = True
    ) -> Dict[str, Any]:
        """Process chat message with LangChain optimization"""
        
        # Get or create conversation chain
        chain_key = f"{board_id}:{user_id}"
        if chain_key not in self.conversation_chains:
            self.conversation_chains[chain_key] = await self.langchain.create_rag_chain(
                board_id, user_id
            )
        
        chain = self.conversation_chains[chain_key]
        
        # Route based on complexity
        result = await self.router.route_request(
            task="chat",
            input_text=message,
            use_rag=use_rag
        )
        
        # Log usage for analytics
        await self._log_usage(
            user_id=user_id,
            board_id=board_id,
            tokens=result["tokens_used"],
            cost=result["cost"],
            model=result["model"]
        )
        
        return {
            "response": result["result"],
            "sources": result.get("source_documents", []),
            "cost": result["cost"],
            "model_used": result["model"]
        }
```

### 6. API Endpoints (backend/app/api/endpoints/ai_enhanced.py)

```python
from fastapi import APIRouter, Depends, HTTPException
from app.services.enhanced_ai_chat import EnhancedAIChatService

router = APIRouter()
ai_service = EnhancedAIChatService()

@router.post("/ai/chat/enhanced")
async def enhanced_chat(
    board_id: str,
    message: str,
    use_rag: bool = True,
    current_user = Depends(get_current_user)
):
    """Enhanced AI chat with LangChain optimization"""
    try:
        response = await ai_service.process_message(
            board_id=board_id,
            user_id=current_user.id,
            message=message,
            use_rag=use_rag
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ai/summarize/board/{board_id}")
async def summarize_board(
    board_id: str,
    style: str = "concise",
    current_user = Depends(get_current_user)
):
    """Summarize entire board content"""
    # Implementation here
    pass

@router.post("/ai/generate/insights/{board_id}")
async def generate_insights(
    board_id: str,
    insight_type: str = "patterns",
    current_user = Depends(get_current_user)
):
    """Generate insights from board content"""
    # Implementation here
    pass
```

### 7. Document Processing Enhancement (backend/app/services/document_processor.py)

```python
from langchain.document_loaders import (
    PyPDFLoader, 
    TextLoader, 
    UnstructuredMarkdownLoader,
    YoutubeLoader,
    WebBaseLoader
)
from langchain.document_transformers import Html2TextTransformer

class EnhancedDocumentProcessor:
    def __init__(self, langchain_service: LangChainService):
        self.langchain = langchain_service
        
    async def process_resource(self, resource: Resource) -> List[Document]:
        """Process various resource types for RAG"""
        
        if resource.type == "pdf":
            loader = PyPDFLoader(resource.file_path)
        elif resource.type == "url":
            loader = WebBaseLoader(resource.url)
        elif resource.type == "youtube":
            loader = YoutubeLoader.from_youtube_url(
                resource.url,
                add_video_info=True
            )
        elif resource.type == "text":
            loader = TextLoader(resource.file_path)
        else:
            return []
        
        # Load and split documents
        documents = loader.load()
        split_docs = self.langchain.text_splitter.split_documents(documents)
        
        # Add metadata
        for doc in split_docs:
            doc.metadata.update({
                "resource_id": resource.id,
                "board_id": resource.board_id,
                "type": resource.type,
                "created_at": resource.created_at.isoformat()
            })
        
        return split_docs
```

### 8. Cost Monitoring Dashboard (backend/app/services/cost_monitor.py)

```python
from datetime import datetime, timedelta
from sqlalchemy import func

class AIUsageMonitor:
    def __init__(self, db_session):
        self.db = db_session
        
    async def get_usage_stats(self, user_id: str, days: int = 30) -> Dict:
        """Get AI usage statistics for cost monitoring"""
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        stats = await self.db.query(
            func.sum(AIUsage.tokens).label("total_tokens"),
            func.sum(AIUsage.cost).label("total_cost"),
            func.count(AIUsage.id).label("request_count"),
            AIUsage.model
        ).filter(
            AIUsage.user_id == user_id,
            AIUsage.created_at >= cutoff_date
        ).group_by(AIUsage.model).all()
        
        return {
            "period_days": days,
            "total_cost": sum(s.total_cost for s in stats),
            "total_tokens": sum(s.total_tokens for s in stats),
            "by_model": [
                {
                    "model": s.model,
                    "cost": s.total_cost,
                    "tokens": s.total_tokens,
                    "requests": s.request_count
                }
                for s in stats
            ],
            "daily_average": sum(s.total_cost for s in stats) / days
        }
```

## Frontend Integration

```typescript
// src/services/enhancedAI.ts
export class EnhancedAIService {
  async chat(boardId: string, message: string, useRAG: boolean = true) {
    const response = await api.post('/ai/chat/enhanced', {
      board_id: boardId,
      message,
      use_rag: useRAG
    });
    
    return {
      text: response.data.response,
      sources: response.data.sources,
      cost: response.data.cost,
      model: response.data.model_used
    };
  }
  
  async getCostEstimate(message: string): Promise<number> {
    // Estimate cost before sending
    const tokenCount = this.estimateTokens(message);
    return tokenCount * 0.002 / 1000; // GPT-3.5 pricing
  }
}
```

## Testing

```python
# tests/test_langchain_integration.py
import pytest
from app.services.langchain_service import LangChainService

@pytest.mark.asyncio
async def test_rag_chain_creation():
    service = LangChainService()
    chain = await service.create_rag_chain("test_board", "test_user")
    
    response = await chain.arun("What is on this board?")
    assert response is not None

@pytest.mark.asyncio
async def test_cost_optimization():
    router = ChainRouter(LangChainService())
    
    simple_result = await router.route_request(
        "chat",
        "Hello",
        use_rag=False
    )
    
    assert simple_result["complexity"] == "simple"
    assert simple_result["cost"] < 0.001
```

## Deployment Considerations

1. **Model Selection**:
   - Use GPT-3.5-turbo for most queries
   - Reserve GPT-4 for complex analysis
   - Implement Claude fallback for rate limits

2. **Caching Strategy**:
   - Cache embeddings for frequently accessed documents
   - Store conversation summaries
   - Implement semantic caching for similar queries

3. **Cost Controls**:
   - Set per-user token limits
   - Implement spending alerts
   - Use prompt compression techniques

4. **Performance Optimization**:
   - Batch embedding operations
   - Use async processing throughout
   - Implement request queuing for rate limits