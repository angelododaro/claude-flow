# Phase 4: Enhancement Features Implementation Guide

## Overview
This guide covers the implementation of advanced features including LangChain integration, comprehensive file processing, analytics with PostHog, and Excalidraw whiteboard functionality.

## 1. LangChain Integration

### Architecture
```
User Query → LangChain Agent → Tools → RAG Retrieval → Response
                    ↓
            Memory Management
```

### Implementation

**File: `backend/app/modules/ai/config/llm_config.py`**
```python
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
import os

class LLMConfig:
    @staticmethod
    def get_llm(model_type: str = "claude"):
        callback_manager = CallbackManager([StreamingStdOutCallbackHandler()])
        
        if model_type == "claude":
            return ChatAnthropic(
                model="claude-3-opus-20240229",
                anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
                streaming=True,
                callback_manager=callback_manager,
                max_tokens=4096
            )
        elif model_type == "gpt4":
            return ChatOpenAI(
                model="gpt-4-turbo-preview",
                openai_api_key=os.getenv("OPENAI_API_KEY"),
                streaming=True,
                callback_manager=callback_manager
            )
        else:
            raise ValueError(f"Unknown model type: {model_type}")
```

**File: `backend/app/modules/ai/chains/rag_chain.py`**
```python
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferWindowMemory
from langchain.agents import Tool, AgentExecutor, create_react_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from typing import List, Dict

class RAGChain:
    def __init__(self, llm, retriever):
        self.llm = llm
        self.retriever = retriever
        self.memory = ConversationBufferWindowMemory(
            memory_key="chat_history",
            return_messages=True,
            k=10  # Keep last 10 exchanges
        )
        
    def create_qa_chain(self):
        """Create a simple QA chain"""
        prompt_template = """You are a helpful AI assistant with access to a knowledge base.
        Use the following context to answer the question. If you don't know the answer, 
        say so honestly.

        Context: {context}
        
        Human: {question}
        Assistant: """
        
        prompt = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question"]
        )
        
        return RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=self.retriever,
            chain_type_kwargs={"prompt": prompt},
            return_source_documents=True
        )
    
    def create_agent_chain(self, tools: List[Tool]):
        """Create an agent with tools"""
        
        # Define the prompt
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a helpful AI assistant with access to various tools and a knowledge base.
            Use the tools when needed to provide accurate and helpful responses.
            Always cite your sources when using retrieved information."""),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            ("assistant", "I'll help you with that. Let me think about the best approach.\n\n{agent_scratchpad}")
        ])
        
        # Create the agent
        agent = create_react_agent(
            llm=self.llm,
            tools=tools,
            prompt=prompt
        )
        
        # Create executor with memory
        return AgentExecutor(
            agent=agent,
            tools=tools,
            memory=self.memory,
            verbose=True,
            return_intermediate_steps=True,
            handle_parsing_errors=True,
            max_iterations=5
        )
```

**File: `backend/app/modules/ai/tools/custom_tools.py`**
```python
from langchain.tools import Tool, StructuredTool
from langchain.pydantic_v1 import BaseModel, Field
from typing import List, Optional
import requests

class SearchInput(BaseModel):
    query: str = Field(description="The search query")
    resource_types: Optional[List[str]] = Field(
        default=None, 
        description="Filter by resource types"
    )

class RAGSearchTool(StructuredTool):
    name = "search_knowledge_base"
    description = "Search the board's knowledge base for relevant information"
    args_schema = SearchInput
    
    def __init__(self, board_id: str, search_service):
        super().__init__(
            func=self._run,
            coroutine=self._arun
        )
        self.board_id = board_id
        self.search_service = search_service
    
    async def _arun(self, query: str, resource_types: Optional[List[str]] = None):
        results = await self.search_service.search(
            board_id=self.board_id,
            query=query,
            n_results=5,
            resource_types=resource_types
        )
        
        # Format results for the agent
        formatted = []
        for r in results:
            formatted.append(
                f"[{r['metadata']['resource_type']} - {r['metadata']['resource_title']}]: "
                f"{r['text'][:200]}..."
            )
        
        return "\n\n".join(formatted)
    
    def _run(self, *args, **kwargs):
        import asyncio
        return asyncio.run(self._arun(*args, **kwargs))

class WebSearchTool(Tool):
    name = "web_search"
    description = "Search the web for current information"
    
    def __init__(self):
        super().__init__(
            func=self._run,
            description=self.description
        )
    
    def _run(self, query: str) -> str:
        # Use a search API (e.g., Serper, SerpAPI)
        api_key = os.getenv("SERPER_API_KEY")
        response = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key},
            json={"q": query, "num": 5}
        )
        
        results = response.json()
        formatted = []
        
        for result in results.get("organic", [])[:3]:
            formatted.append(
                f"Title: {result['title']}\n"
                f"Snippet: {result['snippet']}\n"
                f"URL: {result['link']}"
            )
        
        return "\n\n".join(formatted)

def create_board_tools(board_id: str, services) -> List[Tool]:
    """Create tools for a specific board"""
    return [
        RAGSearchTool(board_id, services.search_service),
        WebSearchTool(),
        Tool(
            name="calculator",
            description="Perform mathematical calculations",
            func=lambda x: str(eval(x))
        )
    ]
```

