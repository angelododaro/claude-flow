"""
API endpoints for file processing operations.
"""

from typing import Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.db.session import get_async_session as get_db
from app.models.user import User
from app.models.resource import Resource
from app.services.file_processor import file_processor_service
from app.schemas.base import Message

router = APIRouter()


@router.post("/{resource_id}/process", response_model=Dict[str, Any])
async def queue_resource_processing(
    resource_id: UUID,
    background_tasks: BackgroundTasks,
    force: bool = False,
    priority: str = "normal",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Queue a resource for async processing.
    
    Args:
        resource_id: ID of the resource to process
        force: Force reprocessing even if already processed
        priority: Processing priority (low, normal, high)
    """
    # Verify resource exists and user has access
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    if resource.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to process this resource")
    
    # Queue the processing task
    task_id = await file_processor_service.queue_resource_processing(
        resource_id=resource_id,
        priority=priority,
        force=force
    )
    
    return {
        "message": "Resource queued for processing",
        "resource_id": str(resource_id),
        "task_id": task_id,
        "priority": priority
    }


@router.get("/task/{task_id}/status", response_model=Dict[str, Any])
async def get_processing_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get the status of a processing task.
    
    Args:
        task_id: Celery task ID
    """
    status = file_processor_service.get_task_status(task_id)
    
    return {
        "task_id": task_id,
        "status": status['status'],
        "ready": status['ready'],
        "successful": status['successful'],
        "progress": status.get('progress', 0),
        "result": status.get('result'),
        "error": status.get('error')
    }


@router.post("/{resource_id}/extract", response_model=Dict[str, Any])
async def extract_resource_content(
    resource_id: UUID,
    extract_options: Optional[Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Extract content from a resource synchronously (for small files).
    
    Args:
        resource_id: ID of the resource
        extract_options: Options for extraction (e.g., use_ocr, use_cloud_services)
    """
    # Verify resource exists and user has access
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    if resource.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this resource")
    
    # Check file size - only allow sync processing for small files
    import os
    if resource.file_path and os.path.exists(resource.file_path):
        file_size = os.path.getsize(resource.file_path)
        max_sync_size = 5 * 1024 * 1024  # 5MB
        
        if file_size > max_sync_size:
            raise HTTPException(
                status_code=400, 
                detail=f"File too large for synchronous processing. Use async processing for files > {max_sync_size} bytes"
            )
    
    try:
        # Extract content based on resource type
        if resource.resource_type == "pdf":
            text, metadata = await file_processor_service.extract_pdf_text(
                resource.file_path,
                use_ocr=extract_options.get('use_ocr', True) if extract_options else True
            )
        elif resource.resource_type == "image":
            text, metadata = await file_processor_service.extract_image_text(
                resource.file_path,
                use_cloud_ocr=extract_options.get('use_cloud_ocr', False) if extract_options else False
            )
        elif resource.resource_type == "audio":
            text, metadata = await file_processor_service.transcribe_audio(
                resource.file_path,
                use_cloud_service=extract_options.get('use_cloud_service', False) if extract_options else False
            )
        elif resource.resource_type == "video":
            text, metadata = await file_processor_service.extract_video_content(
                resource.file_path,
                extract_audio=extract_options.get('extract_audio', True) if extract_options else True,
                extract_frames=extract_options.get('extract_frames', False) if extract_options else False
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported resource type: {resource.resource_type}"
            )
        
        return {
            "resource_id": str(resource_id),
            "extracted_text": text,
            "metadata": metadata,
            "text_length": len(text)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.get("/capabilities", response_model=Dict[str, Any])
async def get_processing_capabilities(
    current_user: User = Depends(get_current_user)
):
    """
    Get available processing capabilities and supported formats.
    """
    from app.services.file_processor import (
        WHISPER_AVAILABLE, 
        MOVIEPY_AVAILABLE,
        AWS_AVAILABLE
    )
    
    return {
        "supported_formats": {
            "documents": ["pdf", "txt", "docx", "md", "csv"],
            "images": ["jpg", "jpeg", "png", "gif", "bmp", "tiff"],
            "audio": ["mp3", "wav", "m4a", "flac", "ogg", "wma"],
            "video": ["mp4", "avi", "mov", "mkv", "webm", "flv"]
        },
        "available_services": {
            "local_ocr": True,
            "cloud_ocr": AWS_AVAILABLE,
            "whisper_transcription": WHISPER_AVAILABLE,
            "cloud_transcription": AWS_AVAILABLE,
            "video_processing": MOVIEPY_AVAILABLE
        },
        "processing_limits": {
            "max_sync_file_size": 5 * 1024 * 1024,  # 5MB
            "max_async_file_size": 500 * 1024 * 1024,  # 500MB
            "max_processing_time": 30 * 60  # 30 minutes
        }
    }