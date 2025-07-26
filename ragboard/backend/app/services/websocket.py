"""
WebSocket service for real-time comment and notification updates.
"""

import json
import asyncio
from typing import Dict, Set, List, Optional
from fastapi import WebSocket
from uuid import UUID
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""
    
    def __init__(self):
        # Store active connections by user ID
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Store board subscriptions
        self.board_subscriptions: Dict[str, Set[WebSocket]] = {}
        # Store resource subscriptions  
        self.resource_subscriptions: Dict[str, Set[WebSocket]] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept a WebSocket connection and add to active connections."""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        
        self.active_connections[user_id].add(websocket)
        logger.info(f"User {user_id} connected via WebSocket")
        
    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                
        # Remove from board subscriptions
        for board_id, connections in self.board_subscriptions.items():
            connections.discard(websocket)
        self.board_subscriptions = {
            k: v for k, v in self.board_subscriptions.items() if v
        }
        
        # Remove from resource subscriptions
        for resource_id, connections in self.resource_subscriptions.items():
            connections.discard(websocket)
        self.resource_subscriptions = {
            k: v for k, v in self.resource_subscriptions.items() if v
        }
        
        logger.info(f"User {user_id} disconnected from WebSocket")
    
    async def subscribe_to_board(self, websocket: WebSocket, board_id: str):
        """Subscribe a WebSocket to board updates."""
        if board_id not in self.board_subscriptions:
            self.board_subscriptions[board_id] = set()
        
        self.board_subscriptions[board_id].add(websocket)
        
        # Send subscription confirmation
        await self.send_personal_message(websocket, {
            "type": "subscription_confirmed",
            "subscription": "board",
            "board_id": board_id
        })
        
    async def subscribe_to_resource(self, websocket: WebSocket, resource_id: str):
        """Subscribe a WebSocket to resource updates."""
        if resource_id not in self.resource_subscriptions:
            self.resource_subscriptions[resource_id] = set()
            
        self.resource_subscriptions[resource_id].add(websocket)
        
        # Send subscription confirmation
        await self.send_personal_message(websocket, {
            "type": "subscription_confirmed", 
            "subscription": "resource",
            "resource_id": resource_id
        })
    
    async def send_personal_message(self, websocket: WebSocket, message: dict):
        """Send a message to a specific WebSocket connection."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
    
    async def send_message_to_user(self, user_id: str, message: dict):
        """Send a message to all connections of a specific user."""
        if user_id in self.active_connections:
            connections = list(self.active_connections[user_id])
            for websocket in connections:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    # Remove broken connection
                    self.active_connections[user_id].discard(websocket)
    
    async def broadcast_to_board(self, board_id: str, message: dict):
        """Broadcast a message to all connections subscribed to a board."""
        if board_id in self.board_subscriptions:
            connections = list(self.board_subscriptions[board_id])
            for websocket in connections:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error broadcasting to board {board_id}: {e}")
                    # Remove broken connection
                    self.board_subscriptions[board_id].discard(websocket)
    
    async def broadcast_to_resource(self, resource_id: str, message: dict):
        """Broadcast a message to all connections subscribed to a resource."""
        if resource_id in self.resource_subscriptions:
            connections = list(self.resource_subscriptions[resource_id])
            for websocket in connections:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error broadcasting to resource {resource_id}: {e}")
                    # Remove broken connection
                    self.resource_subscriptions[resource_id].discard(websocket)
    
    async def broadcast_comment_created(self, comment_data: dict):
        """Broadcast new comment to relevant subscribers."""
        message = {
            "type": "comment_created",
            "data": comment_data
        }
        
        # Broadcast to board subscribers
        if comment_data.get("board_id"):
            await self.broadcast_to_board(comment_data["board_id"], message)
        
        # Broadcast to resource subscribers
        if comment_data.get("resource_id"):
            await self.broadcast_to_resource(str(comment_data["resource_id"]), message)
        
        # Send to mentioned users
        if comment_data.get("mentioned_users"):
            for user_id in comment_data["mentioned_users"]:
                await self.send_message_to_user(str(user_id), message)
    
    async def broadcast_comment_updated(self, comment_data: dict):
        """Broadcast comment update to relevant subscribers."""
        message = {
            "type": "comment_updated",
            "data": comment_data
        }
        
        # Broadcast to board subscribers
        if comment_data.get("board_id"):
            await self.broadcast_to_board(comment_data["board_id"], message)
        
        # Broadcast to resource subscribers
        if comment_data.get("resource_id"):
            await self.broadcast_to_resource(str(comment_data["resource_id"]), message)
    
    async def broadcast_comment_deleted(self, comment_id: str, board_id: Optional[str] = None, resource_id: Optional[str] = None):
        """Broadcast comment deletion to relevant subscribers."""
        message = {
            "type": "comment_deleted",
            "data": {
                "comment_id": comment_id,
                "board_id": board_id,
                "resource_id": resource_id
            }
        }
        
        # Broadcast to board subscribers
        if board_id:
            await self.broadcast_to_board(board_id, message)
        
        # Broadcast to resource subscribers
        if resource_id:
            await self.broadcast_to_resource(resource_id, message)
    
    async def broadcast_comment_liked(self, comment_data: dict):
        """Broadcast comment like to relevant subscribers."""
        message = {
            "type": "comment_liked",
            "data": comment_data
        }
        
        # Broadcast to board subscribers
        if comment_data.get("board_id"):
            await self.broadcast_to_board(comment_data["board_id"], message)
        
        # Broadcast to resource subscribers
        if comment_data.get("resource_id"):
            await self.broadcast_to_resource(str(comment_data["resource_id"]), message)
    
    async def send_notification(self, user_id: str, notification_data: dict):
        """Send a notification to a specific user."""
        message = {
            "type": "notification",
            "data": notification_data
        }
        
        await self.send_message_to_user(str(user_id), message)
    
    async def broadcast_typing_indicator(self, board_id: str, user_data: dict, is_typing: bool):
        """Broadcast typing indicator to board subscribers."""
        message = {
            "type": "typing_indicator",
            "data": {
                "board_id": board_id,
                "user": user_data,
                "is_typing": is_typing
            }
        }
        
        await self.broadcast_to_board(board_id, message)
    
    def get_user_count(self) -> int:
        """Get total number of connected users."""
        return len(self.active_connections)
    
    def get_board_subscriber_count(self, board_id: str) -> int:
        """Get number of subscribers to a board."""
        return len(self.board_subscriptions.get(board_id, set()))
    
    def get_resource_subscriber_count(self, resource_id: str) -> int:
        """Get number of subscribers to a resource."""
        return len(self.resource_subscriptions.get(resource_id, set()))


