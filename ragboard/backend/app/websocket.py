"""
WebSocket handlers for real-time features.
"""

from typing import Dict, Set, Optional, List, Any
from uuid import UUID
import json
import asyncio
from datetime import datetime
from dataclasses import dataclass, asdict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from fastapi.websockets import WebSocketState
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.core.config import settings
from app.db.base import get_async_session
from app.models.user import User
from app.models.board import Board
from app.models.conversation import Conversation, Message, MessageRole
from app.core.security import verify_token
from app.services.ai_chat import AIChatService
from app.services.rag_pipeline import RAGPipeline

logger = logging.getLogger(__name__)

websocket_router = APIRouter()


@dataclass
class CursorPosition:
    x: float
    y: float
    user_id: str
    user_name: str
    color: str
    timestamp: float


@dataclass
class UserPresence:
    user_id: str
    user_name: str
    status: str  # 'active', 'idle', 'away'
    color: str
    last_seen: float
    cursor: Optional[CursorPosition] = None


# Connection manager for handling multiple WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[UUID, Set[WebSocket]] = {}
        self.user_connections: Dict[UUID, WebSocket] = {}
        # Board-specific connections and presence
        self.board_connections: Dict[UUID, Set[WebSocket]] = {}
        self.board_users: Dict[UUID, Set[UUID]] = {}
        self.user_presence: Dict[UUID, UserPresence] = {}
        self.user_colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8C471"]
    
    async def connect(self, websocket: WebSocket, user_id: UUID):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        self.user_connections[user_id] = websocket
        logger.info(f"User {user_id} connected via WebSocket")
    
    def disconnect(self, websocket: WebSocket, user_id: UUID):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                if user_id in self.user_connections:
                    del self.user_connections[user_id]
        logger.info(f"User {user_id} disconnected from WebSocket")
    
    async def send_personal_message(self, message: dict, user_id: UUID):
        if user_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[user_id]:
                try:
                    if connection.client_state == WebSocketState.CONNECTED:
                        await connection.send_json(message)
                    else:
                        disconnected.append(connection)
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    disconnected.append(connection)
            
            # Clean up disconnected connections
            for conn in disconnected:
                self.active_connections[user_id].discard(conn)
    
    async def broadcast_to_conversation(self, message: dict, conversation_id: UUID, user_ids: List[UUID]):
        """Broadcast message to all users in a conversation."""
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)
    
    async def connect_to_board(self, websocket: WebSocket, board_id: UUID, user_id: UUID, user_name: str):
        """Connect user to a specific board."""
        if board_id not in self.board_connections:
            self.board_connections[board_id] = set()
            self.board_users[board_id] = set()
        
        self.board_connections[board_id].add(websocket)
        self.board_users[board_id].add(user_id)
        
        # Create user presence
        color_index = len(self.board_users[board_id]) % len(self.user_colors)
        self.user_presence[user_id] = UserPresence(
            user_id=str(user_id),
            user_name=user_name,
            status="active",
            color=self.user_colors[color_index],
            last_seen=datetime.utcnow().timestamp()
        )
        
        logger.info(f"User {user_id} connected to board {board_id}")
    
    def disconnect_from_board(self, websocket: WebSocket, board_id: UUID, user_id: UUID):
        """Disconnect user from a specific board."""
        if board_id in self.board_connections:
            self.board_connections[board_id].discard(websocket)
            if not self.board_connections[board_id]:
                del self.board_connections[board_id]
        
        if board_id in self.board_users:
            self.board_users[board_id].discard(user_id)
            if not self.board_users[board_id]:
                del self.board_users[board_id]
        
        if user_id in self.user_presence:
            del self.user_presence[user_id]
        
        logger.info(f"User {user_id} disconnected from board {board_id}")
    
    async def broadcast_to_board(self, message: dict, board_id: UUID, exclude_websocket: Optional[WebSocket] = None):
        """Broadcast message to all users in a board."""
        if board_id not in self.board_connections:
            return
        
        disconnected = []
        for connection in self.board_connections[board_id]:
            if connection == exclude_websocket:
                continue
            
            try:
                if connection.client_state == WebSocketState.CONNECTED:
                    await connection.send_json(message)
                else:
                    disconnected.append(connection)
            except Exception as e:
                logger.error(f"Error broadcasting to board {board_id}: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected connections
        for conn in disconnected:
            self.board_connections[board_id].discard(conn)
    
    def get_board_presence(self, board_id: UUID) -> List[Dict[str, Any]]:
        """Get all active users in a board."""
        if board_id not in self.board_users:
            return []
        
        presence_list = []
        for user_id in self.board_users[board_id]:
            if user_id in self.user_presence:
                presence_list.append(asdict(self.user_presence[user_id]))
        
        return presence_list
    
    async def update_cursor_position(self, board_id: UUID, user_id: UUID, x: float, y: float):
        """Update user's cursor position."""
        if user_id in self.user_presence:
            cursor = CursorPosition(
                x=x,
                y=y,
                user_id=str(user_id),
                user_name=self.user_presence[user_id].user_name,
                color=self.user_presence[user_id].color,
                timestamp=datetime.utcnow().timestamp()
            )
            self.user_presence[user_id].cursor = cursor
            self.user_presence[user_id].last_seen = datetime.utcnow().timestamp()
            
            # Broadcast cursor update to all users in the board
            await self.broadcast_to_board(
                {
                    "type": "cursor_update",
                    "data": asdict(cursor)
                },
                board_id
            )


# Global connection manager instance
manager = ConnectionManager()

# Initialize services
ai_service = AIChatService()
rag_pipeline = RAGPipeline()


async def get_current_user_ws(websocket: WebSocket, token: str) -> Optional[User]:
    """Verify WebSocket authentication."""
    try:
        user_id = verify_token(token, token_type="access")
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None
        
        async with get_async_session() as db:
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user or not user.is_active:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return None
            
            return user
    except Exception as e:
        logger.error(f"WebSocket authentication error: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None


@websocket_router.websocket("/ws/chat/{conversation_id}")
async def websocket_chat(
    websocket: WebSocket,
    conversation_id: UUID,
    token: str
):
    """
    WebSocket endpoint for real-time chat.
    
    Message format:
    {
        "type": "chat_message" | "typing" | "presence" | "ping",
        "data": {
            "message": "user message text",
            "resource_ids": ["uuid1", "uuid2"],
            "metadata": {}
        }
    }
    """
    user = await get_current_user_ws(websocket, token)
    if not user:
        return
    
    await manager.connect(websocket, user.id)
    
    try:
        # Verify conversation access
        async with get_async_session() as db:
            conv_result = await db.execute(
                select(Conversation).where(
                    Conversation.id == conversation_id,
                    Conversation.user_id == user.id
                )
            )
            conversation = conv_result.scalar_one_or_none()
            
            if not conversation:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
        
        # Send connection confirmation
        await websocket.send_json({
            "type": "connection",
            "data": {
                "status": "connected",
                "conversation_id": str(conversation_id),
                "user_id": str(user.id)
            }
        })
        
        # Handle messages
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            message_data = data.get("data", {})
            
            if message_type == "ping":
                # Heartbeat
                await websocket.send_json({"type": "pong", "data": {}})
                
            elif message_type == "typing":
                # Broadcast typing indicator to other users in conversation
                await manager.broadcast_to_conversation(
                    {
                        "type": "typing",
                        "data": {
                            "user_id": str(user.id),
                            "conversation_id": str(conversation_id),
                            "is_typing": message_data.get("is_typing", False)
                        }
                    },
                    conversation_id,
                    [user.id]  # In real app, get all users in conversation
                )
                
            elif message_type == "chat_message":
                # Process chat message
                user_message_text = message_data.get("message")
                resource_ids = message_data.get("resource_ids", [])
                metadata = message_data.get("metadata", {})
                
                if not user_message_text:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "Message text is required"}
                    })
                    continue
                
                async with get_async_session() as db:
                    # Create user message
                    user_message = Message(
                        conversation_id=conversation_id,
                        role=MessageRole.USER,
                        content=user_message_text,
                        metadata=metadata
                    )
                    db.add(user_message)
                    await db.commit()
                    
                    # Send user message confirmation
                    await websocket.send_json({
                        "type": "message_created",
                        "data": {
                            "message_id": str(user_message.id),
                            "role": "user",
                            "content": user_message_text,
                            "created_at": user_message.created_at.isoformat()
                        }
                    })
                    
                    # Send typing indicator for assistant
                    await websocket.send_json({
                        "type": "assistant_typing",
                        "data": {"is_typing": True}
                    })
                    
                    try:
                        # Get RAG context if needed
                        context = None
                        sources = []
                        if resource_ids:
                            context, sources = await rag_pipeline.get_context(
                                query=user_message_text,
                                resource_ids=[UUID(rid) for rid in resource_ids],
                                user_id=user.id,
                                top_k=5
                            )
                        
                        # Get conversation history
                        history_result = await db.execute(
                            select(Message)
                            .where(Message.conversation_id == conversation_id)
                            .order_by(Message.created_at.desc())
                            .limit(10)
                        )
                        history = history_result.scalars().all()
                        history.reverse()
                        
                        # Stream AI response
                        response_chunks = []
                        async for chunk in ai_service.generate_response_stream(
                            message=user_message_text,
                            context=context,
                            history=history,
                            model=settings.default_ai_model
                        ):
                            response_chunks.append(chunk)
                            await websocket.send_json({
                                "type": "assistant_chunk",
                                "data": {"chunk": chunk}
                            })
                        
                        # Complete response
                        full_response = "".join(response_chunks)
                        
                        # Save assistant message
                        assistant_message = Message(
                            conversation_id=conversation_id,
                            role=MessageRole.ASSISTANT,
                            content=full_response,
                            metadata={
                                "model": settings.default_ai_model,
                                "sources": sources
                            }
                        )
                        db.add(assistant_message)
                        
                        # Update conversation
                        conversation.updated_at = datetime.utcnow()
                        conversation.message_count = (conversation.message_count or 0) + 2
                        
                        await db.commit()
                        
                        # Send completion
                        await websocket.send_json({
                            "type": "assistant_complete",
                            "data": {
                                "message_id": str(assistant_message.id),
                                "content": full_response,
                                "sources": sources,
                                "created_at": assistant_message.created_at.isoformat()
                            }
                        })
                        
                    except Exception as e:
                        logger.error(f"Error generating AI response: {e}")
                        await websocket.send_json({
                            "type": "error",
                            "data": {"message": "Error generating response"}
                        })
                    finally:
                        # Stop typing indicator
                        await websocket.send_json({
                            "type": "assistant_typing",
                            "data": {"is_typing": False}
                        })
            
            else:
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": f"Unknown message type: {message_type}"}
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)
        logger.info(f"User {user.id} disconnected from chat {conversation_id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user.id}: {e}")
        manager.disconnect(websocket, user.id)
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)


