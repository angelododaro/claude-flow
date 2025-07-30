# Phase 1: Authorization System Implementation Guide

## Overview
This guide details the implementation of CASL-based authorization for RAGBOARD, ensuring secure access control across all components and API endpoints.

## Architecture

### Permission Model
```typescript
// User Roles
enum Role {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  GUEST = 'guest'
}

// Resource Types
enum Resource {
  BOARD = 'Board',
  NODE = 'Node',
  CHAT = 'Chat',
  COMMENT = 'Comment',
  USER = 'User'
}

// Actions
enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  SHARE = 'share',
  EXPORT = 'export'
}
```

## Implementation Steps

### 1. CASL Ability Configuration

**File: `src/modules/authorization/abilities/defineAbilities.ts`**
```typescript
import { defineAbility, AbilityBuilder } from '@casl/ability';

export function defineAbilitiesFor(user: User) {
  const { can, cannot, build } = new AbilityBuilder(Ability);

  switch (user.role) {
    case Role.ADMIN:
      can('manage', 'all'); // Full access
      break;
      
    case Role.EDITOR:
      can('read', 'Board');
      can('create', 'Node');
      can('update', 'Node', { createdBy: user.id });
      can('delete', 'Node', { createdBy: user.id });
      can('create', 'Comment');
      can('update', 'Comment', { authorId: user.id });
      cannot('delete', 'Board');
      break;
      
    case Role.VIEWER:
      can('read', ['Board', 'Node', 'Comment']);
      can('create', 'Comment');
      cannot('update', 'Node');
      cannot('delete', 'all');
      break;
      
    case Role.GUEST:
      can('read', 'Board', { isPublic: true });
      cannot('create', 'all');
      break;
  }

  // Shared board permissions
  can('read', 'Board', { 
    sharedWith: { $in: [user.id] } 
  });

  return build();
}
```

### 2. React Integration

**File: `src/modules/authorization/components/AbilityProvider.tsx`**
```typescript
import { createContext, useContext } from 'react';
import { createContextualCan } from '@casl/react';
import { Ability } from '@casl/ability';

const AbilityContext = createContext<Ability>(new Ability());
export const Can = createContextualCan(AbilityContext.Consumer);

export function AbilityProvider({ children, ability }) {
  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
}

export const useAbility = () => {
  const ability = useContext(AbilityContext);
  if (!ability) {
    throw new Error('useAbility must be used within AbilityProvider');
  }
  return ability;
};
```

### 3. Component Protection

**File: `src/modules/authorization/components/PermissionGate.tsx`**
```typescript
import { Can } from './AbilityProvider';
import { ReactNode } from 'react';

interface PermissionGateProps {
  action: string;
  subject: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ 
  action, 
  subject, 
  children, 
  fallback = null 
}: PermissionGateProps) {
  return (
    <Can I={action} a={subject}>
      {(allowed) => (allowed ? children : fallback)}
    </Can>
  );
}
```

### 4. Hook Implementation

**File: `src/modules/authorization/hooks/usePermission.ts`**
```typescript
import { useAbility } from '../components/AbilityProvider';
import { useCallback } from 'react';

export function usePermission() {
  const ability = useAbility();

  const can = useCallback((action: string, subject: any) => {
    return ability.can(action, subject);
  }, [ability]);

  const cannot = useCallback((action: string, subject: any) => {
    return ability.cannot(action, subject);
  }, [ability]);

  return { can, cannot, ability };
}
```

### 5. Component Updates

**Update existing components with permission checks:**

```typescript
// Example: BoardCanvas.tsx
import { PermissionGate } from '@/modules/authorization/components/PermissionGate';
import { usePermission } from '@/modules/authorization/hooks/usePermission';

export function BoardCanvas() {
  const { can } = usePermission();
  
  const handleNodeCreate = () => {
    if (!can('create', 'Node')) {
      showToast('You do not have permission to create nodes');
      return;
    }
    // Create node logic
  };

  return (
    <div>
      <PermissionGate action="read" subject="Board">
        {/* Board content */}
      </PermissionGate>
      
      <PermissionGate 
        action="create" 
        subject="Node"
        fallback={<LockedFeatureMessage />}
      >
        <AddNodeButton onClick={handleNodeCreate} />
      </PermissionGate>
    </div>
  );
}
```

### 6. Backend Implementation

