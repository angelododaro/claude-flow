"""
ChromaDB integration service for vector storage and retrieval.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
import asyncio
from datetime import datetime

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions

from app.core.config import settings
from app.services.embeddings import get_embedding_service

logger = logging.getLogger(__name__)


class ChromaService:
    """Service for managing ChromaDB vector storage."""
    
    def __init__(self, persist_directory: Optional[str] = None):
        self.persist_directory = persist_directory or getattr(
            settings, 
            'chroma_persist_directory', 
            './chroma_db'
        )
        
        # Initialize ChromaDB client
        self.client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True,
            )
        )
        
        # Get embedding service
        self.embedding_service = get_embedding_service()
        
        # Collection name
        self.collection_name = getattr(settings, 'chroma_collection_name', 'ragboard_documents')
        
        # Get or create collection
        self._init_collection()
    
    def _init_collection(self):
        """Initialize or get the ChromaDB collection."""
        try:
            # Try to get existing collection
            self.collection = self.client.get_collection(
                name=self.collection_name,
            )
            logger.info(f"Using existing ChromaDB collection: {self.collection_name}")
        except:
            # Create new collection
            self.collection = self.client.create_collection(
                name=self.collection_name,
                metadata={"description": "RAGBoard document embeddings"}
            )
            logger.info(f"Created new ChromaDB collection: {self.collection_name}")
    
    async def add_documents(
        self,
        documents: List[Dict[str, Any]],
        embeddings: Optional[List[List[float]]] = None,
        batch_size: int = 100
    ) -> List[str]:
        """
        Add documents to ChromaDB.
        
        Args:
            documents: List of document dictionaries with keys:
                - id: Unique document ID
                - text: Document text
                - metadata: Optional metadata dict
            embeddings: Pre-computed embeddings (optional)
            batch_size: Batch size for adding documents
            
        Returns:
            List of document IDs
        """
        if not documents:
            return []
        
        # Prepare data
        ids = []
        texts = []
        metadatas = []
        
        for doc in documents:
            doc_id = str(doc.get('id', ''))
            text = doc.get('text', '')
            metadata = doc.get('metadata', {})
            
            # Add timestamp if not present
            if 'created_at' not in metadata:
                metadata['created_at'] = datetime.utcnow().isoformat()
            
            ids.append(doc_id)
            texts.append(text)
            metadatas.append(metadata)
        
        # Generate embeddings if not provided
        if embeddings is None:
            logger.info(f"Generating embeddings for {len(texts)} documents...")
            embeddings = await self.embedding_service.generate_embeddings_batch(
                texts, 
                batch_size=batch_size
            )
        
        # Add to ChromaDB in batches
        added_ids = []
        for i in range(0, len(ids), batch_size):
            batch_ids = ids[i:i + batch_size]
            batch_texts = texts[i:i + batch_size]
            batch_embeddings = embeddings[i:i + batch_size]
            batch_metadatas = metadatas[i:i + batch_size]
            
            try:
                self.collection.add(
                    ids=batch_ids,
                    documents=batch_texts,
                    embeddings=batch_embeddings,
                    metadatas=batch_metadatas
                )
                added_ids.extend(batch_ids)
                logger.info(f"Added batch {i//batch_size + 1} ({len(batch_ids)} documents)")
                
            except Exception as e:
                logger.error(f"Error adding batch to ChromaDB: {e}")
        
        return added_ids
    
    async def search(
        self,
        query: str,
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None,
        where_document: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for similar documents.
        
        Args:
            query: Query text
            n_results: Number of results to return
            where: Metadata filter
            where_document: Document content filter
            
        Returns:
            List of search results
        """
        # Generate query embedding
        query_embedding = await self.embedding_service.generate_embedding(query)
        
        # Search in ChromaDB
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            where_document=where_document,
            include=['documents', 'metadatas', 'distances']
        )
        
        # Format results
        formatted_results = []
        if results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                result = {
                    'id': results['ids'][0][i],
                    'text': results['documents'][0][i] if results['documents'] else '',
                    'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                    'distance': results['distances'][0][i] if results['distances'] else 0,
                    'score': 1 - results['distances'][0][i] if results['distances'] else 0  # Convert distance to similarity
                }
                formatted_results.append(result)
        
        return formatted_results
    
    async def update_document(
        self,
        document_id: str,
        text: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Update a document in ChromaDB.
        
        Args:
            document_id: Document ID
            text: New text (optional)
            metadata: New or updated metadata (optional)
            
        Returns:
            Success boolean
        """
        try:
            # Get existing document
            existing = self.collection.get(ids=[document_id])
            
            if not existing['ids']:
                logger.warning(f"Document {document_id} not found")
                return False
            
            # Prepare update
            update_args = {'ids': [document_id]}
            
            if text is not None:
                # Generate new embedding
                embedding = await self.embedding_service.generate_embedding(text)
                update_args['documents'] = [text]
                update_args['embeddings'] = [embedding]
            
            if metadata is not None:
                # Merge with existing metadata
                existing_metadata = existing['metadatas'][0] if existing['metadatas'] else {}
                updated_metadata = {**existing_metadata, **metadata}
                updated_metadata['updated_at'] = datetime.utcnow().isoformat()
                update_args['metadatas'] = [updated_metadata]
            
            # Update in ChromaDB
            self.collection.update(**update_args)
            return True
            
        except Exception as e:
            logger.error(f"Error updating document {document_id}: {e}")
            return False
    
    async def delete_documents(self, document_ids: List[str]) -> bool:
        """
        Delete documents from ChromaDB.
        
        Args:
            document_ids: List of document IDs to delete
            
        Returns:
            Success boolean
        """
        try:
            self.collection.delete(ids=document_ids)
            logger.info(f"Deleted {len(document_ids)} documents from ChromaDB")
            return True
        except Exception as e:
            logger.error(f"Error deleting documents: {e}")
            return False
    
    async def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific document by ID.
        
        Args:
            document_id: Document ID
            
        Returns:
            Document dict or None
        """
        try:
            result = self.collection.get(
                ids=[document_id],
                include=['documents', 'metadatas', 'embeddings']
            )
            
            if result['ids']:
                return {
                    'id': result['ids'][0],
                    'text': result['documents'][0] if result['documents'] else '',
                    'metadata': result['metadatas'][0] if result['metadatas'] else {},
                    'embedding': result['embeddings'][0] if result['embeddings'] else None
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting document {document_id}: {e}")
            return None
    
    async def list_documents(
        self,
        limit: int = 100,
        offset: int = 0,
        where: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        List documents with pagination.
        
        Args:
            limit: Maximum number of documents
            offset: Offset for pagination
            where: Metadata filter
            
        Returns:
            List of documents
        """
        try:
            # ChromaDB doesn't have direct pagination, so we get all and slice
            results = self.collection.get(
                where=where,
                include=['documents', 'metadatas']
            )
            
            # Apply pagination
            start = offset
            end = offset + limit
            
            documents = []
            if results['ids']:
                for i in range(start, min(end, len(results['ids']))):
                    if i < len(results['ids']):
                        documents.append({
                            'id': results['ids'][i],
                            'text': results['documents'][i] if results['documents'] else '',
                            'metadata': results['metadatas'][i] if results['metadatas'] else {}
                        })
            
            return documents
            
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get collection statistics."""
        try:
            count = self.collection.count()
            return {
                'collection_name': self.collection_name,
                'document_count': count,
                'persist_directory': self.persist_directory,
                'embedding_dimension': self.embedding_service.get_dimension()
            }
        except Exception as e:
            logger.error(f"Error getting collection stats: {e}")
            return {}
    
    def reset_collection(self) -> bool:
        """Reset (delete and recreate) the collection."""
        try:
            self.client.delete_collection(name=self.collection_name)
            self._init_collection()
            logger.info(f"Reset ChromaDB collection: {self.collection_name}")
            return True
        except Exception as e:
            logger.error(f"Error resetting collection: {e}")
            return False


# Global instance
chroma_service = None

def get_chroma_service() -> ChromaService:
    """Get or create ChromaDB service instance."""
    global chroma_service
    if chroma_service is None:
        chroma_service = ChromaService()
    return chroma_service