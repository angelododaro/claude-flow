"""
Yjs WebSocket provider for real-time collaborative editing.
Handles Yjs document synchronization between clients.
"""

import asyncio
import json
import logging
import struct
from typing import Dict, Set, Optional, Any
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from fastapi.websockets import WebSocketState

from app.core.config import settings
from app.core.security import verify_token
from app.db.base import get_async_session
from app.models.user import User
from app.models.board import Board
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

yjs_router = APIRouter()

class YjsMessage:
    """Yjs message types and utilities."""
    
    # Message types from y-protocols
    SYNC_STEP_1 = 0
    SYNC_STEP_2 = 1
    UPDATE = 2
    AWARENESS = 3
    AUTH = 4
    QUERY_AWARENESS = 5
    
    @staticmethod
    def create_sync_step1(state_vector: bytes) -> bytes:
        """Create a sync step 1 message."""
        msg = bytearray([YjsMessage.SYNC_STEP_1])
        msg.extend(state_vector)
        return bytes(msg)
    
    @staticmethod
    def create_sync_step2(update: bytes) -> bytes:
        """Create a sync step 2 message."""
        msg = bytearray([YjsMessage.SYNC_STEP_2])
        msg.extend(update)
        return bytes(msg)
    
    @staticmethod
    def create_update(update: bytes) -> bytes:
        """Create an update message."""
        msg = bytearray([YjsMessage.UPDATE])
        msg.extend(update)
        return bytes(msg)
    
    @staticmethod
    def create_awareness(awareness: bytes) -> bytes:
        """Create an awareness message."""
        msg = bytearray([YjsMessage.AWARENESS])
        msg.extend(awareness)
        return bytes(msg)
    
    @staticmethod
    def parse_message(data: bytes) -> tuple[int, bytes]:
        """Parse a Yjs message."""
        if len(data) < 1:
            raise ValueError("Message too short")
        
        msg_type = data[0]
        payload = data[1:]
        return msg_type, payload

class YjsDocument:
    """Represents a collaborative document state."""
    
    def __init__(self, doc_id: str):
        self.doc_id = doc_id
        self.state_vector: bytes = b''
        self.updates: list[bytes] = []
        self.awareness_states: Dict[str, bytes] = {}
        self.last_modified = datetime.utcnow()
    
    def apply_update(self, update: bytes, client_id: str) -> None:
        """Apply an update to the document."""
        self.updates.append(update)
        self.last_modified = datetime.utcnow()
        logger.debug(f"Applied update to document {self.doc_id} from client {client_id}")
    
    def set_awareness(self, client_id: str, awareness: bytes) -> None:
        """Set awareness state for a client."""
        if awareness:
            self.awareness_states[client_id] = awareness
        elif client_id in self.awareness_states:
            del self.awareness_states[client_id]
        
        logger.debug(f"Updated awareness for client {client_id} in document {self.doc_id}")
    
    def get_full_update(self) -> bytes:
        """Get the full document state as a single update."""
        if not self.updates:
            return b''
        
        # In a real implementation, you'd merge all updates
        # For now, we'll return the latest update
        return self.updates[-1] if self.updates else b''
    
    def get_awareness_update(self) -> bytes:
        """Get the current awareness state."""
        # Combine all awareness states
        # This is a simplified implementation
        combined = b''
        for awareness in self.awareness_states.values():
            combined += awareness
        return combined