## 2. File Processing Pipeline

### PDF Processing

**File: `backend/app/modules/processing/pdf/pdf_processor.py`**
```python
import PyPDF2
import pdfplumber
from pdf2image import convert_from_path
import pytesseract
import io
from typing import List, Dict, Tuple

class PDFProcessor:
    def __init__(self):
        self.max_pages = 100  # Limit for safety
        
    async def process_pdf(self, file_path: str) -> Dict:
        """Extract text, metadata, and images from PDF"""
        result = {
            "text": "",
            "metadata": {},
            "images": [],
            "tables": [],
            "page_count": 0
        }
        
        # Try PyPDF2 first (faster)
        try:
            result["text"] = await self._extract_with_pypdf2(file_path)
            if len(result["text"]) < 100:  # Likely scanned PDF
                result["text"] = await self._extract_with_ocr(file_path)
        except:
            # Fallback to OCR
            result["text"] = await self._extract_with_ocr(file_path)
        
        # Extract tables with pdfplumber
        result["tables"] = await self._extract_tables(file_path)
        
        # Extract metadata
        result["metadata"] = await self._extract_metadata(file_path)
        
        return result
    
    async def _extract_with_pypdf2(self, file_path: str) -> str:
        text = ""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            for i, page in enumerate(pdf_reader.pages):
                if i >= self.max_pages:
                    break
                text += page.extract_text() + "\n\n"
                
        return text
    
    async def _extract_with_ocr(self, file_path: str) -> str:
        """OCR for scanned PDFs"""
        images = convert_from_path(file_path, dpi=300)
        text = ""
        
        for i, image in enumerate(images):
            if i >= self.max_pages:
                break
                
            # Perform OCR
            page_text = pytesseract.image_to_string(image, lang='eng')
            text += f"Page {i+1}:\n{page_text}\n\n"
            
        return text
    
    async def _extract_tables(self, file_path: str) -> List[Dict]:
        """Extract tables from PDF"""
        tables = []
        
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                if i >= self.max_pages:
                    break
                    
                page_tables = page.extract_tables()
                for table in page_tables:
                    if table:
                        tables.append({
                            "page": i + 1,
                            "data": table
                        })
                        
        return tables
    
    async def _extract_metadata(self, file_path: str) -> Dict:
        """Extract PDF metadata"""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            metadata = pdf_reader.metadata
            
            return {
                "title": metadata.get('/Title', ''),
                "author": metadata.get('/Author', ''),
                "subject": metadata.get('/Subject', ''),
                "creator": metadata.get('/Creator', ''),
                "creation_date": str(metadata.get('/CreationDate', '')),
                "pages": len(pdf_reader.pages)
            }
```

### Image Processing with OCR