# Global connection manager instance
manager = ConnectionManager()


async def handle_websocket_message(websocket: WebSocket, user_id: str, message: dict):
    """Handle incoming WebSocket messages."""
    try:
        message_type = message.get("type")
        
        if message_type == "subscribe_board":
            board_id = message.get("board_id")
            if board_id:
                await manager.subscribe_to_board(websocket, board_id)
        
        elif message_type == "subscribe_resource":
            resource_id = message.get("resource_id")
            if resource_id:
                await manager.subscribe_to_resource(websocket, resource_id)
        
        elif message_type == "typing_start":
            board_id = message.get("board_id")
            if board_id:
                await manager.broadcast_typing_indicator(
                    board_id, 
                    {"user_id": user_id}, 
                    True
                )
        
        elif message_type == "typing_stop":
            board_id = message.get("board_id")
            if board_id:
                await manager.broadcast_typing_indicator(
                    board_id, 
                    {"user_id": user_id}, 
                    False
                )
        
        elif message_type == "ping":
            await manager.send_personal_message(websocket, {"type": "pong"})
        
        else:
            logger.warning(f"Unknown WebSocket message type: {message_type}")
            
    except Exception as e:
        logger.error(f"Error handling WebSocket message: {e}")
        await manager.send_personal_message(websocket, {
            "type": "error",
            "message": "Invalid message format"
        })


# Export the manager for use in other modules
__all__ = ["manager", "handle_websocket_message", "ConnectionManager"]