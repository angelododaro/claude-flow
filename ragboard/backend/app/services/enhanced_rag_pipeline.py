"""
Enhanced RAG (Retrieval-Augmented Generation) pipeline service.
"""

from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
import asyncio
import logging
from datetime import datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.resource import Resource, ResourceType, ProcessingStatus
from app.services.text_extractor import text_extractor
from app.services.embeddings import get_embedding_service
from app.services.chroma_service import get_chroma_service
from app.db.base import get_async_session

logger = logging.getLogger(__name__)


class EnhancedRAGPipeline:
    """Enhanced RAG pipeline with complete text extraction and vector storage."""
    
    def __init__(self):
        self.text_extractor = text_extractor
        self.embedding_service = get_embedding_service()
        self.chroma_service = get_chroma_service()
    
    async def process_resource(
        self,
        resource_id: UUID,
        file_path: str,
        resource_type: ResourceType,
        user_id: UUID,
        board_id: UUID,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a resource through the complete RAG pipeline.
        
        Args:
            resource_id: Resource UUID
            file_path: Path to the resource file
            resource_type: Type of resource
            user_id: User who owns the resource
            board_id: Board the resource belongs to
            metadata: Additional metadata
            
        Returns:
            Processing result dictionary
        """
        result = {
            'resource_id': str(resource_id),
            'status': 'processing',
            'chunks_created': 0,
            'errors': []
        }
        
        try:
            # Update resource status
            await self._update_resource_status(resource_id, ProcessingStatus.PROCESSING)
            
            # Extract text and create chunks
            logger.info(f"Extracting text from resource {resource_id}")
            full_text, chunks = await self.text_extractor.extract_text(
                file_path,
                chunk_size=1000,
                chunk_overlap=200
            )
            
            if not full_text:
                raise ValueError("No text extracted from resource")
            
            # Prepare documents for ChromaDB
            documents = []
            for idx, chunk in enumerate(chunks):
                doc_id = f"{resource_id}_chunk_{idx}"
                
                chunk_metadata = {
                    'resource_id': str(resource_id),
                    'user_id': str(user_id),
                    'board_id': str(board_id),
                    'resource_type': resource_type.value,
                    'chunk_index': idx,
                    'chunk_start': chunk['start_char'],
                    'chunk_end': chunk['end_char'],
                    'total_chunks': len(chunks),
                    'file_path': file_path,
                    'created_at': datetime.utcnow().isoformat()
                }
                
                # Add custom metadata
                if metadata:
                    chunk_metadata.update({f'custom_{k}': v for k, v in metadata.items()})
                
                documents.append({
                    'id': doc_id,
                    'text': chunk['text'],
                    'metadata': chunk_metadata
                })
            
            # Add documents to ChromaDB with embeddings
            logger.info(f"Adding {len(documents)} chunks to vector store")
            added_ids = await self.chroma_service.add_documents(documents)
            
            # Update resource status and metadata
            await self._update_resource_status(
                resource_id, 
                ProcessingStatus.COMPLETED,
                metadata={
                    'chunks_created': len(added_ids),
                    'text_length': len(full_text),
                    'processed_at': datetime.utcnow().isoformat()
                }
            )
            
            result.update({
                'status': 'completed',
                'chunks_created': len(added_ids),
                'text_length': len(full_text)
            })
            
        except Exception as e:
            logger.error(f"Error processing resource {resource_id}: {str(e)}")
            result['status'] = 'failed'
            result['errors'].append(str(e))
            
            await self._update_resource_status(
                resource_id,
                ProcessingStatus.FAILED,
                metadata={'error': str(e)}
            )
        
        return result
    
    async def search(
        self,
        query: str,
        board_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        resource_types: Optional[List[ResourceType]] = None,
        limit: int = 10,
        score_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant content using semantic search.
        
        Args:
            query: Search query
            board_id: Filter by board
            user_id: Filter by user
            resource_types: Filter by resource types
            limit: Maximum results
            score_threshold: Minimum similarity score
            
        Returns:
            List of search results with metadata
        """
        # Build metadata filter
        where = {}
        if board_id:
            where['board_id'] = str(board_id)
        if user_id:
            where['user_id'] = str(user_id)
        if resource_types:
            where['resource_type'] = {'$in': [rt.value for rt in resource_types]}
        
        # Search in ChromaDB
        results = await self.chroma_service.search(
            query=query,
            n_results=limit * 2,  # Get more for filtering
            where=where if where else None
        )
        
        # Filter by score threshold and limit
        filtered_results = []
        for result in results:
            if result['score'] >= score_threshold:
                filtered_results.append(result)
                if len(filtered_results) >= limit:
                    break
        
        # Enhance results with resource information
        enhanced_results = []
        async with get_async_session() as db:
            for result in filtered_results:
                resource_id = result['metadata'].get('resource_id')
                if resource_id:
                    resource = await self._get_resource_info(db, UUID(resource_id))
                    if resource:
                        result['resource'] = {
                            'id': str(resource.id),
                            'name': resource.name,
                            'type': resource.resource_type.value,
                            'url': resource.url,
                            'created_at': resource.created_at.isoformat()
                        }
                enhanced_results.append(result)
        
        return enhanced_results
    
    async def get_context_for_chat(
        self,
        query: str,
        board_id: UUID,
        resource_ids: Optional[List[UUID]] = None,
        max_context_length: int = 3000
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Get context for AI chat based on query and available resources.
        
        Args:
            query: User query
            board_id: Board ID
            resource_ids: Specific resources to search (optional)
            max_context_length: Maximum context length
            
        Returns:
            Tuple of (context_text, sources)
        """
        # Build filter
        where = {'board_id': str(board_id)}
        if resource_ids:
            where['resource_id'] = {'$in': [str(rid) for rid in resource_ids]}
        
        # Search for relevant chunks
        results = await self.chroma_service.search(
            query=query,
            n_results=10,
            where=where
        )
        
        # Build context
        context_parts = []
        sources = []
        current_length = 0
        seen_resources = set()
        
        for result in results:
            chunk_text = result['text']
            resource_id = result['metadata'].get('resource_id')
            
            # Add to context if within limit
            if current_length + len(chunk_text) <= max_context_length:
                context_parts.append(chunk_text)
                current_length += len(chunk_text)
                
                # Track unique resources for citations
                if resource_id and resource_id not in seen_resources:
                    seen_resources.add(resource_id)
                    sources.append({
                        'resource_id': resource_id,
                        'chunk_index': result['metadata'].get('chunk_index', 0),
                        'score': result['score']
                    })
        
        context = "\n\n".join(context_parts)
        return context, sources
    
    async def update_resource_embeddings(
        self,
        resource_id: UUID,
        new_text: Optional[str] = None,
        new_metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Update embeddings for a resource.
        
        Args:
            resource_id: Resource ID
            new_text: New text content (optional)
            new_metadata: Updated metadata (optional)
            
        Returns:
            Success boolean
        """
        try:
            # Get all chunks for this resource
            where = {'resource_id': str(resource_id)}
            existing_docs = await self.chroma_service.list_documents(
                limit=1000,
                where=where
            )
            
            if new_text:
                # Delete old chunks
                old_ids = [doc['id'] for doc in existing_docs]
                if old_ids:
                    await self.chroma_service.delete_documents(old_ids)
                
                # Create new chunks and embeddings
                _, chunks = await self.text_extractor.extract_text(
                    new_text,
                    chunk_size=1000,
                    chunk_overlap=200
                )
                
                # Add new chunks
                documents = []
                for idx, chunk in enumerate(chunks):
                    doc_id = f"{resource_id}_chunk_{idx}"
                    
                    # Preserve some original metadata
                    original_metadata = existing_docs[0]['metadata'] if existing_docs else {}
                    chunk_metadata = {
                        **original_metadata,
                        'chunk_index': idx,
                        'chunk_start': chunk['start_char'],
                        'chunk_end': chunk['end_char'],
                        'total_chunks': len(chunks),
                        'updated_at': datetime.utcnow().isoformat()
                    }
                    
                    if new_metadata:
                        chunk_metadata.update(new_metadata)
                    
                    documents.append({
                        'id': doc_id,
                        'text': chunk['text'],
                        'metadata': chunk_metadata
                    })
                
                await self.chroma_service.add_documents(documents)
                
            elif new_metadata:
                # Just update metadata for existing chunks
                for doc in existing_docs:
                    await self.chroma_service.update_document(
                        document_id=doc['id'],
                        metadata=new_metadata
                    )
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating resource embeddings: {e}")
            return False
    
    async def delete_resource_embeddings(self, resource_id: UUID) -> bool:
        """
        Delete all embeddings for a resource.
        
        Args:
            resource_id: Resource ID
            
        Returns:
            Success boolean
        """
        try:
            # Get all chunks for this resource
            where = {'resource_id': str(resource_id)}
            docs = await self.chroma_service.list_documents(
                limit=1000,
                where=where
            )
            
            # Delete all chunks
            doc_ids = [doc['id'] for doc in docs]
            if doc_ids:
                await self.chroma_service.delete_documents(doc_ids)
                logger.info(f"Deleted {len(doc_ids)} chunks for resource {resource_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting resource embeddings: {e}")
            return False
    
    async def _update_resource_status(
        self,
        resource_id: UUID,
        status: ProcessingStatus,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Update resource processing status in database."""
        async with get_async_session() as db:
            stmt = (
                update(Resource)
                .where(Resource.id == resource_id)
                .values(
                    processing_status=status,
                    processing_metadata=metadata or {},
                    updated_at=datetime.utcnow()
                )
            )
            await db.execute(stmt)
            await db.commit()
    
    async def _get_resource_info(self, db: AsyncSession, resource_id: UUID) -> Optional[Resource]:
        """Get resource information from database."""
        stmt = select(Resource).where(Resource.id == resource_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get RAG pipeline statistics."""
        return {
            'embedding_provider': self.embedding_service.provider.value,
            'embedding_dimension': self.embedding_service.get_dimension(),
            'vector_store': self.chroma_service.get_collection_stats()
        }


# Global instance
enhanced_rag_pipeline = None

def get_enhanced_rag_pipeline() -> EnhancedRAGPipeline:
    """Get or create enhanced RAG pipeline instance."""
    global enhanced_rag_pipeline
    if enhanced_rag_pipeline is None:
        enhanced_rag_pipeline = EnhancedRAGPipeline()
    return enhanced_rag_pipeline