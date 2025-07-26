"""
WebSocket endpoints for real-time updates.
"""

import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.dependencies.auth import get_current_user_ws
from app.db.base import get_async_session
from app.services.websocket import manager, handle_websocket_message
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: str = None
):
    """
    WebSocket endpoint for real-time updates.
    
    Usage:
    ws://localhost:8000/ws/{user_id}?token={auth_token}
    """
    # TODO: Implement proper WebSocket authentication
    # For now, we'll accept the connection with basic validation
    
    try:
        # Validate user_id format
        user_uuid = UUID(user_id)
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid user ID")
        return
    
    # TODO: Validate token and get user
    # For demonstration, we'll accept any valid UUID
    
    await manager.connect(websocket, user_id)
    
    try:
        # Send welcome message
        await manager.send_personal_message(websocket, {
            "type": "connected",
            "message": "WebSocket connection established",
            "user_id": user_id
        })
        
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                await handle_websocket_message(websocket, user_id, message)
            except json.JSONDecodeError:
                await manager.send_personal_message(websocket, {
                    "type": "error",
                    "message": "Invalid JSON format"
                })
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                await manager.send_personal_message(websocket, {
                    "type": "error", 
                    "message": "Error processing message"
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        logger.info(f"WebSocket disconnected for user {user_id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket, user_id)


@router.get("/ws/status")
async def websocket_status():
    """Get WebSocket service status."""
    return {
        "status": "active",
        "connected_users": manager.get_user_count(),
        "active_boards": len(manager.board_subscriptions),
        "active_resources": len(manager.resource_subscriptions)
    }


@router.post("/ws/broadcast/board/{board_id}")
async def broadcast_to_board(
    board_id: str,
    message: dict,
    current_user: User = Depends(get_current_user)
):
    """Broadcast a message to all users subscribed to a board (admin only)."""
    # TODO: Add proper authorization check
    
    await manager.broadcast_to_board(board_id, {
        "type": "admin_broadcast",
        "data": message,
        "sender": {
            "id": str(current_user.id),
            "username": current_user.username
        }
    })
    
    return {
        "success": True,
        "subscribers": manager.get_board_subscriber_count(board_id)
    }


@router.post("/ws/broadcast/resource/{resource_id}")
async def broadcast_to_resource(
    resource_id: str,
    message: dict,
    current_user: User = Depends(get_current_user)
):
    """Broadcast a message to all users subscribed to a resource (admin only)."""
    # TODO: Add proper authorization check
    
    await manager.broadcast_to_resource(resource_id, {
        "type": "admin_broadcast",
        "data": message,
        "sender": {
            "id": str(current_user.id),
            "username": current_user.username
        }
    })
    
    return {
        "success": True,
        "subscribers": manager.get_resource_subscriber_count(resource_id)
    }


@router.post("/ws/notify/{user_id}")
async def send_notification(
    user_id: str,
    notification: dict,
    current_user: User = Depends(get_current_user)
):
    """Send a notification to a specific user (admin only)."""
    # TODO: Add proper authorization check
    
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )
    
    await manager.send_notification(user_id, {
        **notification,
        "sender": {
            "id": str(current_user.id),
            "username": current_user.username
        }
    })
    
    return {"success": True}


# Helper functions for integration with comment and notification services

async def notify_comment_created(comment_data: dict):
    """Notify about new comment creation."""
    await manager.broadcast_comment_created(comment_data)


async def notify_comment_updated(comment_data: dict):
    """Notify about comment update."""
    await manager.broadcast_comment_updated(comment_data)


async def notify_comment_deleted(comment_id: str, board_id: str = None, resource_id: str = None):
    """Notify about comment deletion."""
    await manager.broadcast_comment_deleted(comment_id, board_id, resource_id)


async def notify_comment_liked(comment_data: dict):
    """Notify about comment like."""
    await manager.broadcast_comment_liked(comment_data)


async def send_user_notification(user_id: str, notification_data: dict):
    """Send notification to specific user."""
    await manager.send_notification(str(user_id), notification_data)