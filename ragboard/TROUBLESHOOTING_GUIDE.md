# Troubleshooting Guide for RAGBOARD Open-Source Integrations

## Common Issues and Solutions

### 1. Yjs Real-time Collaboration Issues

#### Problem: Changes not syncing between users
**Symptoms:**
- Users don't see each other's changes
- Cursor positions not updating
- "Connection lost" messages

**Solutions:**
```bash
# 1. Check WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:1234/yjs

# 2. Verify Yjs server is running
docker ps | grep yjs-server

# 3. Check browser console for WebSocket errors
# Look for: WebSocket connection to 'ws://...' failed
```

**Fix:**
```typescript
// Ensure correct WebSocket URL
const provider = new WebsocketProvider(
  process.env.VITE_YJS_WS_URL || 'ws://localhost:1234',
  `board-${boardId}`,
  ydoc,
  {
    connect: true,
    params: { 
      auth: token // Add authentication if required
    },
    // Add reconnection logic
    maxBackoffTime: 10000,
    resyncInterval: 5000,
  }
);

// Add connection status handling
provider.on('status', ({ status }) => {
  console.log('Connection status:', status);
  if (status === 'disconnected') {
    // Show reconnection UI
  }
});
```

#### Problem: High memory usage with large documents
**Solution:**
```typescript
// Implement document cleanup
setInterval(() => {
  ydoc.gc = true; // Enable garbage collection
  Y.cleanupYTextFormatting(ydoc.getText('content'));
}, 60000); // Every minute

// Limit history size
const undoManager = new Y.UndoManager(yText, {
  maxStackSize: 50, // Limit undo stack
});
```

### 2. Export Functionality Problems

#### Problem: Export fails with "Canvas tainted" error
**Symptoms:**
- Export throws SecurityError
- Images not included in export

**Solution:**
```typescript
// 1. Ensure CORS headers for images
app.use('/uploads', cors({
  origin: true,
  credentials: true,
}));

// 2. Use crossOrigin attribute
<img src={imageUrl} crossOrigin="anonymous" />

// 3. Proxy external images
const proxyImage = async (url: string) => {
  const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
```

#### Problem: Large board export crashes browser
**Solution:**
```typescript
// Implement chunked export for large boards
async function exportLargeBoard(element: HTMLElement, options: ExportOptions) {
  const chunks = [];
  const chunkSize = 1000; // pixels
  
  for (let y = 0; y < element.scrollHeight; y += chunkSize) {
    const canvas = await html2canvas(element, {
      x: 0,
      y: y,
      width: element.scrollWidth,
      height: Math.min(chunkSize, element.scrollHeight - y),
      windowHeight: element.scrollHeight,
    });
    chunks.push(canvas);
  }
  
  // Combine chunks
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = element.scrollWidth;
  finalCanvas.height = element.scrollHeight;
  const ctx = finalCanvas.getContext('2d');
  
  chunks.forEach((chunk, index) => {
    ctx.drawImage(chunk, 0, index * chunkSize);
  });
  
  return finalCanvas;
}
```

### 3. Voice Recording Issues

#### Problem: Microphone permission denied
**Solution:**
```typescript
// Better error handling and user guidance
async function requestMicrophoneAccess() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      // Show instructions to enable microphone
      showMicrophoneInstructions();
    } else if (error.name === 'NotFoundError') {
      alert('No microphone found. Please connect a microphone.');
    } else if (error.name === 'NotReadableError') {
      alert('Microphone is being used by another application.');
    }
    throw error;
  }
}

// Browser-specific instructions
function showMicrophoneInstructions() {
  const isChrome = /Chrome/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  
  if (isChrome) {
    alert('Click the camera icon in the address bar and allow microphone access.');
  } else if (isFirefox) {
    alert('Click the microphone icon in the address bar and select "Allow".');
  }
}
```

