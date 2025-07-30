"""
API v1 router aggregation.
"""

from fastapi import APIRouter

from app.api.endpoints import auth, resources, collections, conversations, processing, boards
from app.api.v1.endpoints import search, upload

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router)
api_router.include_router(resources.router)
api_router.include_router(collections.router)
api_router.include_router(conversations.router)
api_router.include_router(processing.router)
api_router.include_router(boards.router)
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
# api_router.include_router(api_keys.router)  # Temporarily disabled
# New endpoints temporarily disabled for launch
# api_router.include_router(comments.router)
# api_router.include_router(notifications.router)
# api_router.include_router(websocket.router, prefix="/ws", tags=["websocket"])
# api_router.include_router(file_processing.router, prefix="/file-processing", tags=["file-processing"])
# api_router.include_router(external_apis.router, prefix="/external", tags=["external-apis"])
# api_router.include_router(meta_ads.router, prefix="/external-apis/meta-ads", tags=["meta-ads"])
# api_router.include_router(trending.router, prefix="/trending", tags=["trending"])
# api_router.include_router(board_export.router, prefix="/boards", tags=["board-export"])
# api_router.include_router(oauth.router)
# api_router.include_router(subscription.router)
# api_router.include_router(admin.router)
# api_router.include_router(webhooks.router)