@websocket_router.websocket("/ws/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    token: str
):
    """
    WebSocket endpoint for real-time notifications.
    """
    user = await get_current_user_ws(websocket, token)
    if not user:
        return
    
    await manager.connect(websocket, user.id)
    
    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connection",
            "data": {
                "status": "connected",
                "user_id": str(user.id)
            }
        })
        
        # Keep connection alive and handle messages
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "ping":
                await websocket.send_json({"type": "pong", "data": {}})
            else:
                # Handle other notification-related messages
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user.id}: {e}")
        manager.disconnect(websocket, user.id)


@websocket_router.websocket("/ws/board/{board_id}")
async def websocket_board(
    websocket: WebSocket,
    board_id: UUID,
    token: str
):
    """
    WebSocket endpoint for real-time board collaboration.
    
    Message types:
    - cursor_move: Update cursor position
    - board_update: Board state changes (resources, connections)
    - presence_update: User presence status
    - resource_update: Individual resource updates
    - connection_update: Connection changes
    """
    user = await get_current_user_ws(websocket, token)
    if not user:
        return
    
    # Verify board access
    async with get_async_session() as db:
        board_result = await db.execute(
            select(Board).where(
                Board.id == board_id,
                Board.user_id == user.id
            )
        )
        board = board_result.scalar_one_or_none()
        
        if not board:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    
    # Connect to board
    await manager.connect(websocket, user.id)
    await manager.connect_to_board(websocket, board_id, user.id, user.email or f"User {user.id}")
    
    try:
        # Send connection confirmation with current board state and presence
        await websocket.send_json({
            "type": "connection",
            "data": {
                "status": "connected",
                "board_id": str(board_id),
                "user_id": str(user.id),
                "presence": manager.get_board_presence(board_id)
            }
        })
        
        # Notify other users of new presence
        await manager.broadcast_to_board(
            {
                "type": "presence_join",
                "data": {
                    "user_id": str(user.id),
                    "user_name": user.email or f"User {user.id}",
                    "presence": asdict(manager.user_presence[user.id])
                }
            },
            board_id,
            exclude_websocket=websocket
        )
        
        # Handle messages
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            message_data = data.get("data", {})
            
            if message_type == "ping":
                # Heartbeat
                await websocket.send_json({"type": "pong", "data": {}})
                
            elif message_type == "cursor_move":
                # Update cursor position
                x = message_data.get("x", 0)
                y = message_data.get("y", 0)
                await manager.update_cursor_position(board_id, user.id, x, y)
                
            elif message_type == "board_update":
                # Broadcast board state changes
                update_data = {
                    "type": "board_update",
                    "data": {
                        "user_id": str(user.id),
                        "timestamp": datetime.utcnow().isoformat(),
                        **message_data
                    }
                }
                
                # Save board state to database
                async with get_async_session() as db:
                    board = await db.get(Board, board_id)
                    if board:
                        if "resources" in message_data:
                            board.resources_data = json.dumps(message_data["resources"])
                        if "connections" in message_data:
                            board.connections_data = json.dumps(message_data["connections"])
                        if "ai_chats" in message_data:
                            board.ai_chats_data = json.dumps(message_data["ai_chats"])
                        await db.commit()
                
                # Broadcast to all users
                await manager.broadcast_to_board(update_data, board_id, exclude_websocket=websocket)
                
            elif message_type == "resource_update":
                # Broadcast individual resource updates
                await manager.broadcast_to_board(
                    {
                        "type": "resource_update",
                        "data": {
                            "user_id": str(user.id),
                            "timestamp": datetime.utcnow().isoformat(),
                            **message_data
                        }
                    },
                    board_id,
                    exclude_websocket=websocket
                )
                
            elif message_type == "connection_update":
                # Broadcast connection updates
                await manager.broadcast_to_board(
                    {
                        "type": "connection_update",
                        "data": {
                            "user_id": str(user.id),
                            "timestamp": datetime.utcnow().isoformat(),
                            **message_data
                        }
                    },
                    board_id,
                    exclude_websocket=websocket
                )
                
            elif message_type == "presence_update":
                # Update user presence status
                status_update = message_data.get("status", "active")
                if user.id in manager.user_presence:
                    manager.user_presence[user.id].status = status_update
                    manager.user_presence[user.id].last_seen = datetime.utcnow().timestamp()
                    
                    await manager.broadcast_to_board(
                        {
                            "type": "presence_update",
                            "data": asdict(manager.user_presence[user.id])
                        },
                        board_id
                    )
            
            else:
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": f"Unknown message type: {message_type}"}
                })
                
    except WebSocketDisconnect:
        # Notify other users of disconnection
        await manager.broadcast_to_board(
            {
                "type": "presence_leave",
                "data": {
                    "user_id": str(user.id)
                }
            },
            board_id
        )
        
        manager.disconnect_from_board(websocket, board_id, user.id)
        manager.disconnect(websocket, user.id)
        logger.info(f"User {user.id} disconnected from board {board_id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user.id} on board {board_id}: {e}")
        manager.disconnect_from_board(websocket, board_id, user.id)
        manager.disconnect(websocket, user.id)
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)


