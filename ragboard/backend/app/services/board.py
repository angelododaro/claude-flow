"""
Board service for managing board operations.
"""

import json
import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select

from app.models.board import Board
from app.schemas.board import BoardCreate, BoardUpdate, BoardResponse, BoardListResponse


class BoardService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def save_board(self, user_id: uuid.UUID, board_data: BoardCreate) -> BoardResponse:
        """Save or update a board."""
        # For now, create a new board each time
        # In production, you might want to update existing boards
        
        board = Board(
            id=uuid.uuid4(),
            name=board_data.name,
            user_id=user_id,
            resources_data=json.dumps(board_data.resources),
            connections_data=json.dumps(board_data.connections),
            ai_chats_data=json.dumps(board_data.aiChats)
        )
        
        self.db.add(board)
        await self.db.commit()
        await self.db.refresh(board)
        
        return BoardResponse(
            id=str(board.id),
            name=board.name,
            resources=json.loads(board.resources_data) if board.resources_data else [],
            connections=json.loads(board.connections_data) if board.connections_data else [],
            aiChats=json.loads(board.ai_chats_data) if board.ai_chats_data else [],
            createdAt=board.created_at,
            updatedAt=board.updated_at
        )
    
    async def list_boards(self, user_id: uuid.UUID) -> List[BoardListResponse]:
        """List all boards for a user."""
        query = select(Board).where(
            Board.user_id == user_id
        ).order_by(Board.updated_at.desc())
        result = await self.db.execute(query)
        boards = result.scalars().all()
        
        return [
            BoardListResponse(
                id=str(board.id),
                name=board.name,
                updatedAt=board.updated_at
            )
            for board in boards
        ]
    
    async def load_board(self, board_id: str, user_id: uuid.UUID) -> Optional[BoardResponse]:
        """Load a specific board."""
        try:
            board_uuid = uuid.UUID(board_id)
        except ValueError:
            return None
        
        query = select(Board).where(
            and_(Board.id == board_uuid, Board.user_id == user_id)
        )
        result = await self.db.execute(query)
        board = result.scalar_one_or_none()
        
        if not board:
            return None
        
        return BoardResponse(
            id=str(board.id),
            name=board.name,
            resources=json.loads(board.resources_data) if board.resources_data else [],
            connections=json.loads(board.connections_data) if board.connections_data else [],
            aiChats=json.loads(board.ai_chats_data) if board.ai_chats_data else [],
            createdAt=board.created_at,
            updatedAt=board.updated_at
        )
    
    async def delete_board(self, board_id: str, user_id: uuid.UUID) -> bool:
        """Delete a board."""
        try:
            board_uuid = uuid.UUID(board_id)
        except ValueError:
            return False
        
        query = select(Board).where(
            and_(Board.id == board_uuid, Board.user_id == user_id)
        )
        result = await self.db.execute(query)
        board = result.scalar_one_or_none()
        
        if not board:
            return False
        
        await self.db.delete(board)
        await self.db.commit()
        return True