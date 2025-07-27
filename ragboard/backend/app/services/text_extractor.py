"""
Enhanced text extraction service for various file formats.
"""

import os
import io
import logging
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path
import asyncio
import aiofiles
import tempfile
import mimetypes

# Document processing imports
import PyPDF2
import fitz  # PyMuPDF for better PDF handling
from PIL import Image
import pytesseract
from docx import Document

# Additional format support
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

try:
    import markdown
    MARKDOWN_AVAILABLE = True
except ImportError:
    MARKDOWN_AVAILABLE = False

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False

logger = logging.getLogger(__name__)


class TextExtractor:
    """Service for extracting text from various file formats."""
    
    def __init__(self):
        self.supported_formats = {
            '.pdf': self._extract_pdf,
            '.txt': self._extract_text,
            '.docx': self._extract_docx,
            '.doc': self._extract_docx,  # Older Word format
            '.png': self._extract_image,
            '.jpg': self._extract_image,
            '.jpeg': self._extract_image,
            '.gif': self._extract_image,
            '.bmp': self._extract_image,
            '.tiff': self._extract_image,
            '.md': self._extract_markdown,
            '.html': self._extract_html,
            '.htm': self._extract_html,
            '.csv': self._extract_csv,
            '.xlsx': self._extract_excel,
            '.xls': self._extract_excel,
            '.json': self._extract_json,
            '.xml': self._extract_xml,
        }
    
    async def extract_text(
        self, 
        file_path: str, 
        file_type: Optional[str] = None,
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Extract text from a file and optionally chunk it.
        
        Args:
            file_path: Path to the file
            file_type: Override file type detection
            chunk_size: Size of text chunks in characters
            chunk_overlap: Overlap between chunks
            
        Returns:
            Tuple of (full_text, chunks)
        """
        # Determine file type
        if not file_type:
            file_ext = Path(file_path).suffix.lower()
        else:
            file_ext = f".{file_type.lower()}" if not file_type.startswith('.') else file_type.lower()
        
        # Check if format is supported
        if file_ext not in self.supported_formats:
            logger.warning(f"Unsupported file format: {file_ext}")
            return "", []
        
        # Extract text
        try:
            extractor = self.supported_formats[file_ext]
            full_text = await extractor(file_path)
            
            # Chunk the text
            chunks = self._chunk_text(full_text, chunk_size, chunk_overlap)
            
            return full_text, chunks
            
        except Exception as e:
            logger.error(f"Error extracting text from {file_path}: {str(e)}")
            return "", []
    
    def _chunk_text(
        self, 
        text: str, 
        chunk_size: int = 1000, 
        chunk_overlap: int = 200
    ) -> List[Dict[str, Any]]:
        """
        Split text into overlapping chunks.
        
        Args:
            text: The full text to chunk
            chunk_size: Size of each chunk in characters
            chunk_overlap: Overlap between chunks
            
        Returns:
            List of chunk dictionaries
        """
        if not text:
            return []
        
        chunks = []
        start = 0
        text_length = len(text)
        chunk_index = 0
        
        while start < text_length:
            # Calculate end position
            end = min(start + chunk_size, text_length)
            
            # Try to find a sentence boundary near the end
            if end < text_length:
                # Look for sentence endings
                for delimiter in ['. ', '! ', '? ', '\n\n', '\n']:
                    last_delimiter = text.rfind(delimiter, start, end)
                    if last_delimiter != -1 and last_delimiter > start + chunk_size // 2:
                        end = last_delimiter + len(delimiter)
                        break
            
            # Extract chunk
            chunk_text = text[start:end].strip()
            
            if chunk_text:
                chunks.append({
                    'index': chunk_index,
                    'text': chunk_text,
                    'start_char': start,
                    'end_char': end,
                    'length': len(chunk_text)
                })
                chunk_index += 1
            
            # Move start position
            start = end - chunk_overlap if end < text_length else end
        
        return chunks
    
    async def _extract_pdf(self, file_path: str) -> str:
        """Extract text from PDF using PyMuPDF for better results."""
        text_parts = []
        
        try:
            # Try PyMuPDF first (better for complex PDFs)
            doc = fitz.open(file_path)
            for page_num, page in enumerate(doc):
                text = page.get_text()
                if text.strip():
                    text_parts.append(f"[Page {page_num + 1}]\n{text}")
            doc.close()
            
        except Exception as e:
            logger.warning(f"PyMuPDF extraction failed, falling back to PyPDF2: {e}")
            
            # Fallback to PyPDF2
            try:
                async with aiofiles.open(file_path, 'rb') as file:
                    content = await file.read()
                    pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
                    
                    for page_num, page in enumerate(pdf_reader.pages):
                        text = page.extract_text()
                        if text.strip():
                            text_parts.append(f"[Page {page_num + 1}]\n{text}")
                            
            except Exception as e2:
                logger.error(f"PDF extraction failed completely: {e2}")
                return ""
        
        return "\n\n".join(text_parts)
    
    async def _extract_text(self, file_path: str) -> str:
        """Extract text from plain text file."""
        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
                return await file.read()
        except UnicodeDecodeError:
            # Try different encodings
            for encoding in ['latin-1', 'cp1252', 'iso-8859-1']:
                try:
                    async with aiofiles.open(file_path, 'r', encoding=encoding) as file:
                        return await file.read()
                except:
                    continue
            return ""
    
    async def _extract_docx(self, file_path: str) -> str:
        """Extract text from Word documents."""
        try:
            doc = Document(file_path)
            paragraphs = []
            
            for para in doc.paragraphs:
                if para.text.strip():
                    paragraphs.append(para.text)
            
            # Also extract text from tables
            for table in doc.tables:
                for row in table.rows:
                    row_text = []
                    for cell in row.cells:
                        if cell.text.strip():
                            row_text.append(cell.text)
                    if row_text:
                        paragraphs.append(" | ".join(row_text))
            
            return "\n\n".join(paragraphs)
            
        except Exception as e:
            logger.error(f"Error extracting DOCX: {e}")
            return ""
    
    async def _extract_image(self, file_path: str) -> str:
        """Extract text from images using OCR."""
        try:
            image = Image.open(file_path)
            
            # Preprocess image for better OCR
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Extract text using Tesseract
            text = pytesseract.image_to_string(image, lang='eng')
            
            return text.strip()
            
        except Exception as e:
            logger.error(f"Error extracting text from image: {e}")
            return ""
    
    async def _extract_markdown(self, file_path: str) -> str:
        """Extract text from Markdown files."""
        content = await self._extract_text(file_path)
        
        if MARKDOWN_AVAILABLE:
            try:
                # Convert markdown to plain text
                html = markdown.markdown(content)
                if BS4_AVAILABLE:
                    soup = BeautifulSoup(html, 'html.parser')
                    return soup.get_text()
                else:
                    # Basic HTML tag removal
                    import re
                    return re.sub('<[^<]+?>', '', html)
            except:
                pass
        
        return content
    
    async def _extract_html(self, file_path: str) -> str:
        """Extract text from HTML files."""
        content = await self._extract_text(file_path)
        
        if BS4_AVAILABLE:
            try:
                soup = BeautifulSoup(content, 'html.parser')
                
                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()
                
                # Get text
                text = soup.get_text()
                
                # Clean up whitespace
                lines = (line.strip() for line in text.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text = '\n'.join(chunk for chunk in chunks if chunk)
                
                return text
            except:
                pass
        
        # Basic fallback
        import re
        return re.sub('<[^<]+?>', '', content)
    
    async def _extract_csv(self, file_path: str) -> str:
        """Extract text from CSV files."""
        if PANDAS_AVAILABLE:
            try:
                df = pd.read_csv(file_path)
                # Convert to string representation
                return df.to_string()
            except:
                pass
        
        # Fallback to basic reading
        return await self._extract_text(file_path)
    
    async def _extract_excel(self, file_path: str) -> str:
        """Extract text from Excel files."""
        if PANDAS_AVAILABLE:
            try:
                # Read all sheets
                excel_file = pd.ExcelFile(file_path)
                text_parts = []
                
                for sheet_name in excel_file.sheet_names:
                    df = pd.read_excel(file_path, sheet_name=sheet_name)
                    text_parts.append(f"[Sheet: {sheet_name}]\n{df.to_string()}")
                
                return "\n\n".join(text_parts)
            except Exception as e:
                logger.error(f"Error extracting Excel: {e}")
        
        return ""
    
    async def _extract_json(self, file_path: str) -> str:
        """Extract text from JSON files."""
        import json
        
        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
                content = await file.read()
                data = json.loads(content)
                
                # Pretty print for readability
                return json.dumps(data, indent=2, ensure_ascii=False)
        except:
            return await self._extract_text(file_path)
    
    async def _extract_xml(self, file_path: str) -> str:
        """Extract text from XML files."""
        content = await self._extract_text(file_path)
        
        if BS4_AVAILABLE:
            try:
                soup = BeautifulSoup(content, 'xml')
                return soup.get_text()
            except:
                pass
        
        # Basic tag removal
        import re
        return re.sub('<[^<]+?>', '', content)


# Global instance
text_extractor = TextExtractor()