class YjsConnectionManager:
    """Manages Yjs WebSocket connections and document synchronization."""
    
    def __init__(self):
        self.documents: Dict[str, YjsDocument] = {}
        self.client_connections: Dict[str, Set[WebSocket]] = {}
        self.client_documents: Dict[WebSocket, str] = {}
        self.client_users: Dict[WebSocket, UUID] = {}
    
    def get_or_create_document(self, doc_id: str) -> YjsDocument:
        """Get or create a Yjs document."""
        if doc_id not in self.documents:
            self.documents[doc_id] = YjsDocument(doc_id)
            logger.info(f"Created new Yjs document: {doc_id}")
        return self.documents[doc_id]
    
    async def add_client(self, websocket: WebSocket, doc_id: str, user_id: UUID) -> None:
        """Add a client to a document."""
        if doc_id not in self.client_connections:
            self.client_connections[doc_id] = set()
        
        self.client_connections[doc_id].add(websocket)
        self.client_documents[websocket] = doc_id
        self.client_users[websocket] = user_id
        
        logger.info(f"Added client {user_id} to Yjs document {doc_id}")
    
    def remove_client(self, websocket: WebSocket) -> None:
        """Remove a client from all documents."""
        doc_id = self.client_documents.get(websocket)
        user_id = self.client_users.get(websocket)
        
        if doc_id and doc_id in self.client_connections:
            self.client_connections[doc_id].discard(websocket)
            
            # Clean up empty document connections
            if not self.client_connections[doc_id]:
                del self.client_connections[doc_id]
        
        self.client_documents.pop(websocket, None)
        self.client_users.pop(websocket, None)
        
        # Clean up awareness state
        if doc_id and doc_id in self.documents:
            client_id = str(user_id) if user_id else str(id(websocket))
            self.documents[doc_id].set_awareness(client_id, b'')
        
        logger.info(f"Removed client {user_id} from Yjs document {doc_id}")
    
    async def broadcast_to_document(self, doc_id: str, message: bytes, exclude: Optional[WebSocket] = None) -> None:
        """Broadcast a message to all clients in a document."""
        if doc_id not in self.client_connections:
            return
        
        disconnected = []
        for websocket in self.client_connections[doc_id]:
            if websocket == exclude:
                continue
            
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_bytes(message)
                else:
                    disconnected.append(websocket)
            except Exception as e:
                logger.error(f"Error broadcasting to client in document {doc_id}: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected clients
        for websocket in disconnected:
            self.remove_client(websocket)
    
    async def handle_sync_step1(self, websocket: WebSocket, doc_id: str, state_vector: bytes) -> None:
        """Handle sync step 1 - client requests missing updates."""
        document = self.get_or_create_document(doc_id)
        
        # Get the full document update
        full_update = document.get_full_update()
        
        if full_update:
            response = YjsMessage.create_sync_step2(full_update)
            await websocket.send_bytes(response)
            logger.debug(f"Sent sync step 2 to client for document {doc_id}")
    
    async def handle_sync_step2(self, websocket: WebSocket, doc_id: str, update: bytes) -> None:
        """Handle sync step 2 - client sends missing updates."""
        document = self.get_or_create_document(doc_id)
        user_id = self.client_users.get(websocket)
        client_id = str(user_id) if user_id else str(id(websocket))
        
        # Apply the update to the document
        document.apply_update(update, client_id)
        
        # Broadcast the update to other clients
        update_message = YjsMessage.create_update(update)
        await self.broadcast_to_document(doc_id, update_message, exclude=websocket)
        
        logger.debug(f"Processed sync step 2 from client {client_id} for document {doc_id}")
    
    async def handle_update(self, websocket: WebSocket, doc_id: str, update: bytes) -> None:
        """Handle document update."""
        document = self.get_or_create_document(doc_id)
        user_id = self.client_users.get(websocket)
        client_id = str(user_id) if user_id else str(id(websocket))
        
        # Apply the update to the document
        document.apply_update(update, client_id)
        
        # Broadcast the update to other clients
        update_message = YjsMessage.create_update(update)
        await self.broadcast_to_document(doc_id, update_message, exclude=websocket)
        
        logger.debug(f"Processed update from client {client_id} for document {doc_id}")
    
    async def handle_awareness(self, websocket: WebSocket, doc_id: str, awareness: bytes) -> None:
        """Handle awareness update."""
        document = self.get_or_create_document(doc_id)
        user_id = self.client_users.get(websocket)
        client_id = str(user_id) if user_id else str(id(websocket))
        
        # Update awareness state
        document.set_awareness(client_id, awareness)
        
        # Broadcast awareness to other clients
        awareness_message = YjsMessage.create_awareness(awareness)
        await self.broadcast_to_document(doc_id, awareness_message, exclude=websocket)
        
        logger.debug(f"Processed awareness update from client {client_id} for document {doc_id}")
    
    async def send_initial_awareness(self, websocket: WebSocket, doc_id: str) -> None:
        """Send current awareness state to a new client."""
        document = self.get_or_create_document(doc_id)
        awareness_update = document.get_awareness_update()
        
        if awareness_update:
            awareness_message = YjsMessage.create_awareness(awareness_update)
            await websocket.send_bytes(awareness_message)
            logger.debug(f"Sent initial awareness to client for document {doc_id}")

# Global connection manager
yjs_manager = YjsConnectionManager()

async def get_current_user_yjs(websocket: WebSocket, token: str) -> Optional[User]:
    """Verify WebSocket authentication for Yjs."""
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
        logger.error(f"Yjs WebSocket authentication error: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

@yjs_router.websocket("/yjs/{board_id}")
async def yjs_websocket(
    websocket: WebSocket,
    board_id: UUID,
    token: str
):
    """
    Yjs WebSocket endpoint for real-time collaborative editing.
    
    This endpoint handles Yjs protocol messages for document synchronization
    and awareness updates between multiple clients.
    """
    user = await get_current_user_yjs(websocket, token)
    if not user:
        return
    
    # Verify board access
    async with get_async_session() as db:
        board_result = await db.execute(
            select(Board).where(
                Board.id == board_id,
                Board.user_id == user.id  # TODO: Add proper permission checking
            )
        )
        board = board_result.scalar_one_or_none()
        
        if not board:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    
    # Accept WebSocket connection
    await websocket.accept()
    
    # Add client to document
    doc_id = str(board_id)
    await yjs_manager.add_client(websocket, doc_id, user.id)
    
    try:
        # Send initial awareness state
        await yjs_manager.send_initial_awareness(websocket, doc_id)
        
        # Handle messages
        while True:
            try:
                # Receive binary message
                data = await websocket.receive_bytes()
                
                # Parse Yjs message
                msg_type, payload = YjsMessage.parse_message(data)
                
                if msg_type == YjsMessage.SYNC_STEP_1:
                    await yjs_manager.handle_sync_step1(websocket, doc_id, payload)
                
                elif msg_type == YjsMessage.SYNC_STEP_2:
                    await yjs_manager.handle_sync_step2(websocket, doc_id, payload)
                
                elif msg_type == YjsMessage.UPDATE:
                    await yjs_manager.handle_update(websocket, doc_id, payload)
                
                elif msg_type == YjsMessage.AWARENESS:
                    await yjs_manager.handle_awareness(websocket, doc_id, payload)
                
                elif msg_type == YjsMessage.QUERY_AWARENESS:
                    await yjs_manager.send_initial_awareness(websocket, doc_id)
                
                else:
                    logger.warning(f"Unknown Yjs message type: {msg_type}")
                    
            except ValueError as e:
                logger.error(f"Invalid Yjs message format: {e}")
                continue
            except Exception as e:
                logger.error(f"Error processing Yjs message: {e}")
                continue
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Yjs WebSocket error for user {user.id}: {e}")
    finally:
        yjs_manager.remove_client(websocket)
        logger.info(f"User {user.id} disconnected from Yjs document {doc_id}")

# Additional endpoints for document management
@yjs_router.get("/yjs/{board_id}/status")
async def get_yjs_document_status(board_id: UUID):
    """Get status of a Yjs document."""
    doc_id = str(board_id)
    document = yjs_manager.documents.get(doc_id)
    
    if not document:
        return {
            "exists": False,
            "clients": 0,
            "last_modified": None
        }
    
    client_count = len(yjs_manager.client_connections.get(doc_id, set()))
    
    return {
        "exists": True,
        "clients": client_count,
        "last_modified": document.last_modified.isoformat(),
        "updates_count": len(document.updates),
        "awareness_count": len(document.awareness_states)
    }