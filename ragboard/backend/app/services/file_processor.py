"""
Comprehensive file processing service with async queue support.
Handles various file types including PDFs, images, audio, and video.
"""

import os
import io
import logging
import hashlib
import mimetypes
from typing import Dict, Any, Optional, Tuple, List
from uuid import UUID
from pathlib import Path
from datetime import datetime
import asyncio
import aiofiles
import tempfile
import subprocess

# Celery for async task queue
from celery import Celery, Task
from celery.result import AsyncResult

# Document processing imports
import PyPDF2
from PIL import Image
import pytesseract

# Audio/Video processing
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    
try:
    import moviepy.editor as mp
    MOVIEPY_AVAILABLE = True
except ImportError:
    MOVIEPY_AVAILABLE = False

# Cloud service imports (for advanced OCR and transcription)
try:
    import boto3
    AWS_AVAILABLE = True
except ImportError:
    AWS_AVAILABLE = False

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.config import settings
from app.models.resource import Resource, ResourceType, ProcessingStatus
from app.db.base import async_session_maker
from app.services.rag_pipeline import RAGPipeline

logger = logging.getLogger(__name__)


# Initialize Celery
celery_app = Celery(
    'file_processor',
    broker=settings.celery_broker_url or 'redis://localhost:6379/0',
    backend=settings.celery_result_backend or 'redis://localhost:6379/0'
)

# Configure Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
)