#### Problem: Recording produces no sound
**Solution:**
```typescript
// Test audio levels before recording
async function testAudioInput(stream: MediaStream) {
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  const microphone = audioContext.createMediaStreamSource(stream);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  microphone.connect(analyser);
  
  const checkLevel = () => {
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    
    if (average < 10) {
      console.warn('Low audio input detected');
      // Show volume adjustment UI
    }
  };
  
  setInterval(checkLevel, 100);
}
```

### 4. Video.js Player Issues

#### Problem: Video not playing on mobile
**Solution:**
```typescript
// Mobile-specific configuration
const mobileOptions = {
  controls: true,
  playsinline: true, // Prevent fullscreen on iOS
  muted: true, // Allow autoplay on mobile
  preload: 'metadata', // Don't preload full video
  fluid: true, // Responsive sizing
  touchControls: {
    seekSeconds: 10,
    tapTolerance: 10,
  },
};

// Detect mobile and apply settings
if (/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)) {
  Object.assign(playerOptions, mobileOptions);
}
```

#### Problem: CORS errors with video streams
**Solution:**
```nginx
# Nginx configuration for video streaming
location /videos {
  add_header Access-Control-Allow-Origin *;
  add_header Access-Control-Allow-Methods 'GET, OPTIONS';
  add_header Access-Control-Allow-Headers 'Range';
  add_header Access-Control-Expose-Headers 'Content-Length, Content-Range';
  
  # Enable byte-range requests
  add_header Accept-Ranges bytes;
  
  # Optimize for video streaming
  sendfile on;
  tcp_nopush on;
  aio on;
}
```

### 5. CASL Authorization Issues

#### Problem: Permissions not updating after role change
**Solution:**
```typescript
// Force ability update
export function useAbilityRefresh() {
  const { user, refreshUser } = useAuth();
  const [ability, setAbility] = useState(() => defineAbilitiesFor(user));
  
  const refreshAbilities = async () => {
    // Fetch fresh user data
    const freshUser = await refreshUser();
    
    // Create new ability instance
    const newAbility = defineAbilitiesFor(freshUser);
    setAbility(newAbility);
    
    // Clear any cached permission checks
    ability.update(newAbility.rules);
  };
  
  return { ability, refreshAbilities };
}
```

### 6. PostHog Analytics Issues

#### Problem: Events not being tracked
**Solution:**
```typescript
// Debug PostHog initialization
posthog.debug(); // Enable debug mode

// Verify events are being sent
posthog.on('eventCaptured', (event) => {
  console.log('Event captured:', event);
});

// Check for blockers
if (navigator.doNotTrack === '1') {
  console.warn('Do Not Track is enabled');
}

// Ensure PostHog is loaded
if (typeof posthog === 'undefined') {
  console.error('PostHog not loaded - check script blocking');
}
```

### 7. LangChain Integration Issues

#### Problem: High API costs with LangChain
**Solution:**
```python
# Implement caching layer
from functools import lru_cache
from hashlib import md5

class CachedLangChainService(LangChainService):
    def __init__(self):
        super().__init__()
        self.cache = {}
    
    @lru_cache(maxsize=1000)
    def get_cached_response(self, prompt_hash: str):
        return self.cache.get(prompt_hash)
    
    async def process_with_cache(self, prompt: str):
        # Create hash of prompt
        prompt_hash = md5(prompt.encode()).hexdigest()
        
        # Check cache
        cached = self.get_cached_response(prompt_hash)
        if cached:
            return cached
        
        # Process normally
        response = await self.process(prompt)
        
        # Cache response
        self.cache[prompt_hash] = response
        return response
```

### 8. Performance Issues

#### Problem: Slow initial page load
**Solution:**
```typescript
// 1. Implement code splitting
const ExcalidrawCanvas = lazy(() => import('./components/ExcalidrawCanvas'));
const VideoPlayer = lazy(() => import('./components/VideoPlayer'));

// 2. Optimize bundle size
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-flow': ['@xyflow/react'],
          'vendor-editor': ['@tiptap/react', '@tiptap/starter-kit'],
          'vendor-media': ['video.js', 'recordrtc'],
        },
      },
    },
  },
});

// 3. Preload critical resources
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin />
<link rel="preconnect" href="https://api.example.com" />
```

