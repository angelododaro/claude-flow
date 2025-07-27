"""
Embedding generation service supporting multiple providers.
"""

import logging
from typing import List, Dict, Any, Optional, Union
import asyncio
from enum import Enum
import numpy as np

# Provider imports
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    SENTENCE_TRANSFORMERS = "sentence_transformers"
    HUGGINGFACE = "huggingface"


class EmbeddingService:
    """Service for generating text embeddings."""
    
    def __init__(self, provider: Optional[EmbeddingProvider] = None):
        self.provider = provider or self._detect_provider()
        self.model = None
        self.client = None
        self._initialize_provider()
    
    def _detect_provider(self) -> EmbeddingProvider:
        """Auto-detect available embedding provider."""
        if OPENAI_AVAILABLE and settings.openai_api_key:
            return EmbeddingProvider.OPENAI
        elif ANTHROPIC_AVAILABLE and hasattr(settings, 'anthropic_api_key') and settings.anthropic_api_key:
            return EmbeddingProvider.ANTHROPIC
        elif SENTENCE_TRANSFORMERS_AVAILABLE:
            return EmbeddingProvider.SENTENCE_TRANSFORMERS
        else:
            raise ValueError("No embedding provider available. Install openai, anthropic, or sentence-transformers.")
    
    def _initialize_provider(self):
        """Initialize the chosen embedding provider."""
        if self.provider == EmbeddingProvider.OPENAI:
            self._init_openai()
        elif self.provider == EmbeddingProvider.ANTHROPIC:
            self._init_anthropic()
        elif self.provider == EmbeddingProvider.SENTENCE_TRANSFORMERS:
            self._init_sentence_transformers()
    
    def _init_openai(self):
        """Initialize OpenAI embeddings."""
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI not installed. Run: pip install openai")
        
        self.client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        self.model_name = getattr(settings, 'openai_embedding_model', 'text-embedding-ada-002')
        self.dimension = 1536  # Ada-002 dimension
        logger.info(f"Initialized OpenAI embeddings with model: {self.model_name}")
    
    def _init_anthropic(self):
        """Initialize Anthropic embeddings (when available)."""
        if not ANTHROPIC_AVAILABLE:
            raise ImportError("Anthropic not installed. Run: pip install anthropic")
        
        # Note: Anthropic doesn't have a dedicated embedding API yet
        # This is a placeholder for future support
        raise NotImplementedError("Anthropic embeddings not yet supported")
    
    def _init_sentence_transformers(self):
        """Initialize local sentence transformers."""
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            raise ImportError("Sentence transformers not installed. Run: pip install sentence-transformers")
        
        model_name = getattr(settings, 'sentence_transformer_model', 'all-MiniLM-L6-v2')
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        logger.info(f"Initialized Sentence Transformers with model: {model_name}")
    
    async def generate_embedding(self, text: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        """
        Generate embeddings for text.
        
        Args:
            text: Single text string or list of texts
            
        Returns:
            Single embedding vector or list of embedding vectors
        """
        is_batch = isinstance(text, list)
        texts = text if is_batch else [text]
        
        # Clean and validate texts
        texts = [self._clean_text(t) for t in texts]
        
        if self.provider == EmbeddingProvider.OPENAI:
            embeddings = await self._embed_openai(texts)
        elif self.provider == EmbeddingProvider.SENTENCE_TRANSFORMERS:
            embeddings = await self._embed_sentence_transformers(texts)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")
        
        return embeddings if is_batch else embeddings[0]
    
    async def generate_embeddings_batch(
        self, 
        texts: List[str], 
        batch_size: int = 100
    ) -> List[List[float]]:
        """
        Generate embeddings for a large batch of texts.
        
        Args:
            texts: List of texts to embed
            batch_size: Number of texts to process at once
            
        Returns:
            List of embedding vectors
        """
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = await self.generate_embedding(batch)
            all_embeddings.extend(batch_embeddings)
            
            # Small delay to avoid rate limits
            if i + batch_size < len(texts):
                await asyncio.sleep(0.1)
        
        return all_embeddings
    
    def _clean_text(self, text: str) -> str:
        """Clean text for embedding."""
        if not text:
            return ""
        
        # Remove excessive whitespace
        text = " ".join(text.split())
        
        # Truncate if too long (OpenAI has 8191 token limit)
        max_length = 8000  # Conservative limit
        if len(text) > max_length:
            text = text[:max_length] + "..."
        
        return text
    
    async def _embed_openai(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using OpenAI."""
        try:
            response = await self.client.embeddings.create(
                model=self.model_name,
                input=texts
            )
            
            embeddings = [data.embedding for data in response.data]
            return embeddings
            
        except Exception as e:
            logger.error(f"OpenAI embedding error: {e}")
            raise
    
    async def _embed_sentence_transformers(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using Sentence Transformers."""
        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(
                None, 
                lambda: self.model.encode(texts, convert_to_numpy=True)
            )
            
            # Convert to list of lists
            return embeddings.tolist()
            
        except Exception as e:
            logger.error(f"Sentence Transformers embedding error: {e}")
            raise
    
    def get_dimension(self) -> int:
        """Get the dimension of the embedding vectors."""
        return self.dimension
    
    @staticmethod
    def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    async def find_similar(
        self, 
        query_embedding: List[float], 
        embeddings: List[List[float]], 
        top_k: int = 5,
        threshold: float = 0.7
    ) -> List[Tuple[int, float]]:
        """
        Find similar embeddings using cosine similarity.
        
        Args:
            query_embedding: Query vector
            embeddings: List of vectors to search
            top_k: Number of results to return
            threshold: Minimum similarity threshold
            
        Returns:
            List of (index, similarity_score) tuples
        """
        similarities = []
        
        for idx, embedding in enumerate(embeddings):
            similarity = self.cosine_similarity(query_embedding, embedding)
            if similarity >= threshold:
                similarities.append((idx, similarity))
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        return similarities[:top_k]


# Global instance
embedding_service = None

def get_embedding_service() -> EmbeddingService:
    """Get or create embedding service instance."""
    global embedding_service
    if embedding_service is None:
        embedding_service = EmbeddingService()
    return embedding_service