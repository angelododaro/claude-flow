# RAGBOARD Modular Fix Implementation Plan

## Overview
This plan addresses the critical issues preventing RAGBOARD from functioning, organized into modular fixes that can be tested independently.

## Phase 1: Critical TypeScript Fixes (Compilation Blockers)

### Fix 1.1: Resource Type Definition
**File**: `/src/types/index.ts`
**Line**: 22
**Change**:
```typescript
// FROM:
type: 'video | image | text | pdf | url | audio | document | folder | link | frame | annotation | meta-ad | trending-content | shape';

// TO:
type: 'video' | 'image' | 'text' | 'pdf' | 'url' | 'audio' | 'document' | 'folder' | 'link' | 'frame' | 'annotation' | 'meta-ad' | 'trending-content' | 'shape';
```
**Test**: Run `npm run build` - should pass TypeScript compilation

### Fix 1.2: Add Missing Import
**File**: `/src/types/index.ts`
**Line**: Add after line 6
**Change**:
```typescript
import type { 
  Node as ReactFlowNode,
  Edge as ReactFlowEdge,
  Connection as ReactFlowConnection,
  EdgeProps as ReactFlowEdgeProps  // ADD THIS
} from '@xyflow/react';
```
**Test**: TypeScript should recognize ReactFlowEdgeProps type

## Phase 2: Backend Connectivity

### Fix 2.1: Start Backend Server
**Action**: Run backend server
```bash
cd /workspaces/claude-flow/ragboard/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
**Test**: `curl http://localhost:8000/api/v1/health` should return 200 OK

### Fix 2.2: Verify Database Services
**Action**: Ensure PostgreSQL and Redis are running if required
**Test**: Backend logs should show successful database connections

## Phase 3: Authentication Token Standardization

### Fix 3.1: Standardize Token Usage
**Decision**: Use `access_token` everywhere (OAuth2 standard)
**Files to update**:
1. `/src/services/api.ts` - Change `auth_token` to `access_token`
2. `/src/services/websocket.ts` - Change `auth_token` to `access_token`
3. `/src/services/auth.ts` - Ensure consistent token key

**Test**: Login flow should work and persist token correctly

## Phase 4: Component Interface Fixes

### Fix 4.1: VoiceNoteNode Interface
**File**: `/src/types/index.ts`
**Add interface**:
```typescript
export interface VoiceNoteData {
  id: string;
  audioUrl: string;
  duration: number;
  createdAt: Date;
  title: string;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: any) => void;
}
```

### Fix 4.2: Consistent Node Properties
**Action**: Ensure all node components use consistent prop names
**Test**: All node types should render without errors

## Phase 5: Error Handling & Stability

### Fix 5.1: Add Error Boundary
**File**: Create `/src/components/BoardErrorBoundary.tsx`
**Wrap**: BoardCanvas component
**Test**: Component errors should be caught and displayed gracefully

### Fix 5.2: WebSocket Error Handling
**File**: `/src/services/websocket.ts`
**Add**: Proper error handling and retry logic
**Test**: Should handle connection failures gracefully

## Phase 6: Memory Leak Fixes

### Fix 6.1: Audio URL Cleanup
**File**: `/src/components/VoiceNoteNode.tsx`
**Add**: useEffect cleanup to revoke object URLs
**Test**: Memory profiler should show no leaked URLs

### Fix 6.2: WebSocket Listener Cleanup
**File**: `/src/components/BoardCanvas.tsx`
**Ensure**: All listeners removed in cleanup function
**Test**: Component unmount should remove all listeners

## Phase 7: Performance Optimization

### Fix 7.1: Memoize Node Creation
**File**: `/src/components/BoardCanvas.tsx`
**Use**: React.useMemo for node transformation
**Test**: React DevTools should show fewer re-renders

### Fix 7.2: Optimize State Updates
**File**: `/src/store/boardStore.ts`
**Consider**: Using Immer or normalizing state
**Test**: State updates should trigger proper re-renders

## Testing Strategy

### After Each Phase:
1. **Unit Test**: Test the specific component/function changed
2. **Integration Test**: Test interaction with related components
3. **Regression Test**: Ensure no existing functionality breaks

### Test Checklist:
- [ ] Frontend compiles without errors
- [ ] Backend health check passes
- [ ] User can log in and persist session
- [ ] Nodes can be created and rendered
- [ ] Nodes can be dragged and updated
- [ ] WebSocket connection establishes
- [ ] Real-time collaboration works
- [ ] No console errors in browser
- [ ] No memory leaks detected

## Implementation Order

1. **Day 1**: Phase 1 & 2 (Get app running)
2. **Day 2**: Phase 3 & 4 (Fix core functionality)
3. **Day 3**: Phase 5 & 6 (Stability and cleanup)
4. **Day 4**: Phase 7 (Performance)
5. **Day 5**: Full integration testing

## Success Criteria

- Application loads without errors
- All node types render correctly
- Drag and drop functionality works
- Real-time collaboration functions
- No TypeScript errors
- No runtime errors in console
- Performance is acceptable (< 100ms interaction delay)

## Rollback Plan

- Git commit after each successful phase
- Tag working versions
- Keep backend/frontend logs for debugging
- Document any deviations from plan