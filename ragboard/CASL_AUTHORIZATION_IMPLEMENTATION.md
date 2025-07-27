# CASL Authorization Implementation

## ✅ What Was Implemented

### 1. Core CASL Setup
- **Dependencies**: Installed `@casl/ability` and `@casl/react`
- **Ability Definition**: Created comprehensive permission rules in `src/auth/abilities.ts`
- **React Context**: Set up `AbilityProvider` and custom hooks in `src/contexts/AbilityContext.tsx`
- **Permission Hook**: Created `usePermissions` hook for easy permission checks

### 2. Permission Structure

#### Roles Defined:
- **ADMIN**: Full access to everything
- **OWNER**: Full control over owned boards and resources
- **COLLABORATOR**: Can create/edit resources, comment, export
- **VIEWER**: Read-only access, can export public boards
- **GUEST**: Minimal access, only public content

#### Actions Supported:
- `manage` - Full CRUD operations
- `create`, `read`, `update`, `delete` - Standard CRUD
- `share` - Share boards with others
- `export` - Export board content
- `comment` - Add comments to resources
- `invite` - Invite users to boards

#### Subjects:
- **Board** - Main canvas/workspace
- **Resource** - Individual items on boards
- **Comment** - Comments on resources
- **User** - User profiles

### 3. Component Integration

#### Updated Components:
1. **BoardCanvas**: 
   - Added permission context
   - Export button only shows if user can export
   - Wrapped with Can component

2. **SidebarMenu**:
   - Disabled resource creation for users without permission
   - Shows tooltip explaining permission requirements

3. **App.tsx**:
   - Added AuthProvider and AbilityProvider wrappers

### 4. Helper Components & Hooks

#### Created Components:
- **PermissionGate**: Wrapper component for conditional rendering
- **Can**: Re-exported from CASL for permission checks
- **CanDo**: Custom component with fallback support

#### Custom Hooks:
- `useAbility()` - Access ability instance
- `usePermissions()` - High-level permission helpers
- `useCanCreate()`, `useCanRead()`, etc. - Specific action hooks

## 📋 Implementation Examples

### Basic Permission Check:
```tsx
import { Can } from '../contexts/AbilityContext';

// Only show export button if user can export
<Can I="export" a="Board">
  <ExportButton onClick={handleExport} />
</Can>
```

### Using Permission Hook:
```tsx
const { canCreateResource, canDeleteResource } = usePermissions();

if (canCreateResource(boardId)) {
  // Allow resource creation
}
```

### Disabling UI Elements:
```tsx
<button
  onClick={handleCreate}
  disabled={!ability.can('create', 'Resource')}
>
  Add Resource
</button>
```

### Permission Gate with Fallback:
```tsx
<CanDo I="update" a={resource} fallback={<ReadOnlyView />}>
  <EditableView />
</CanDo>
```

## 🔧 Configuration

### Role Assignment:
```typescript
// Example user object
const user = {
  id: '123',
  email: 'user@example.com',
  name: 'John Doe',
  role: 'collaborator',
  ownedBoardIds: ['board-1', 'board-2'],
  collaboratorBoardIds: ['board-3', 'board-4'],
  viewerBoardIds: ['board-5']
};
```

### Ability Rules Example:
```typescript
// Owner can manage their boards
can('manage', 'Board', { ownerId: user.id });

// Collaborators can create resources
can('create', 'Resource', { boardId: { $in: user.collaboratorBoardIds } });

// Everyone can update their own resources
can('update', 'Resource', { userId: user.id });
```

## 🚀 Next Steps

### Frontend:
1. Add permission checks to remaining components:
   - ResourceNode (delete button)
   - FolderNode (create/delete)
   - CommentForm (comment permissions)
   - ShareTool (share permissions)

2. Implement role selector in user profile
3. Add permission denied toast notifications
4. Create admin panel for role management

### Backend Integration:
1. Add CASL rules to FastAPI endpoints
2. Implement role-based middleware
3. Add board ownership tracking
4. Create invitation system

### Testing:
1. Unit tests for ability definitions
2. Component tests with different roles
3. E2E tests for permission flows
4. Security audit for bypasses

## 🎯 Benefits

1. **Security**: Granular control over who can do what
2. **UX**: Clear feedback when actions aren't allowed
3. **Flexibility**: Easy to add new roles or permissions
4. **Type Safety**: Full TypeScript support
5. **Performance**: Permissions cached and computed efficiently

## 📚 Resources

- [CASL Documentation](https://casl.js.org/)
- [CASL React Integration](https://casl.js.org/v6/en/package/casl-react)
- [MongoDB Query Language](https://casl.js.org/v6/en/guide/conditions-in-depth)

The CASL authorization system is now integrated and ready for use. The next step is to connect it with the backend authentication system to get real user roles and board ownership data.