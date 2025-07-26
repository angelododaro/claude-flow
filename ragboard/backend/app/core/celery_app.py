"""
Celery application configuration for async task processing.
"""

from celery import Celery
from app.core.config import settings

# Create the Celery app
celery_app = Celery(
    'ragboard',
    broker=settings.celery_broker_url or 'redis://localhost:6379/0',
    backend=settings.celery_result_backend or 'redis://localhost:6379/0',
    include=['app.services.file_processor']
)

# Configure Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes max per task
    task_soft_time_limit=25 * 60,  # 25 minutes soft limit
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
    
    # Task routing
    task_routes={
        'file_processor.process_resource': {
            'queue': 'file_processing_normal',
            'routing_key': 'file.process',
        },
    },
    
    # Queue configuration
    task_queues={
        'file_processing_low': {
            'exchange': 'file_processing',
            'exchange_type': 'direct',
            'routing_key': 'file.process.low',
        },
        'file_processing_normal': {
            'exchange': 'file_processing',
            'exchange_type': 'direct',
            'routing_key': 'file.process.normal',
        },
        'file_processing_high': {
            'exchange': 'file_processing',
            'exchange_type': 'direct',
            'routing_key': 'file.process.high',
        },
    },
    
    # Result backend configuration
    result_expires=3600,  # Results expire after 1 hour
    result_persistent=True,
    
    # Worker configuration
    worker_send_task_events=True,
    task_send_sent_event=True,
    
    # Beat schedule for periodic tasks (if needed)
    beat_schedule={
        # Example: Clean up old processing tasks
        'cleanup-old-tasks': {
            'task': 'app.services.file_processor.cleanup_old_tasks',
            'schedule': 3600.0,  # Every hour
        },
    },
)

# Optional: Configure task priorities
celery_app.conf.task_queue_max_priority = 10
celery_app.conf.task_default_priority = 5