**File: `backend/app/modules/processing/ocr/ocr_processor.py`**
```python
import cv2
import numpy as np
from PIL import Image
import pytesseract
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
import torch

class OCRProcessor:
    def __init__(self, use_trocr: bool = False):
        self.use_trocr = use_trocr
        
        if use_trocr:
            # Load TrOCR for better accuracy
            self.processor = TrOCRProcessor.from_pretrained(
                "microsoft/trocr-base-printed"
            )
            self.model = VisionEncoderDecoderModel.from_pretrained(
                "microsoft/trocr-base-printed"
            )
            
    async def process_image(self, image_path: str) -> Dict:
        """Extract text from image with preprocessing"""
        
        # Load and preprocess image
        image = cv2.imread(image_path)
        processed_image = await self._preprocess_image(image)
        
        # Extract text
        if self.use_trocr:
            text = await self._extract_with_trocr(processed_image)
        else:
            text = await self._extract_with_tesseract(processed_image)
            
        # Detect text regions
        regions = await self._detect_text_regions(image)
        
        return {
            "text": text,
            "regions": regions,
            "confidence": self._calculate_confidence(text)
        }
    
    async def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR"""
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply thresholding
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(thresh)
        
        # Deskew
        coords = np.column_stack(np.where(denoised > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = 90 + angle
            
        (h, w) = denoised.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        deskewed = cv2.warpAffine(
            denoised, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE
        )
        
        return deskewed
    
    async def _extract_with_tesseract(self, image: np.ndarray) -> str:
        """Extract text using Tesseract"""
        custom_config = r'--oem 3 --psm 6'
        text = pytesseract.image_to_string(image, config=custom_config)
        return text
    
    async def _extract_with_trocr(self, image: np.ndarray) -> str:
        """Extract text using TrOCR (more accurate)"""
        # Convert to PIL Image
        pil_image = Image.fromarray(image)
        
        # Process with TrOCR
        pixel_values = self.processor(
            images=pil_image, 
            return_tensors="pt"
        ).pixel_values
        
        generated_ids = self.model.generate(pixel_values)
        text = self.processor.batch_decode(
            generated_ids, 
            skip_special_tokens=True
        )[0]
        
        return text
    
    async def _detect_text_regions(self, image: np.ndarray) -> List[Dict]:
        """Detect text regions in image"""
        data = pytesseract.image_to_data(
            image, 
            output_type=pytesseract.Output.DICT
        )
        
        regions = []
        n_boxes = len(data['level'])
        
        for i in range(n_boxes):
            if int(data['conf'][i]) > 60:  # Confidence threshold
                (x, y, w, h) = (
                    data['left'][i], 
                    data['top'][i], 
                    data['width'][i], 
                    data['height'][i]
                )
                regions.append({
                    "bbox": [x, y, w, h],
                    "text": data['text'][i],
                    "confidence": data['conf'][i]
                })
                
        return regions
```

### Audio Transcription

**File: `backend/app/modules/processing/audio/transcription_processor.py`**
```python
import whisper
import torch
from pyannote.audio import Pipeline
import wave
import json
from typing import Dict, List

class TranscriptionProcessor:
    def __init__(self):
        # Load Whisper model
        self.whisper_model = whisper.load_model("base")
        
        # Load speaker diarization (if API key available)
        hf_token = os.getenv("HUGGINGFACE_TOKEN")
        if hf_token:
            self.diarization = Pipeline.from_pretrained(
                "pyannote/speaker-diarization@2.1",
                use_auth_token=hf_token
            )
        else:
            self.diarization = None
            
    async def process_audio(self, audio_path: str) -> Dict:
        """Transcribe audio with speaker diarization"""
        
        # Basic transcription
        result = self.whisper_model.transcribe(
            audio_path,
            language="en",
            task="transcribe"
        )
        
        # Get segments with timestamps
        segments = result["segments"]
        
        # Speaker diarization if available
        speakers = None
        if self.diarization:
            speakers = await self._diarize_speakers(audio_path)
            segments = await self._assign_speakers(segments, speakers)
            
        return {
            "text": result["text"],
            "segments": segments,
            "language": result.get("language", "en"),
            "duration": self._get_audio_duration(audio_path),
            "speakers": speakers
        }
    
    async def _diarize_speakers(self, audio_path: str) -> List[Dict]:
        """Identify different speakers"""
        diarization = self.diarization(audio_path)
        
        speakers = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speakers.append({
                "speaker": speaker,
                "start": turn.start,
                "end": turn.end
            })
            
        return speakers
    
    async def _assign_speakers(
        self, 
        segments: List[Dict], 
        speakers: List[Dict]
    ) -> List[Dict]:
        """Assign speakers to transcript segments"""
        
        for segment in segments:
            segment_start = segment["start"]
            segment_end = segment["end"]
            
            # Find overlapping speaker
            for speaker_info in speakers:
                if (speaker_info["start"] <= segment_start and 
                    speaker_info["end"] >= segment_end):
                    segment["speaker"] = speaker_info["speaker"]
                    break
                    
        return segments
    
    def _get_audio_duration(self, audio_path: str) -> float:
        """Get audio duration in seconds"""
        with wave.open(audio_path, 'rb') as audio_file:
            frames = audio_file.getnframes()
            rate = audio_file.getframerate()
            duration = frames / float(rate)
            return duration
```

## 3. PostHog Analytics Integration

**File: `src/modules/analytics/posthog/PostHogProvider.tsx`**
```typescript
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { useAuth } from '@/hooks/useAuth';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  useEffect(() => {
    // Initialize PostHog
    if (process.env.VITE_POSTHOG_KEY) {
      posthog.init(process.env.VITE_POSTHOG_KEY, {
        api_host: process.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: {
          dom_event_allowlist: ['click', 'submit', 'input']
        }
      });
    }
  }, []);
  
  useEffect(() => {
    // Identify user
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        plan: user.subscription?.plan
      });
    } else {
      posthog.reset();
    }
  }, [user]);
  
  return <>{children}</>;
}
```