### 9. Docker/Deployment Issues

#### Problem: Container fails to start
**Debug steps:**
```bash
# Check logs
docker logs ragboard-backend

# Verify environment variables
docker exec ragboard-backend env

# Test database connection
docker exec ragboard-backend python -c "
from app.db.session import SessionLocal
db = SessionLocal()
db.execute('SELECT 1')
print('Database connected')
"

# Check port bindings
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

### 10. Memory Leaks

#### Problem: Browser memory usage grows over time
**Solution:**
```typescript
// Cleanup on unmount
useEffect(() => {
  const player = videojs(videoRef.current);
  const provider = new WebsocketProvider(...);
  const recorder = new RecordRTC(...);
  
  return () => {
    // Cleanup video player
    player.dispose();
    
    // Cleanup WebSocket
    provider.disconnect();
    provider.destroy();
    
    // Cleanup recorder
    recorder.destroy();
    
    // Cleanup blob URLs
    URL.revokeObjectURL(blobUrl);
    
    // Clear event listeners
    window.removeEventListener('resize', handleResize);
    
    // Clear intervals/timeouts
    clearInterval(intervalId);
  };
}, []);

// Monitor memory usage
if (performance.memory) {
  setInterval(() => {
    const memoryInfo = {
      usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
      totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2),
    };
    console.log('Memory usage (MB):', memoryInfo);
    
    // Alert if memory usage is high
    if (performance.memory.usedJSHeapSize > 500 * 1048576) {
      console.warn('High memory usage detected');
    }
  }, 30000);
}
```

## Debug Utilities

### Browser Console Commands
```javascript
// Check Yjs document state
window.ydoc = ydoc;
console.log('Yjs state:', ydoc.toJSON());

// Check PostHog queue
console.log('PostHog queue:', posthog.getFeatureFlags());

// Test export without UI
window.testExport = async () => {
  const element = document.querySelector('.react-flow');
  const canvas = await html2canvas(element);
  canvas.toBlob(blob => saveAs(blob, 'test.png'));
};

// Force garbage collection (if enabled in Chrome)
if (window.gc) window.gc();
```

### Backend Debug Endpoints
```python
# Add debug endpoints (development only)
if settings.DEBUG:
    @router.get("/debug/health-detailed")
    async def debug_health():
        return {
            "database": await check_database(),
            "redis": await check_redis(),
            "storage": await check_storage(),
            "memory": get_memory_usage(),
            "active_connections": get_active_connections(),
        }
    
    @router.post("/debug/clear-cache")
    async def clear_cache():
        await redis_client.flushdb()
        return {"status": "cache cleared"}
```

## Performance Profiling

### Frontend Profiling
```typescript
// React DevTools Profiler API
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number,
  interactions: Set<any>
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}

<Profiler id="Board" onRender={onRenderCallback}>
  <BoardCanvas />
</Profiler>
```

### Backend Profiling
```python
# Use Python profiler
import cProfile
import pstats

def profile_endpoint():
    profiler = cProfile.Profile()
    profiler.enable()
    
    # Run your code
    result = expensive_operation()
    
    profiler.disable()
    stats = pstats.Stats(profiler)
    stats.sort_stats('cumulative')
    stats.print_stats(10)  # Top 10 functions
    
    return result
```

## Logging Best Practices

### Structured Logging
```typescript
// Frontend logging utility
class Logger {
  private context: Record<string, any> = {};
  
  setContext(context: Record<string, any>) {
    this.context = { ...this.context, ...context };
  }
  
  log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data,
    };
    
    console[level](JSON.stringify(logEntry));
    
    // Send to backend for critical errors
    if (level === 'error') {
      fetch('/api/logs', {
        method: 'POST',
        body: JSON.stringify(logEntry),
      });
    }
  }
}

export const logger = new Logger();
```

Remember: When troubleshooting, always check the browser console, network tab, and server logs first. Most issues can be diagnosed with these tools.