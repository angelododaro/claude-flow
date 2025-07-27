# CASL Frontend Authorization Integration Guide

## Overview
Implement CASL (Constructing Ability System Library) for granular, role-based access control in the ragboard frontend. This complements the existing FastAPI authentication.

## Installation

```bash
npm install @casl/ability @casl/react
```

## Implementation Steps

### 1. Define Abilities (src/auth/abilities.ts)

```typescript
import { defineAbility, PureAbility } from '@casl/ability';
import { User, Board, Resource } from '../types';

export type Actions = 'create' | 'read' | 'update' | 'delete' | 'share' | 'export';
export type Subjects = 'Board' | 'Resource' | 'Comment' | 'User' | 'all';

export type AppAbility = PureAbility<[Actions, Subjects]>;

export function defineAbilitiesFor(user: User | null): AppAbility {
  return defineAbility((can, cannot) => {
    if (!user) {
      // Anonymous users
      can('read', 'Board', { isPublic: true });
      return;
    }

    // Logged-in users
    can('create', 'Board');
    can('read', 'Board', { 
      $or: [
        { ownerId: user.id },
        { 'members.userId': user.id },
        { isPublic: true }
      ]
    });
    
    // Board owners
    can(['update', 'delete', 'share'], 'Board', { ownerId: user.id });
    
    // Board members
    can('create', 'Resource', { boardOwnerId: user.id });
    can(['read', 'update'], 'Resource', { createdBy: user.id });
    
    // Comments
    can('create', 'Comment');
    can(['update', 'delete'], 'Comment', { authorId: user.id });
    
    // Admin role
    if (user.role === 'admin') {
      can('manage', 'all');
    }
    
    // Premium features
    if (user.subscription?.plan === 'premium') {
      can('export', 'Board');
    } else {
      cannot('export', 'Board').because('Premium feature');
    }
  });
}
```

### 2. Create Ability Context (src/contexts/AbilityContext.tsx)

```typescript
import { createContext, useContext, ReactNode } from 'react';
import { createContextualCan } from '@casl/react';
import { AppAbility } from '../auth/abilities';

const AbilityContext = createContext<AppAbility>(undefined!);
export const Can = createContextualCan(AbilityContext.Consumer);

export function AbilityProvider({ 
  children, 
  ability 
}: { 
  children: ReactNode; 
  ability: AppAbility;
}) {
  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
}

export function useAbility() {
  const ability = useContext(AbilityContext);
  if (!ability) {
    throw new Error('useAbility must be used within AbilityProvider');
  }
  return ability;
}
```

### 3. Update Auth Context (src/contexts/AuthContext.tsx)

```typescript
import { defineAbilitiesFor } from '../auth/abilities';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ability, setAbility] = useState(() => defineAbilitiesFor(null));

  useEffect(() => {
    // Update abilities when user changes
    setAbility(defineAbilitiesFor(user));
  }, [user]);

  const value = {
    user,
    login,
    logout,
    ability, // Add ability to context
  };

  return (
    <AuthContext.Provider value={value}>
      <AbilityProvider ability={ability}>
        {children}
      </AbilityProvider>
    </AuthContext.Provider>
  );
}
```

### 4. Protect UI Components (src/components/BoardCanvas.tsx)

```typescript
import { Can, useAbility } from '../contexts/AbilityContext';

export function BoardCanvas({ board }: { board: Board }) {
  const ability = useAbility();
  
  const handleNodeAdd = () => {
    if (!ability.can('create', 'Resource', { boardOwnerId: board.ownerId })) {
      toast.error('You do not have permission to add resources');
      return;
    }
    // Add node logic
  };

  return (
    <div className="board-canvas">
      <Can I="update" this={board}>
        <button onClick={handleNodeAdd}>Add Node</button>
      </Can>
      
      <Can I="share" this={board}>
        <ShareButton board={board} />
      </Can>
      
      <Can I="export" a="Board">
        <ExportButton board={board} />
      </Can>
      
      <Can not I="export" a="Board">
        {({ reason }) => (
          <button disabled title={reason}>
            Export (Premium)
          </button>
        )}
      </Can>
    </div>
  );
}
```

### 5. Resource-Level Permissions (src/components/ResourceNode.tsx)