**File: `src/modules/analytics/tracking/events.ts`**
```typescript
import posthog from 'posthog-js';

export class AnalyticsEvents {
  // Board events
  static boardCreated(boardId: string, nodeCount: number) {
    posthog.capture('board_created', {
      board_id: boardId,
      initial_nodes: nodeCount
    });
  }
  
  static boardOpened(boardId: string) {
    posthog.capture('board_opened', {
      board_id: boardId,
      timestamp: new Date().toISOString()
    });
  }
  
  // Node events
  static nodeAdded(nodeType: string, boardId: string) {
    posthog.capture('node_added', {
      node_type: nodeType,
      board_id: boardId
    });
  }
  
  static nodeConnected(sourceType: string, targetType: string) {
    posthog.capture('node_connected', {
      source_type: sourceType,
      target_type: targetType
    });
  }
  
  // AI Chat events
  static aiChatStarted(model: string, boardId: string) {
    posthog.capture('ai_chat_started', {
      model,
      board_id: boardId,
      has_context: true
    });
  }
  
  static aiChatMessage(tokens: number, responseTime: number) {
    posthog.capture('ai_chat_message', {
      tokens_used: tokens,
      response_time_ms: responseTime
    });
  }
  
  // Feature usage
  static featureUsed(feature: string, metadata?: any) {
    posthog.capture('feature_used', {
      feature,
      ...metadata
    });
  }
  
  // Performance metrics
  static performanceMetric(metric: string, value: number) {
    posthog.capture('performance_metric', {
      metric,
      value,
      timestamp: Date.now()
    });
  }
}

// Hook for easy event tracking
export function useAnalytics() {
  return {
    trackEvent: (event: string, properties?: any) => {
      posthog.capture(event, properties);
    },
    
    trackTiming: (category: string, variable: string, time: number) => {
      posthog.capture('timing', {
        category,
        variable,
        value: time
      });
    },
    
    setUserProperty: (key: string, value: any) => {
      posthog.people.set({ [key]: value });
    }
  };
}
```

**File: `src/modules/analytics/components/AnalyticsWrapper.tsx`**
```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalytics } from '../tracking/events';

export function AnalyticsWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { trackEvent } = useAnalytics();
  
  // Track page views
  useEffect(() => {
    trackEvent('page_view', {
      path: location.pathname,
      search: location.search
    });
  }, [location]);
  
  // Track performance metrics
  useEffect(() => {
    // First Contentful Paint
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          trackEvent('performance_fcp', {
            value: entry.startTime
          });
        }
      }
    });
    
    observer.observe({ entryTypes: ['paint'] });
    
    return () => observer.disconnect();
  }, []);
  
  return <>{children}</>;
}
```

## 4. Excalidraw Integration

**File: `src/modules/whiteboard/components/ExcalidrawBoard.tsx`**
```typescript
import { Excalidraw } from '@excalidraw/excalidraw';
import { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import { useCallback, useEffect, useRef } from 'react';
import { useYjs } from '@/modules/collaboration/providers/YjsProvider';

interface ExcalidrawBoardProps {
  boardId: string;
  onSave?: (elements: ExcalidrawElement[]) => void;
}

export function ExcalidrawBoard({ boardId, onSave }: ExcalidrawBoardProps) {
  const excalidrawRef = useRef<any>(null);
  const { doc } = useYjs();
  const yDrawings = doc.getMap('excalidraw');
  
  // Sync Excalidraw with Yjs
  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: any
  ) => {
    // Update Yjs
    doc.transact(() => {
      yDrawings.set('elements', elements);
      yDrawings.set('appState', appState);
    });
    
    // Save callback
    if (onSave) {
      onSave(elements as ExcalidrawElement[]);
    }
  }, [doc, yDrawings, onSave]);
  
  // Load from Yjs
  useEffect(() => {
    const loadDrawings = () => {
      const elements = yDrawings.get('elements');
      const appState = yDrawings.get('appState');
      
      if (elements && excalidrawRef.current) {
        excalidrawRef.current.updateScene({
          elements,
          appState
        });
      }
    };
    
    loadDrawings();
    yDrawings.observe(loadDrawings);
    
    return () => {
      yDrawings.unobserve(loadDrawings);
    };
  }, [yDrawings]);
  
  return (
    <div className="w-full h-full">
      <Excalidraw
        ref={excalidrawRef}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            export: true,
            loadScene: true,
            saveToActiveFile: false,
            toggleTheme: true
          }
        }}
        renderTopRightUI={(isMobile) => (
          <button
            onClick={() => {
              const elements = excalidrawRef.current?.getSceneElements();
              // Convert to image for board node
              exportToImage(elements);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Save to Board
          </button>
        )}
      />
    </div>
  );
}

async function exportToImage(elements: ExcalidrawElement[]) {
  const { exportToBlob } = await import('@excalidraw/excalidraw');
  
  const blob = await exportToBlob({
    elements,
    mimeType: 'image/png',
    appState: {
      exportBackground: true,
      exportWithDarkMode: false
    }
  });
  
  // Create image node on board
  const imageUrl = URL.createObjectURL(blob);
  // Add to board...
}
```

