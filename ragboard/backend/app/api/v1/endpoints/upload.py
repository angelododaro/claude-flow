"""
File upload endpoints with RAG pipeline integration.
"""

import os
import uuid
import mimetypes
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.api.dependencies.auth import get_current_user
from app.db.base import get_async_session
from app.models.user import User
from app.models.resource import Resource, ResourceType, ProcessingStatus
from app.models.board import Board
from app.core.config import settings
from app.services.enhanced_rag_pipeline import get_enhanced_rag_pipeline

router = APIRouter()

# Get RAG pipeline instance
rag_pipeline = get_enhanced_rag_pipeline()

# Allowed file extensions and their corresponding resource types
ALLOWED_EXTENSIONS = {
    # Documents
    '.pdf': ResourceType.PDF,
    '.doc': ResourceType.DOCUMENT,
    '.docx': ResourceType.DOCUMENT,
    '.txt': ResourceType.TEXT,
    '.md': ResourceType.TEXT,
    
    # Images
    '.png': ResourceType.IMAGE,
    '.jpg': ResourceType.IMAGE,
    '.jpeg': ResourceType.IMAGE,
    '.gif': ResourceType.IMAGE,
    '.bmp': ResourceType.IMAGE,
    '.tiff': ResourceType.IMAGE,
    
    # Data files
    '.csv': ResourceType.DATA,
    '.xlsx': ResourceType.DATA,
    '.xls': ResourceType.DATA,
    '.json': ResourceType.DATA,
    
    # Web content
    '.html': ResourceType.WEB,
    '.xml': ResourceType.WEB,
    
    # Media
    '.mp4': ResourceType.VIDEO,
    '.mov': ResourceType.VIDEO,
    '.avi': ResourceType.VIDEO,
    '.mp3': ResourceType.AUDIO,
    '.wav': ResourceType.AUDIO,
    '.m4a': ResourceType.AUDIO,
}

def get_resource_type_from_file(filename: str) -> Optional[ResourceType]:
    """Determine resource type from file extension."""
    ext = Path(filename).suffix.lower()
    return ALLOWED_EXTENSIONS.get(ext)

def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return get_resource_type_from_file(filename) is not None

def get_file_size_mb(file_size: int) -> float:
    """Convert file size to MB."""
    return file_size / (1024 * 1024)

async def save_upload_file(upload_file: UploadFile, destination: Path) -> None:
    """Save uploaded file to destination."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    
    with open(destination, "wb") as buffer:
        while chunk := await upload_file.read(8192):  # Read in 8KB chunks
            buffer.write(chunk)

@router.post("/files")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    board_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    auto_process: bool = Form(True),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file and optionally process it through the RAG pipeline.
    
    Args:
        file: The uploaded file
        board_id: Optional board ID to associate the file with
        description: Optional description for the resource
        auto_process: Whether to automatically process the file through RAG pipeline
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        if not is_allowed_file(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"File type not supported. Allowed extensions: {list(ALLOWED_EXTENSIONS.keys())}"
            )
        
        # Check file size
        file_size = 0
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        
        max_size_mb = 100  # 100MB limit
        if get_file_size_mb(file_size) > max_size_mb:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {max_size_mb}MB"
            )
        
        # Verify board access if board_id provided
        board = None
        if board_id:
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
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        unique_filename = f"{file_id}{file_extension}"
        
        # Create file path
        upload_dir = Path(settings.upload_dir)
        file_path = upload_dir / current_user.id / unique_filename
        
        # Save file
        await save_upload_file(file, file_path)
        
        # Determine resource type
        resource_type = get_resource_type_from_file(file.filename)
        
        # Create resource record
        resource = Resource(
            id=file_id,
            name=file.filename,
            resource_type=resource_type,
            file_path=str(file_path),
            file_size=file_size,
            mime_type=mimetypes.guess_type(file.filename)[0],
            description=description,
            user_id=current_user.id,
            board_id=board_id if board else None,
            processing_status=ProcessingStatus.PENDING if auto_process else ProcessingStatus.NOT_PROCESSED
        )
        
        db.add(resource)
        await db.commit()
        await db.refresh(resource)
        
        # Start RAG processing if requested
        if auto_process and resource_type in [
            ResourceType.PDF, ResourceType.DOCUMENT, ResourceType.TEXT,
            ResourceType.IMAGE, ResourceType.DATA, ResourceType.WEB
        ]:
            background_tasks.add_task(
                process_file_background,
                resource_id=resource.id,
                file_path=str(file_path),
                resource_type=resource_type,
                user_id=current_user.id,
                board_id=board_id
            )
        
        return {
            "id": str(resource.id),
            "filename": file.filename,
            "file_size": file_size,
            "resource_type": resource_type.value if resource_type else None,
            "processing_status": resource.processing_status.value,
            "auto_process": auto_process,
            "board_id": board_id,
            "upload_url": f"/uploads/{current_user.id}/{unique_filename}",
            "created_at": resource.created_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"File upload failed: {str(e)}"
        )

@router.post("/files/batch")
async def upload_multiple_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    board_id: Optional[str] = Form(None),
    auto_process: bool = Form(True),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Upload multiple files at once.
    """
    if len(files) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 files allowed per batch upload"
        )
    
    results = []
    errors = []
    
    for file in files:
        try:
            # Use the single file upload logic
            result = await upload_file(
                background_tasks=background_tasks,
                file=file,
                board_id=board_id,
                auto_process=auto_process,
                db=db,
                current_user=current_user
            )
            results.append(result)
        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })
    
    return {
        "uploaded": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors
    }

