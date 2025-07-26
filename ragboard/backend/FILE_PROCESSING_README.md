# RAGBOARD File Processing Service

## Overview

The RAGBOARD File Processing Service provides comprehensive file content extraction capabilities with async queue processing. It supports various file types including PDFs, images, audio, and video files, with both local and cloud-based processing options.

## Features

### Supported File Types

- **Documents**: PDF, DOCX, TXT, MD, CSV
- **Images**: JPG, JPEG, PNG, GIF, BMP, TIFF
- **Audio**: MP3, WAV, M4A, FLAC, OGG, WMA
- **Video**: MP4, AVI, MOV, MKV, WEBM, FLV

### Processing Capabilities

#### PDF Processing
- Text extraction from searchable PDFs
- OCR for scanned documents
- Page-by-page processing
- Metadata extraction (page count, extraction method)

#### Image Processing
- Local OCR using Tesseract
- Cloud OCR using AWS Textract (optional)
- Multi-language support
- Image metadata extraction

#### Audio Processing
- Local transcription using OpenAI Whisper
- Cloud transcription using AWS Transcribe (optional)
- Multiple audio format support
- Automatic language detection

#### Video Processing
- Audio track extraction and transcription
- Frame extraction for analysis
- Metadata extraction (duration, codec, resolution)
- YouTube transcript support

## Architecture

### Components

1. **FileProcessorService**: Main service class handling all file processing operations
2. **Celery Tasks**: Async queue processing for long-running operations
3. **API Endpoints**: RESTful interface for processing requests
4. **Configuration**: Flexible settings for different processing options

### Flow Diagram

```
File Upload → Queue Processing → Content Extraction → Vector Storage
     ↓              ↓                    ↓               ↓
  FastAPI      Celery Worker       File Processor    RAG Pipeline
   API           (Redis)           Service           (ChromaDB)
```

## Installation & Setup

### Prerequisites

1. **Python 3.8+**
2. **Redis Server** (for Celery queue)
3. **FFmpeg** (for video/audio processing)
4. **Tesseract OCR** (for image text extraction)

### Installation Steps

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Install System Dependencies**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server ffmpeg tesseract-ocr
   
   # macOS
   brew install redis ffmpeg tesseract
   ```

3. **Start Redis**:
   ```bash
   # Option 1: System service
   sudo systemctl start redis
   
   # Option 2: Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

4. **Configure Environment**:
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit configuration
   nano .env
   ```

### Configuration Options

```env
# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Processing Options
USE_CLOUD_OCR=false
USE_CLOUD_TRANSCRIPTION=false

# Whisper Settings
WHISPER_MODEL=base
WHISPER_DEVICE=cpu

# OCR Settings
OCR_LANGUAGES=eng
TESSERACT_PATH=/usr/bin/tesseract

# AWS Settings (for cloud services)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# File Upload Limits
MAX_UPLOAD_SIZE=104857600  # 100MB
```

## Usage

### Starting Services

#### Option 1: Use the startup script
```bash
cd ragboard/backend
./start_services.sh
```

#### Option 2: Start services manually
```bash
# Terminal 1: Start Celery worker
celery -A celery_worker worker --loglevel=info --concurrency=4

# Terminal 2: Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### API Endpoints

#### Queue Resource Processing
```http
POST /api/v1/file-processing/{resource_id}/process
```

Parameters:
- `resource_id`: UUID of the resource to process
- `force`: Boolean, force reprocessing (default: false)
- `priority`: String, processing priority (low, normal, high)

Response:
```json
{
  "message": "Resource queued for processing",
  "resource_id": "uuid",
  "task_id": "celery_task_id",
  "priority": "normal"
}
```

#### Check Processing Status
```http
GET /api/v1/file-processing/task/{task_id}/status
```

Response:
```json
{
  "task_id": "celery_task_id",
  "status": "PENDING|PROGRESS|SUCCESS|FAILURE",
  "ready": true,
  "successful": true,
  "progress": 85,
  "result": {...},
  "error": null
}
```

#### Synchronous Content Extraction
```http
POST /api/v1/file-processing/{resource_id}/extract
```

Body:
```json
{
  "use_ocr": true,
  "use_cloud_ocr": false,
  "use_cloud_service": false,
  "extract_audio": true,
  "extract_frames": false
}
```

#### Get Processing Capabilities
```http
GET /api/v1/file-processing/capabilities
```