class FileProcessorService:
    """
    Comprehensive file processing service with async queue support.
    """
    
    def __init__(self):
        self.rag_pipeline = RAGPipeline()
        self.whisper_model = None
        self.aws_textract_client = None
        self.aws_transcribe_client = None
        
        # Initialize Whisper if available
        if WHISPER_AVAILABLE and hasattr(settings, 'whisper_model'):
            try:
                self.whisper_model = whisper.load_model(settings.whisper_model or "base")
                logger.info(f"Whisper model {settings.whisper_model} loaded")
            except Exception as e:
                logger.error(f"Failed to load Whisper model: {e}")
        
        # Initialize AWS clients if available
        if AWS_AVAILABLE and hasattr(settings, 'aws_access_key_id'):
            try:
                self.aws_textract_client = boto3.client(
                    'textract',
                    aws_access_key_id=settings.aws_access_key_id,
                    aws_secret_access_key=settings.aws_secret_access_key,
                    region_name=settings.aws_region or 'us-east-1'
                )
                self.aws_transcribe_client = boto3.client(
                    'transcribe',
                    aws_access_key_id=settings.aws_access_key_id,
                    aws_secret_access_key=settings.aws_secret_access_key,
                    region_name=settings.aws_region or 'us-east-1'
                )
                logger.info("AWS clients initialized")
            except Exception as e:
                logger.error(f"Failed to initialize AWS clients: {e}")
    
    async def queue_resource_processing(
        self, 
        resource_id: UUID, 
        priority: str = "normal",
        force: bool = False
    ) -> str:
        """
        Queue a resource for async processing.
        
        Args:
            resource_id: Resource ID to process
            priority: Processing priority (low, normal, high)
            force: Force reprocessing even if already processed
            
        Returns:
            Task ID for tracking
        """
        # Queue the task with Celery
        task = process_resource_task.apply_async(
            args=[str(resource_id), force],
            priority=self._get_priority_value(priority),
            queue=f'file_processing_{priority}'
        )
        
        # Store task ID in resource metadata
        async with async_session_maker() as db:
            result = await db.execute(
                select(Resource).where(Resource.id == resource_id)
            )
            resource = result.scalar_one_or_none()
            if resource:
                if not resource.extracted_metadata:
                    resource.extracted_metadata = {}
                resource.extracted_metadata['processing_task_id'] = task.id
                resource.processing_status = ProcessingStatus.QUEUED
                await db.commit()
        
        logger.info(f"Queued resource {resource_id} for processing with task ID {task.id}")
        return task.id
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get the status of a processing task."""
        result = AsyncResult(task_id, app=celery_app)
        
        return {
            'task_id': task_id,
            'status': result.status,
            'ready': result.ready(),
            'successful': result.successful() if result.ready() else None,
            'result': result.result if result.ready() and result.successful() else None,
            'error': str(result.info) if result.ready() and not result.successful() else None,
            'progress': result.info.get('progress', 0) if hasattr(result.info, 'get') else 0
        }
    
    def _get_priority_value(self, priority: str) -> int:
        """Convert priority string to numeric value."""
        priority_map = {
            'low': 0,
            'normal': 5,
            'high': 10
        }
        return priority_map.get(priority, 5)
    
    async def extract_pdf_text(self, file_path: str, use_ocr: bool = True) -> Tuple[str, Dict[str, Any]]:
        """
        Extract text from PDF with optional OCR for scanned documents.
        """
        text_parts = []
        metadata = {
            "pages": 0,
            "extracted_pages": [],
            "ocr_pages": [],
            "extraction_method": "text"
        }
        
        try:
            async with aiofiles.open(file_path, 'rb') as file:
                content = await file.read()
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
                
                metadata["pages"] = len(pdf_reader.pages)
                
                for i, page in enumerate(pdf_reader.pages):
                    try:
                        # Try text extraction first
                        page_text = page.extract_text()
                        
                        if page_text.strip():
                            text_parts.append(f"[Page {i+1}]\n{page_text}")
                            metadata["extracted_pages"].append(i+1)
                        elif use_ocr:
                            # If no text, try OCR
                            ocr_text = await self._ocr_pdf_page(page, i+1)
                            if ocr_text:
                                text_parts.append(f"[Page {i+1} - OCR]\n{ocr_text}")
                                metadata["ocr_pages"].append(i+1)
                    except Exception as e:
                        logger.warning(f"Failed to extract text from page {i+1}: {e}")
            
            if metadata["ocr_pages"]:
                metadata["extraction_method"] = "mixed"
            
            return "\n\n".join(text_parts), metadata
            
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise
    
    async def _ocr_pdf_page(self, page, page_num: int) -> str:
        """OCR a single PDF page."""
        try:
            # Convert PDF page to image
            import fitz  # PyMuPDF
            
            # Create a temporary file for the page image
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                # This is a placeholder - actual implementation would render the page
                # For now, return empty string
                return ""
                
        except Exception as e:
            logger.error(f"OCR failed for page {page_num}: {e}")
            return ""
    
    async def extract_image_text(
        self, 
        file_path: str, 
        use_cloud_ocr: bool = False
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Extract text from image using OCR (local or cloud-based).
        """
        metadata = {
            "ocr_method": "local",
            "image_info": {}
        }
        
        try:
            # Get image information
            image = Image.open(file_path)
            metadata["image_info"] = {
                "size": image.size,
                "mode": image.mode,
                "format": image.format
            }
            
            if use_cloud_ocr and self.aws_textract_client:
                # Use AWS Textract for better accuracy
                text = await self._aws_textract_ocr(file_path)
                metadata["ocr_method"] = "aws_textract"
            else:
                # Use local Tesseract OCR
                text = pytesseract.image_to_string(
                    image, 
                    lang=settings.ocr_languages or 'eng'
                )
                metadata["ocr_language"] = settings.ocr_languages or 'eng'
            
            return text.strip(), metadata
            
        except Exception as e:
            logger.error(f"Image OCR failed: {e}")
            raise
    
    async def _aws_textract_ocr(self, file_path: str) -> str:
        """Use AWS Textract for OCR."""
        try:
            async with aiofiles.open(file_path, 'rb') as file:
                image_bytes = await file.read()
            
            response = self.aws_textract_client.detect_document_text(
                Document={'Bytes': image_bytes}
            )
            
            # Extract text from response
            text_parts = []
            for item in response['Blocks']:
                if item['BlockType'] == 'LINE':
                    text_parts.append(item['Text'])
            
            return '\n'.join(text_parts)
            
        except Exception as e:
            logger.error(f"AWS Textract OCR failed: {e}")
            raise
    
    async def transcribe_audio(
        self, 
        file_path: str,
        use_cloud_service: bool = False
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Transcribe audio file using Whisper or cloud service.
        """
        metadata = {
            "transcription_method": "whisper",
            "audio_info": {}
        }
        
        try:
            # Get audio file info
            metadata["audio_info"] = await self._get_audio_info(file_path)
            
            if use_cloud_service and self.aws_transcribe_client:
                # Use AWS Transcribe
                text = await self._aws_transcribe_audio(file_path)
                metadata["transcription_method"] = "aws_transcribe"
            elif self.whisper_model:
                # Use local Whisper model
                result = self.whisper_model.transcribe(file_path)
                text = result["text"]
                metadata.update({
                    "language": result.get("language"),
                    "segments": len(result.get("segments", [])),
                    "duration": result.get("duration")
                })
            else:
                raise ValueError("No transcription service available")
            
            return text, metadata
            
        except Exception as e:
            logger.error(f"Audio transcription failed: {e}")
            raise
    
    async def _get_audio_info(self, file_path: str) -> Dict[str, Any]:
        """Get audio file metadata."""
        try:
            # Use ffprobe to get audio info
            cmd = [
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_format', '-show_streams', file_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                import json
                data = json.loads(result.stdout)
                
                format_info = data.get('format', {})
                audio_stream = next(
                    (s for s in data.get('streams', []) if s.get('codec_type') == 'audio'),
                    {}
                )
                
                return {
                    'duration': float(format_info.get('duration', 0)),
                    'bitrate': int(format_info.get('bit_rate', 0)),
                    'codec': audio_stream.get('codec_name'),
                    'sample_rate': int(audio_stream.get('sample_rate', 0)),
                    'channels': int(audio_stream.get('channels', 0))
                }
        except Exception as e:
            logger.warning(f"Failed to get audio info: {e}")
            
        return {}
    
    async def _aws_transcribe_audio(self, file_path: str) -> str:
        """Use AWS Transcribe for audio transcription."""
        # This would implement AWS Transcribe API calls
        # For now, return placeholder
        raise NotImplementedError("AWS Transcribe integration pending")
    
    async def extract_video_content(
        self, 
        file_path: str,
        extract_audio: bool = True,
        extract_frames: bool = False,
        frame_interval: int = 30
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Extract content from video files.
        
        Args:
            file_path: Path to video file
            extract_audio: Whether to extract and transcribe audio
            extract_frames: Whether to extract frames for analysis
            frame_interval: Seconds between frame extraction
        """
        metadata = {
            "video_info": {},
            "extraction_methods": []
        }
        text_parts = []
        
        try:
            # Get video metadata
            metadata["video_info"] = await self._get_video_info(file_path)
            
            if extract_audio and MOVIEPY_AVAILABLE:
                # Extract audio track
                audio_text, audio_meta = await self._extract_video_audio(file_path)
                if audio_text:
                    text_parts.append(f"[Audio Transcript]\n{audio_text}")
                    metadata["audio_metadata"] = audio_meta
                    metadata["extraction_methods"].append("audio_transcription")
            
            if extract_frames:
                # Extract key frames for OCR or analysis
                frames_text, frames_meta = await self._extract_video_frames(
                    file_path, 
                    frame_interval
                )
                if frames_text:
                    text_parts.append(f"[Frame Analysis]\n{frames_text}")
                    metadata["frames_metadata"] = frames_meta
                    metadata["extraction_methods"].append("frame_analysis")
            
            return "\n\n".join(text_parts), metadata
            
        except Exception as e:
            logger.error(f"Video extraction failed: {e}")
            raise
    
    async def _get_video_info(self, file_path: str) -> Dict[str, Any]:
        """Get video file metadata."""
        try:
            # Use ffprobe to get video info
            cmd = [
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_format', '-show_streams', file_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                import json
                data = json.loads(result.stdout)
                
                format_info = data.get('format', {})
                video_stream = next(
                    (s for s in data.get('streams', []) if s.get('codec_type') == 'video'),
                    {}
                )
                
                return {
                    'duration': float(format_info.get('duration', 0)),
                    'bitrate': int(format_info.get('bit_rate', 0)),
                    'codec': video_stream.get('codec_name'),
                    'width': int(video_stream.get('width', 0)),
                    'height': int(video_stream.get('height', 0)),
                    'fps': eval(video_stream.get('r_frame_rate', '0/1'))
                }
        except Exception as e:
            logger.warning(f"Failed to get video info: {e}")
            
        return {}
    
    async def _extract_video_audio(self, file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract and transcribe audio from video."""
        try:
            # Extract audio to temporary file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_audio:
                video = mp.VideoFileClip(file_path)
                video.audio.write_audiofile(tmp_audio.name, verbose=False, logger=None)
                
                # Transcribe the extracted audio
                text, metadata = await self.transcribe_audio(tmp_audio.name)
                
                # Clean up
                os.unlink(tmp_audio.name)
                video.close()
                
                return text, metadata
                
        except Exception as e:
            logger.error(f"Video audio extraction failed: {e}")
            return "", {}
    
    async def _extract_video_frames(
        self, 
        file_path: str, 
        interval: int
    ) -> Tuple[str, Dict[str, Any]]:
        """Extract frames from video for analysis."""
        # This would implement frame extraction and analysis
        # For now, return placeholder
        return "", {"frames_analyzed": 0}
    
    def get_progress_callback(self, task_id: str):
        """Create a progress callback for long-running tasks."""
        def update_progress(current: int, total: int, message: str = ""):
            # Update task progress
            celery_app.backend.store_result(
                task_id,
                {
                    'progress': (current / total) * 100 if total > 0 else 0,
                    'current': current,
                    'total': total,
                    'message': message
                },
                'PROGRESS'
            )
        return update_progress


# Celery task definition
@celery_app.task(bind=True, name='file_processor.process_resource')
def process_resource_task(self, resource_id: str, force: bool = False):
    """
    Celery task for processing a resource.
    """
    # Create event loop for async operations
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        processor = FileProcessorService()
        
        # Run the async processing
        result = loop.run_until_complete(
            _process_resource_async(
                processor, 
                UUID(resource_id), 
                force,
                self.request.id
            )
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Task failed for resource {resource_id}: {e}")
        raise
    finally:
        loop.close()


async def _process_resource_async(
    processor: FileProcessorService,
    resource_id: UUID,
    force: bool,
    task_id: str
) -> Dict[str, Any]:
    """
    Async helper for processing resources within Celery task.
    """
    async with async_session_maker() as db:
        # Get resource
        result = await db.execute(
            select(Resource).where(Resource.id == resource_id)
        )
        resource = result.scalar_one_or_none()
        
        if not resource:
            raise ValueError(f"Resource {resource_id} not found")
        
        # Skip if already processed unless forced
        if resource.processing_status == ProcessingStatus.COMPLETED and not force:
            return {
                'status': 'skipped',
                'message': 'Resource already processed'
            }
        
        # Update status to processing
        resource.processing_status = ProcessingStatus.PROCESSING
        await db.commit()
        
        try:
            # Create progress callback
            progress_callback = processor.get_progress_callback(task_id)
            
            # Extract content based on resource type
            extracted_text = ""
            metadata = {}
            
            if resource.resource_type == ResourceType.PDF:
                progress_callback(0, 100, "Extracting PDF content...")
                extracted_text, metadata = await processor.extract_pdf_text(
                    resource.file_path
                )
                
            elif resource.resource_type == ResourceType.IMAGE:
                progress_callback(0, 100, "Performing OCR on image...")
                extracted_text, metadata = await processor.extract_image_text(
                    resource.file_path,
                    use_cloud_ocr=settings.use_cloud_ocr
                )
                
            elif resource.resource_type == ResourceType.AUDIO:
                progress_callback(0, 100, "Transcribing audio...")
                extracted_text, metadata = await processor.transcribe_audio(
                    resource.file_path,
                    use_cloud_service=settings.use_cloud_transcription
                )
                
            elif resource.resource_type == ResourceType.VIDEO:
                progress_callback(0, 100, "Processing video content...")
                extracted_text, metadata = await processor.extract_video_content(
                    resource.file_path,
                    extract_audio=True,
                    extract_frames=True
                )
            
            # Update resource with extracted content
            progress_callback(50, 100, "Storing extracted content...")
            resource.extracted_text = extracted_text
            resource.extracted_metadata = metadata
            
            # Generate embeddings and store in vector DB
            progress_callback(75, 100, "Generating embeddings...")
            chunk_count = await processor.rag_pipeline.process_and_store_resource(
                resource_id=resource.id,
                text=extracted_text,
                chunk_size=1000,
                chunk_overlap=200
            )
            
            # Update resource status
            resource.processing_status = ProcessingStatus.COMPLETED
            resource.processed_at = datetime.utcnow()
            resource.chunk_count = chunk_count
            
            await db.commit()
            
            progress_callback(100, 100, "Processing completed")
            
            return {
                'status': 'completed',
                'resource_id': str(resource_id),
                'chunk_count': chunk_count,
                'metadata': metadata
            }
            
        except Exception as e:
            logger.error(f"Error processing resource {resource_id}: {e}")
            resource.processing_status = ProcessingStatus.FAILED
            resource.processing_error = str(e)
            await db.commit()
            raise


# Export the service instance
file_processor_service = FileProcessorService()