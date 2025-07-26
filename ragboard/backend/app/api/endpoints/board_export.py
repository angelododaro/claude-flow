"""
Board export functionality for sharing and downloading.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
import io
from datetime import datetime

from app.services.board import BoardService
from app.db.session import get_db
from sqlalchemy.orm import Session

router = APIRouter()

class ExportRequest(BaseModel):
    format: str = "json"  # json, png, pdf
    settings: Optional[dict] = None
    include_metadata: bool = True
    high_resolution: bool = True
    include_comments: bool = False

@router.post("/{board_id}/export", summary="Export board in various formats")
async def export_board(
    board_id: str,
    export_request: ExportRequest,
    db: Session = Depends(get_db)
):
    """
    Export a board in various formats (JSON, PNG, PDF).
    
    Supports different export formats:
    - JSON: Complete board data with resources and connections
    - PNG: High-resolution image of the board
    - PDF: Printable PDF document of the board
    """
    try:
        board_service = BoardService(db)
        
        # Get board data
        board = await board_service.get_board(board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        resources = await board_service.get_board_resources(board_id)
        
        if export_request.format == "json":
            return await export_json(board, resources, export_request)
        elif export_request.format == "png":
            return await export_png(board, resources, export_request)
        elif export_request.format == "pdf":
            return await export_pdf(board, resources, export_request)
        else:
            raise HTTPException(status_code=400, detail="Unsupported export format")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

async def export_json(board, resources, export_request: ExportRequest):
    """Export board as JSON data."""
    
    export_data = {
        "board": {
            "id": board.id,
            "name": board.name,
            "description": board.description,
            "created_at": board.created_at.isoformat() if board.created_at else None,
            "updated_at": board.updated_at.isoformat() if board.updated_at else None
        },
        "resources": [],
        "export_info": {
            "format": "json",
            "exported_at": datetime.now().isoformat(),
            "version": "1.0",
            "metadata_included": export_request.include_metadata
        }
    }
    
    # Add resources
    for resource in resources:
        resource_data = {
            "id": resource.id,
            "type": resource.type,
            "title": resource.title,
            "position": resource.position,
            "created_at": resource.created_at.isoformat() if resource.created_at else None
        }
        
        # Add metadata if requested
        if export_request.include_metadata and hasattr(resource, 'metadata') and resource.metadata:
            resource_data["metadata"] = resource.metadata
            
        export_data["resources"].append(resource_data)
    
    # Create response
    json_str = json.dumps(export_data, indent=2)
    
    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=board_{board.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        }
    )

async def export_png(board, resources, export_request: ExportRequest):
    """Export board as PNG image."""
    
    # For now, return a placeholder response
    # In production, this would render the board canvas to an image
    placeholder_content = f"""
    PNG Export for Board: {board.name}
    
    This would contain a rendered image of the board with all resources positioned correctly.
    
    Resources: {len(resources)}
    High Resolution: {export_request.high_resolution}
    Exported at: {datetime.now().isoformat()}
    """.encode()
    
    return Response(
        content=placeholder_content,
        media_type="image/png",
        headers={
            "Content-Disposition": f"attachment; filename=board_{board.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        }
    )

async def export_pdf(board, resources, export_request: ExportRequest):
    """Export board as PDF document."""
    
    # For now, return a placeholder response
    # In production, this would generate a PDF with the board layout
    placeholder_content = f"""
    PDF Export for Board: {board.name}
    
    This would contain a formatted PDF document of the board.
    
    Resources: {len(resources)}
    Include Comments: {export_request.include_comments}
    Exported at: {datetime.now().isoformat()}
    """.encode()
    
    return Response(
        content=placeholder_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=board_{board.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        }
    )

@router.get("/{board_id}/share-url", summary="Generate shareable URL")
async def generate_share_url(
    board_id: str,
    public: bool = False,
    comments: bool = True,
    editing: bool = False,
    auth: bool = False,
    expires: Optional[str] = None,
    password: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Generate a shareable URL for the board with specific permissions.
    """
    try:
        board_service = BoardService(db)
        
        # Verify board exists
        board = await board_service.get_board(board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Generate share token (in production this would be stored in database)
        share_token = f"share_{board_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Build share URL
        base_url = "http://localhost:3000"  # In production, use actual domain
        share_url = f"{base_url}/shared/{board_id}?token={share_token}"
        
        # Add parameters
        params = []
        if public:
            params.append("public=true")
        if comments:
            params.append("comments=true")
        if editing:
            params.append("editing=true")
        if auth:
            params.append("auth=true")
        if expires:
            params.append(f"expires={expires}")
        if password:
            params.append("password=protected")
            
        if params:
            share_url += "&" + "&".join(params)
        
        return {
            "success": True,
            "share_url": share_url,
            "share_token": share_token,
            "settings": {
                "public": public,
                "allow_comments": comments,
                "allow_editing": editing,
                "require_auth": auth,
                "expires_at": expires,
                "password_protected": bool(password)
            },
            "created_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate share URL: {str(e)}")

@router.get("/{board_id}/embed-code", summary="Generate embed code")
async def generate_embed_code(
    board_id: str,
    width: str = "100%",
    height: str = "600",
    db: Session = Depends(get_db)
):
    """
    Generate HTML embed code for the board.
    """
    try:
        board_service = BoardService(db)
        
        # Verify board exists
        board = await board_service.get_board(board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Generate embed URL
        base_url = "http://localhost:3000"  # In production, use actual domain
        embed_url = f"{base_url}/embed/{board_id}"
        
        # Generate embed code
        embed_code = f'''<iframe
  src="{embed_url}"
  width="{width}"
  height="{height}"
  frameborder="0"
  allowfullscreen>
</iframe>'''
        
        return {
            "success": True,
            "embed_code": embed_code,
            "embed_url": embed_url,
            "settings": {
                "width": width,
                "height": height
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate embed code: {str(e)}")