**File: `src/modules/whiteboard/components/WhiteboardMode.tsx`**
```typescript
import { useState } from 'react';
import { Pencil, Move } from 'lucide-react';
import { ExcalidrawBoard } from './ExcalidrawBoard';
import { BoardCanvas } from '@/components/BoardCanvas';

export function WhiteboardMode({ boardId }: { boardId: string }) {
  const [mode, setMode] = useState<'board' | 'whiteboard'>('board');
  
  return (
    <div className="relative w-full h-full">
      {/* Mode Toggle */}
      <div className="absolute top-4 left-4 z-50 bg-white rounded-lg shadow-lg p-1">
        <button
          onClick={() => setMode('board')}
          className={`p-2 rounded ${
            mode === 'board' ? 'bg-blue-500 text-white' : 'text-gray-600'
          }`}
          title="Board Mode"
        >
          <Move className="w-5 h-5" />
        </button>
        <button
          onClick={() => setMode('whiteboard')}
          className={`p-2 rounded ${
            mode === 'whiteboard' ? 'bg-blue-500 text-white' : 'text-gray-600'
          }`}
          title="Whiteboard Mode"
        >
          <Pencil className="w-5 h-5" />
        </button>
      </div>
      
      {/* Content */}
      {mode === 'board' ? (
        <BoardCanvas boardId={boardId} />
      ) : (
        <ExcalidrawBoard 
          boardId={boardId}
          onSave={(elements) => {
            // Save whiteboard as node
            console.log('Saving whiteboard:', elements);
          }}
        />
      )}
    </div>
  );
}
```

## 5. Performance Monitoring

**File: `backend/app/modules/monitoring/performance.py`**
```python
import time
from functools import wraps
import asyncio
from prometheus_client import Counter, Histogram, Gauge
import logging

# Metrics
request_count = Counter(
    'ragboard_requests_total', 
    'Total requests',
    ['method', 'endpoint', 'status']
)

request_duration = Histogram(
    'ragboard_request_duration_seconds',
    'Request duration',
    ['method', 'endpoint']
)

active_users = Gauge(
    'ragboard_active_users',
    'Number of active users'
)

websocket_connections = Gauge(
    'ragboard_websocket_connections',
    'Number of WebSocket connections'
)

def track_performance(endpoint: str):
    """Decorator to track endpoint performance"""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            status = 200
            
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                status = 500
                raise
            finally:
                duration = time.time() - start_time
                request_count.labels(
                    method=kwargs.get('request', {}).method,
                    endpoint=endpoint,
                    status=status
                ).inc()
                
                request_duration.labels(
                    method=kwargs.get('request', {}).method,
                    endpoint=endpoint
                ).observe(duration)
                
                # Log slow requests
                if duration > 1.0:
                    logging.warning(
                        f"Slow request: {endpoint} took {duration:.2f}s"
                    )
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Similar for sync functions
            pass
            
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator
```

## Testing

```typescript
// Frontend tests
describe('Analytics', () => {
  it('tracks events correctly', () => {
    const mockCapture = jest.fn();
    jest.spyOn(posthog, 'capture').mockImplementation(mockCapture);
    
    AnalyticsEvents.nodeAdded('text', 'board123');
    
    expect(mockCapture).toHaveBeenCalledWith('node_added', {
      node_type: 'text',
      board_id: 'board123'
    });
  });
});

// Backend tests
async def test_pdf_processing():
    processor = PDFProcessor()
    result = await processor.process_pdf("test.pdf")
    
    assert "text" in result
    assert result["page_count"] > 0
    assert len(result["text"]) > 0
```

## Deployment Considerations

1. **File Processing**: Use queue system (Celery/BullMQ) for async processing
2. **LangChain**: Monitor token usage and costs
3. **Analytics**: Ensure GDPR compliance with PostHog
4. **Performance**: Cache processed files and embeddings
5. **Security**: Scan uploaded files for malware

This completes the Phase 4 Enhancement implementation guide.