@router.get("/files/{resource_id}/status")
async def get_file_processing_status(
    resource_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get the processing status of an uploaded file.
    """
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
    
    return {
        "id": str(resource.id),
        "filename": resource.name,
        "processing_status": resource.processing_status.value,
        "processing_metadata": resource.processing_metadata or {},
        "created_at": resource.created_at.isoformat(),
        "updated_at": resource.updated_at.isoformat()
    }

@router.post("/files/{resource_id}/reprocess")
async def reprocess_file(
    resource_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Reprocess a file through the RAG pipeline.
    """
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
    
    if not resource.file_path or not Path(resource.file_path).exists():
        raise HTTPException(
            status_code=400,
            detail="File not found on disk"
        )
    
    # Start background processing
    background_tasks.add_task(
        process_file_background,
        resource_id=resource.id,
        file_path=resource.file_path,
        resource_type=resource.resource_type,
        user_id=current_user.id,
        board_id=resource.board_id
    )
    
    # Update status
    resource.processing_status = ProcessingStatus.PROCESSING
    await db.commit()
    
    return {
        "id": str(resource.id),
        "status": "processing",
        "message": "File reprocessing started"
    }

@router.delete("/files/{resource_id}")
async def delete_file(
    resource_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    """
    Delete an uploaded file and its embeddings.
    """
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
    
    # Delete file from disk
    if resource.file_path and Path(resource.file_path).exists():
        try:
            os.remove(resource.file_path)
        except OSError as e:
            print(f"Error deleting file {resource.file_path}: {e}")
    
    # Delete embeddings
    try:
        await rag_pipeline.delete_resource_embeddings(resource.id)
    except Exception as e:
        print(f"Error deleting embeddings for {resource_id}: {e}")
    
    # Delete database record
    await db.delete(resource)
    await db.commit()
    
    return {
        "id": str(resource.id),
        "status": "deleted",
        "message": "File and embeddings deleted successfully"
    }

async def process_file_background(
    resource_id: str,
    file_path: str,
    resource_type: ResourceType,
    user_id: str,
    board_id: Optional[str] = None
):
    """Background task for processing uploaded files through RAG pipeline."""
    try:
        print(f"Starting background processing for resource {resource_id}")
        
        result = await rag_pipeline.process_resource(
            resource_id=uuid.UUID(resource_id),
            file_path=file_path,
            resource_type=resource_type,
            user_id=uuid.UUID(user_id),
            board_id=uuid.UUID(board_id) if board_id else None,
            metadata={
                "original_filename": Path(file_path).name,
                "processed_at": "background_task"
            }
        )
        
        print(f"Resource {resource_id} processing completed: {result}")
        
    except Exception as e:
        print(f"Error processing resource {resource_id}: {e}")
        
        # Update resource status to failed
        try:
            from app.db.base import get_async_session
            async with get_async_session() as db:
                resource_result = await db.execute(
                    select(Resource).where(Resource.id == resource_id)
                )
                resource = resource_result.scalar_one_or_none()
                if resource:
                    resource.processing_status = ProcessingStatus.FAILED
                    resource.processing_metadata = {"error": str(e)}
                    await db.commit()
        except Exception as db_error:
            print(f"Error updating resource status: {db_error}")

@router.get("/files/supported-types")
async def get_supported_file_types():
    """
    Get list of supported file types and their corresponding resource types.
    """
    return {
        "supported_extensions": list(ALLOWED_EXTENSIONS.keys()),
        "resource_types": {
            ext: resource_type.value 
            for ext, resource_type in ALLOWED_EXTENSIONS.items()
        },
        "max_file_size_mb": 100,
        "rag_processable_types": [
            ResourceType.PDF.value,
            ResourceType.DOCUMENT.value,
            ResourceType.TEXT.value,
            ResourceType.IMAGE.value,
            ResourceType.DATA.value,
            ResourceType.WEB.value
        ]
    }