```typescript
export function ResourceNode({ resource }: { resource: Resource }) {
  const ability = useAbility();
  const [isEditing, setIsEditing] = useState(false);

  const canEdit = ability.can('update', resource);
  const canDelete = ability.can('delete', resource);

  return (
    <div className="resource-node">
      <div className="resource-content">
        {resource.content}
      </div>
      
      {canEdit && (
        <button onClick={() => setIsEditing(true)}>
          Edit
        </button>
      )}
      
      {canDelete && (
        <button onClick={handleDelete}>
          Delete
        </button>
      )}
    </div>
  );
}
```

### 6. Hook for Permission Checks (src/hooks/usePermissions.ts)

```typescript
import { useAbility } from '../contexts/AbilityContext';
import { useCallback } from 'react';

export function usePermissions() {
  const ability = useAbility();

  const checkPermission = useCallback((
    action: Actions,
    subject: Subjects | any,
    field?: string
  ) => {
    return ability.can(action, subject, field);
  }, [ability]);

  const assertPermission = useCallback((
    action: Actions,
    subject: Subjects | any,
    field?: string
  ) => {
    if (!ability.can(action, subject, field)) {
      const rule = ability.relevantRuleFor(action, subject, field);
      throw new Error(rule?.reason || `Cannot ${action} ${subject}`);
    }
  }, [ability]);

  return {
    can: checkPermission,
    cannot: (action: Actions, subject: Subjects | any) => !checkPermission(action, subject),
    assert: assertPermission,
  };
}
```

### 7. API Integration (src/services/api.ts)

```typescript
// Sync abilities with backend permissions
export async function fetchUserPermissions(): Promise<Permissions> {
  const response = await api.get('/users/me/permissions');
  return response.data;
}

// Update ability definitions based on backend
export function defineAbilitiesFromBackend(permissions: Permissions): AppAbility {
  return defineAbility((can, cannot) => {
    permissions.rules.forEach(rule => {
      if (rule.inverted) {
        cannot(rule.action, rule.subject, rule.conditions);
      } else {
        can(rule.action, rule.subject, rule.conditions);
      }
    });
  });
}
```

### 8. Board List with Permissions (src/components/BoardList.tsx)

```typescript
export function BoardList() {
  const { boards } = useBoardStore();
  const ability = useAbility();

  const visibleBoards = boards.filter(board => 
    ability.can('read', board)
  );

  return (
    <div className="board-list">
      <Can I="create" a="Board">
        <button>Create New Board</button>
      </Can>
      
      {visibleBoards.map(board => (
        <BoardCard key={board.id} board={board}>
          <Can I="update" this={board}>
            <EditButton />
          </Can>
          <Can I="delete" this={board}>
            <DeleteButton />
          </Can>
        </BoardCard>
      ))}
    </div>
  );
}
```

## Testing Permissions

```typescript
// src/auth/__tests__/abilities.test.ts
import { defineAbilitiesFor } from '../abilities';

describe('Board Permissions', () => {
  it('allows owner to manage their board', () => {
    const user = { id: '1', role: 'user' };
    const board = { id: 'b1', ownerId: '1' };
    
    const ability = defineAbilitiesFor(user);
    
    expect(ability.can('update', board)).toBe(true);
    expect(ability.can('delete', board)).toBe(true);
    expect(ability.can('share', board)).toBe(true);
  });
  
  it('prevents non-owner from deleting board', () => {
    const user = { id: '2', role: 'user' };
    const board = { id: 'b1', ownerId: '1' };
    
    const ability = defineAbilitiesFor(user);
    
    expect(ability.can('delete', board)).toBe(false);
  });
});
```

## Performance Optimization

1. **Memoize Abilities**: Cache ability checks for static subjects
2. **Lazy Evaluation**: Only check permissions when needed
3. **Batch Checks**: Group permission checks in lists

```typescript
const memoizedCan = useMemo(() => 
  ability.can('update', board), 
  [ability, board.id, board.ownerId]
);
```

## Security Best Practices

1. **Server Validation**: Always validate permissions on backend
2. **Fail Closed**: Default to no permission
3. **Audit Trail**: Log permission checks for sensitive actions
4. **Regular Review**: Audit ability definitions regularly

## Migration Strategy

1. Start with read-only enforcement
2. Add create/update restrictions
3. Implement delete permissions
4. Enable advanced features (sharing, export)