Response:
```json
{
  "supported_formats": {
    "documents": ["pdf", "txt", "docx", "md", "csv"],
    "images": ["jpg", "jpeg", "png", "gif", "bmp", "tiff"],
    "audio": ["mp3", "wav", "m4a", "flac", "ogg", "wma"],
    "video": ["mp4", "avi", "mov", "mkv", "webm", "flv"]
  },
  "available_services": {
    "local_ocr": true,
    "cloud_ocr": false,
    "whisper_transcription": true,
    "cloud_transcription": false,
    "video_processing": true
  },
  "processing_limits": {
    "max_sync_file_size": 5242880,
    "max_async_file_size": 524288000,
    "max_processing_time": 1800
  }
}
```

## Programming Interface

### Using the FileProcessorService

```python
from app.services.file_processor import file_processor_service

# Queue async processing
task_id = await file_processor_service.queue_resource_processing(
    resource_id=resource_uuid,
    priority="high",
    force=False
)

# Check task status
status = file_processor_service.get_task_status(task_id)

# Extract PDF content
text, metadata = await file_processor_service.extract_pdf_text(
    file_path="/path/to/file.pdf",
    use_ocr=True
)

# Extract image text
text, metadata = await file_processor_service.extract_image_text(
    file_path="/path/to/image.jpg",
    use_cloud_ocr=False
)

# Transcribe audio
text, metadata = await file_processor_service.transcribe_audio(
    file_path="/path/to/audio.mp3",
    use_cloud_service=False
)

# Process video
text, metadata = await file_processor_service.extract_video_content(
    file_path="/path/to/video.mp4",
    extract_audio=True,
    extract_frames=True
)
```

## Performance Considerations

### Processing Limits

- **Synchronous Processing**: Files up to 5MB
- **Asynchronous Processing**: Files up to 500MB
- **Task Timeout**: 30 minutes maximum
- **Concurrency**: 4 workers by default

### Optimization Tips

1. **Use Async Processing** for large files
2. **Enable Cloud Services** for better accuracy (OCR/transcription)
3. **Configure Appropriate Concurrency** based on server resources
4. **Monitor Redis Memory Usage** for queue management
5. **Use SSD Storage** for faster file I/O operations

### Queue Management

```bash
# Monitor Celery queues
celery -A celery_worker inspect active
celery -A celery_worker inspect stats

# Purge failed tasks
celery -A celery_worker purge

# Monitor queue with Flower (optional)
pip install flower
celery -A celery_worker flower
```

## Error Handling

### Common Issues

1. **Redis Connection Failed**:
   ```
   Solution: Ensure Redis is running and accessible
   ```

2. **FFmpeg Not Found**:
   ```
   Solution: Install FFmpeg system package
   ```

3. **Tesseract Not Found**:
   ```
   Solution: Install Tesseract OCR and set correct path
   ```

4. **Out of Memory**:
   ```
   Solution: Reduce Celery concurrency or increase system RAM
   ```

5. **Task Timeout**:
   ```
   Solution: Increase task time limits in Celery configuration
   ```

### Error Response Format

```json
{
  "detail": "Error message",
  "error_code": "PROCESSING_FAILED",
  "timestamp": "2024-01-01T00:00:00Z",
  "resource_id": "uuid"
}
```

## Security Considerations

1. **File Upload Validation**: Strict file type and size checking
2. **Path Traversal Prevention**: Secure file path handling
3. **Resource Isolation**: Each processing task runs in isolation
4. **API Authentication**: All endpoints require valid authentication
5. **Rate Limiting**: Processing requests are rate-limited per user

## Monitoring & Logging

### Logging Configuration

```python
# Configure logging in settings
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=./logs/ragboard.log
```

### Metrics Collection

- Processing success/failure rates
- Average processing times
- Queue depth and worker utilization
- Resource extraction accuracy

### Health Checks

```http
GET /health/file-processing
```

Response:
```json
{
  "status": "healthy",
  "workers_active": 4,
  "queue_depth": 12,
  "redis_connection": "ok",
  "services": {
    "whisper": "available",
    "tesseract": "available",
    "ffmpeg": "available"
  }
}
```

## Development

### Adding New File Types

1. **Extend ResourceType enum**
2. **Implement extraction method**
3. **Add to file type mapping**
4. **Update API documentation**
5. **Add tests**

### Testing

```bash
# Run unit tests
pytest tests/test_file_processor.py

# Run integration tests
pytest tests/test_file_processing_api.py

# Test with sample files
pytest tests/test_file_samples.py
```

### Contributing

1. Follow the existing code structure
2. Add comprehensive error handling
3. Include type hints
4. Add logging for debugging
5. Update documentation