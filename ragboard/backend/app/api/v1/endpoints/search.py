"""
API endpoints for RAG pipeline search functionality.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.api.dependencies.auth import get_current_user
from app.db.base import get_async_session
from app.models.user import User
from app.models.resource import Resource, ResourceType
from app.models.board import Board
from app.services.enhanced_rag_pipeline import get_enhanced_rag_pipeline
from app.core.config import settings

router = APIRouter()

# Get RAG pipeline instance
rag_pipeline = get_enhanced_rag_pipeline()

@router.get("/semantic")
async def semantic_search(
    query: str = Query(..., description="Search query text"),
    board_id: Optional[UUID] = Query(None, description="Filter by board ID"),
    resource_types: Optional[List[str]] = Query(None, description="Filter by resource types"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results"),
    score_threshold: float = Query(0.7, ge=0.0, le=1.0, description="Minimum similarity score"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Perform semantic search across processed resources.
    
    Uses vector embeddings to find content similar to the query,
    even if exact keywords don't match.
    """
    try:
        # Convert string resource types to enum values
        resource_type_filters = None
        if resource_types:
            resource_type_filters = []
            for rt in resource_types:
                try:
                    resource_type_filters.append(ResourceType(rt))
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid resource type: {rt}"
                    )
        
        # Perform semantic search
        results = await rag_pipeline.search(
            query=query,
            board_id=board_id,
            user_id=current_user.id,
            resource_types=resource_type_filters,
            limit=limit,
            score_threshold=score_threshold
        )
        
        return {
            "query": query,
            "total_results": len(results),
            "results": results,
            "search_metadata": {
                "board_id": str(board_id) if board_id else None,
                "resource_types": resource_types,
                "score_threshold": score_threshold,
                "user_id": str(current_user.id)
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )

@router.post("/context")
async def get_search_context(
    query: str,
    board_id: UUID,
    resource_ids: Optional[List[UUID]] = None,
    max_context_length: int = Query(3000, ge=100, le=10000),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get relevant context for AI chat based on search query.
    
    This endpoint is optimized for providing context to AI models
    for better responses in chat interfaces.
    """
    try:
        # Verify board access
        board_result = await db.execute(
            select(Board).where(
                Board.id == board_id,
                Board.user_id == current_user.id
            )
        )
        board = board_result.scalar_one_or_none()
        
        if not board:
            raise HTTPException(
                status_code=404,
                detail="Board not found or access denied"
            )
        
        # Get context from RAG pipeline
        context, sources = await rag_pipeline.get_context_for_chat(
            query=query,
            board_id=board_id,
            resource_ids=resource_ids,
            max_context_length=max_context_length
        )
        
        return {
            "query": query,
            "context": context,
            "sources": sources,
            "context_length": len(context),
            "source_count": len(sources),
            "board_id": str(board_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get context: {str(e)}"
        )

@router.get("/suggestions")
async def get_search_suggestions(
    partial_query: str = Query(..., min_length=2, description="Partial search query"),
    board_id: Optional[UUID] = Query(None, description="Filter by board ID"),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get search suggestions based on partial query.
    
    Returns relevant terms and phrases that might complete
    the user's search intent.
    """
    try:
        # For now, we'll do a simple semantic search and extract key terms
        # In a production system, you might want a dedicated suggestion service
        results = await rag_pipeline.search(
            query=partial_query,
            board_id=board_id,
            user_id=current_user.id,
            limit=limit * 2,  # Get more results to extract suggestions
            score_threshold=0.5  # Lower threshold for suggestions
        )
        
        # Extract suggestions from search results
        suggestions = []
        seen_terms = set()
        
        for result in results[:limit]:
            # Extract key phrases from the text
            text = result.get('text', '')
            words = text.lower().split()
            
            # Simple keyword extraction (in production, use NLP libraries)
            for i, word in enumerate(words):
                if partial_query.lower() in word and word not in seen_terms:
                    # Try to get a phrase around the word
                    start_idx = max(0, i - 2)
                    end_idx = min(len(words), i + 3)
                    phrase = ' '.join(words[start_idx:end_idx])
                    
                    if len(phrase) > len(partial_query):
                        suggestions.append({
                            "text": phrase.title(),
                            "score": result.get('score', 0),
                            "resource_type": result.get('metadata', {}).get('resource_type')
                        })
                        seen_terms.add(word)
                        
                        if len(suggestions) >= limit:
                            break
            
            if len(suggestions) >= limit:
                break
        
        return {
            "partial_query": partial_query,
            "suggestions": suggestions[:limit],
            "board_id": str(board_id) if board_id else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get suggestions: {str(e)}"
        )

@router.get("/stats")
async def get_search_stats(
    board_id: Optional[UUID] = Query(None, description="Filter by board ID"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get search and indexing statistics.
    
    Provides information about indexed content and search performance.
    """
    try:
        # Get RAG pipeline statistics
        rag_stats = rag_pipeline.get_stats()
        
        # Get resource counts from database
        query_filter = [Resource.user_id == current_user.id]
        if board_id:
            query_filter.append(Resource.board_id == board_id)
        
        # Count total resources
        total_resources_result = await db.execute(
            select(Resource).where(*query_filter)
        )
        total_resources = len(total_resources_result.scalars().all())
        
        # Count processed resources
        processed_resources_result = await db.execute(
            select(Resource).where(
                *query_filter,
                Resource.processing_status == 'completed'
            )
        )
        processed_resources = len(processed_resources_result.scalars().all())
        
        # Count by resource type
        resources_by_type = {}
        for resource_type in ResourceType:
            type_result = await db.execute(
                select(Resource).where(
                    *query_filter,
                    Resource.resource_type == resource_type
                )
            )
            count = len(type_result.scalars().all())
            if count > 0:
                resources_by_type[resource_type.value] = count
        
        return {
            "rag_pipeline": rag_stats,
            "resources": {
                "total": total_resources,
                "processed": processed_resources,
                "processing_rate": round(processed_resources / max(total_resources, 1) * 100, 1),
                "by_type": resources_by_type
            },
            "board_id": str(board_id) if board_id else None,
            "user_id": str(current_user.id)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get stats: {str(e)}"
        )

@router.post("/resources/{resource_id}/process")
async def process_resource(
    resource_id: UUID,
    background_tasks: BackgroundTasks,
    force_reprocess: bool = Query(False, description="Force reprocessing even if already processed"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Process a resource through the RAG pipeline.
    
    Extracts text, generates embeddings, and stores in vector database
    for semantic search.
    """
    try:
        # Get resource and verify ownership
        resource_result = await db.execute(
            select(Resource).where(
                Resource.id == resource_id,
                Resource.user_id == current_user.id
            )
        )
        resource = resource_result.scalar_one_or_none()
        
        if not resource:
            raise HTTPException(
                status_code=404,
                detail="Resource not found or access denied"
            )
        
        # Check if already processed and not forcing reprocess
        if (resource.processing_status == 'completed' and not force_reprocess):
            return {
                "resource_id": str(resource_id),
                "status": "already_processed",
                "message": "Resource already processed. Use force_reprocess=true to reprocess."
            }
        
        # Check if resource has a valid file path
        if not resource.file_path:
            raise HTTPException(
                status_code=400,
                detail="Resource has no file path for processing"
            )
        
        # Add processing task to background
        background_tasks.add_task(
            process_resource_background,
            resource_id=resource_id,
            file_path=resource.file_path,
            resource_type=resource.resource_type,
            user_id=current_user.id,
            board_id=resource.board_id
        )
        
        return {
            "resource_id": str(resource_id),
            "status": "queued",
            "message": "Resource processing started in background"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to queue resource processing: {str(e)}"
        )

async def process_resource_background(
    resource_id: UUID,
    file_path: str,
    resource_type: ResourceType,
    user_id: UUID,
    board_id: UUID
):
    """Background task for processing resources."""
    try:
        result = await rag_pipeline.process_resource(
            resource_id=resource_id,
            file_path=file_path,
            resource_type=resource_type,
            user_id=user_id,
            board_id=board_id
        )
        
        print(f"Resource {resource_id} processing completed: {result}")
        
    except Exception as e:
        print(f"Error processing resource {resource_id}: {e}")

@router.delete("/resources/{resource_id}/embeddings")
async def delete_resource_embeddings(
    resource_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Delete embeddings for a resource.
    
    Removes all vector embeddings and chunks associated with the resource
    from the search index.
    """
    try:
        # Verify resource ownership
        resource_result = await db.execute(
            select(Resource).where(
                Resource.id == resource_id,
                Resource.user_id == current_user.id
            )
        )
        resource = resource_result.scalar_one_or_none()
        
        if not resource:
            raise HTTPException(
                status_code=404,
                detail="Resource not found or access denied"
            )
        
        # Delete embeddings
        success = await rag_pipeline.delete_resource_embeddings(resource_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete embeddings"
            )
        
        return {
            "resource_id": str(resource_id),
            "status": "deleted",
            "message": "Resource embeddings deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete embeddings: {str(e)}"
        )