**File: `backend/app/modules/auth/permissions.py`**
```python
from enum import Enum
from typing import Dict, List
from casl import Ability, RulesBuilder

class Role(Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    GUEST = "guest"

class Action(Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    SHARE = "share"
    EXPORT = "export"

def define_abilities_for(user: User) -> Ability:
    builder = RulesBuilder()
    
    if user.role == Role.ADMIN:
        builder.can("manage", "all")
    
    elif user.role == Role.EDITOR:
        builder.can("read", "Board")
        builder.can("create", "Node")
        builder.can("update", "Node", {"created_by": user.id})
        builder.can("delete", "Node", {"created_by": user.id})
        builder.cannot("delete", "Board")
    
    elif user.role == Role.VIEWER:
        builder.can("read", ["Board", "Node", "Comment"])
        builder.can("create", "Comment")
        builder.cannot("update", "Node")
    
    elif user.role == Role.GUEST:
        builder.can("read", "Board", {"is_public": True})
        builder.cannot("create", "all")
    
    # Shared boards
    builder.can("read", "Board", {
        "shared_with": {"$in": [user.id]}
    })
    
    return builder.build()
```

**File: `backend/app/modules/auth/middleware.py`**
```python
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def check_permission(
    action: str,
    resource: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    user = await get_current_user(credentials.credentials)
    ability = define_abilities_for(user)
    
    if not ability.can(action, resource):
        raise HTTPException(
            status_code=403,
            detail=f"You don't have permission to {action} {resource}"
        )
    
    return user

# Dependency injection for endpoints
def require_permission(action: str, resource: str):
    async def permission_checker(
        user = Depends(lambda: check_permission(action, resource))
    ):
        return user
    return permission_checker
```

### 7. API Endpoint Protection

```python
# Example: boards.py
from fastapi import APIRouter, Depends
from ..modules.auth.middleware import require_permission

router = APIRouter()

@router.post("/boards")
async def create_board(
    board: BoardCreate,
    user = Depends(require_permission("create", "Board"))
):
    # Create board logic
    pass

@router.put("/boards/{board_id}")
async def update_board(
    board_id: str,
    updates: BoardUpdate,
    user = Depends(require_permission("update", "Board"))
):
    # Additional ownership check
    board = await get_board(board_id)
    ability = define_abilities_for(user)
    
    if not ability.can("update", "Board", board):
        raise HTTPException(403, "Cannot update this board")
    
    # Update logic
    pass
```

## Testing Strategy

### Unit Tests
```typescript
// abilities.test.ts
describe('Authorization Abilities', () => {
  it('admin can manage all resources', () => {
    const admin = { id: '1', role: Role.ADMIN };
    const ability = defineAbilitiesFor(admin);
    
    expect(ability.can('manage', 'all')).toBe(true);
  });
  
  it('editor cannot delete boards', () => {
    const editor = { id: '2', role: Role.EDITOR };
    const ability = defineAbilitiesFor(editor);
    
    expect(ability.cannot('delete', 'Board')).toBe(true);
  });
});
```

### Integration Tests
```python
# test_authorization.py
async def test_unauthorized_board_creation():
    viewer_token = create_token(role="viewer")
    response = await client.post(
        "/boards",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={"name": "Test Board"}
    )
    assert response.status_code == 403
```

## Migration Strategy

1. **Phase 1**: Add abilities without enforcement
2. **Phase 2**: Add permission checks with logging
3. **Phase 3**: Enable enforcement with feature flag
4. **Phase 4**: Remove feature flag, full enforcement

## Security Considerations

1. **Token Validation**: Verify JWT signatures
2. **Role Changes**: Invalidate sessions on role change
3. **Resource Ownership**: Always verify ownership
4. **Audit Logging**: Log all permission checks
5. **Rate Limiting**: Prevent permission probing

## Performance Optimization

1. **Ability Caching**: Cache ability rules per user
2. **Batch Checks**: Check multiple permissions at once
3. **Database Queries**: Optimize ownership queries
4. **Frontend Caching**: Cache abilities in session storage

## Monitoring

1. **Permission Denials**: Track 403 responses
2. **Role Distribution**: Monitor active user roles
3. **Performance**: Track permission check latency
4. **Errors**: Alert on authorization failures

## Rollback Plan

If issues arise:
1. Disable enforcement via feature flag
2. Revert to previous authorization logic
3. Fix issues in staging environment
4. Re-deploy with fixes

This completes the Phase 1 authorization implementation guide.