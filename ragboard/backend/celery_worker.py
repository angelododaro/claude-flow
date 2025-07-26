#!/usr/bin/env python3
"""
Celery worker script for RAGBOARD file processing.

Usage:
    python celery_worker.py
    
Or with specific options:
    celery -A celery_worker worker --loglevel=info --concurrency=4
"""

import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Set up environment
os.environ.setdefault('PYTHONPATH', str(project_root))

from app.core.celery_app import celery_app
from app.services.file_processor import process_resource_task

# Make sure tasks are discovered
celery_app.autodiscover_tasks(['app.services.file_processor'])

if __name__ == '__main__':
    # Start the worker
    celery_app.start()