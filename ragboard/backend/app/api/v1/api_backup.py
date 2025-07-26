"""
API v1 router aggregation.
"""

from fastapi import APIRouter

from app.api.endpoints import auth, resources, collections, conversations, processing, boards, file_processing, external_apis, comments, notifications

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router)
api_router.include_router(resources.router)
api_router.include_router(collections.router)
api_router.include_router(conversations.router)
api_router.include_router(processing.router)
api_router.include_router(boards.router)
api_router.include_router(comments.router)
api_router.include_router(notifications.router)
api_router.include_router(file_processing.router, prefix="/file-processing", tags=["file-processing"])
api_router.include_router(external_apis.router, prefix="/external", tags=["external-apis"])