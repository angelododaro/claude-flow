import { useAbility } from '../contexts/AbilityContext';
import { useAuthContext } from '../contexts/AuthContext';

export function usePermissions() {
  const ability = useAbility();
  const { user } = useAuthContext();

  // Board permissions
  const canCreateBoard = ability.can('create', 'Board');
  const canManageBoard = (boardId: string) => 
    ability.can('manage', 'Board', { id: boardId });
  const canUpdateBoard = (boardId: string) => 
    ability.can('update', 'Board', { id: boardId });
  const canDeleteBoard = (boardId: string) => 
    ability.can('delete', 'Board', { id: boardId });
  const canShareBoard = (boardId: string) => 
    ability.can('share', 'Board', { id: boardId });
  const canExportBoard = (boardId: string) => 
    ability.can('export', 'Board', { id: boardId });

  // Resource permissions
  const canCreateResource = (boardId: string) => 
    ability.can('create', 'Resource', { boardId });
  const canUpdateResource = (resource: any) => 
    ability.can('update', 'Resource', resource);
  const canDeleteResource = (resource: any) => 
    ability.can('delete', 'Resource', resource);

  // Comment permissions
  const canComment = (boardId: string) => 
    ability.can('comment', 'Resource', { boardId });
  const canDeleteComment = (comment: any) => 
    ability.can('delete', 'Comment', comment);

  // Helper to check if user is board owner
  const isBoardOwner = (boardId: string) => 
    user?.ownedBoardIds?.includes(boardId) || false;

  // Helper to check if user is collaborator
  const isBoardCollaborator = (boardId: string) => 
    user?.collaboratorBoardIds?.includes(boardId) || false;

  // Helper to check if user has any edit rights
  const canEditBoard = (boardId: string) => 
    isBoardOwner(boardId) || isBoardCollaborator(boardId);

  return {
    // Board permissions
    canCreateBoard,
    canManageBoard,
    canUpdateBoard,
    canDeleteBoard,
    canShareBoard,
    canExportBoard,
    
    // Resource permissions
    canCreateResource,
    canUpdateResource,
    canDeleteResource,
    
    // Comment permissions
    canComment,
    canDeleteComment,
    
    // Helper functions
    isBoardOwner,
    isBoardCollaborator,
    canEditBoard,
    
    // Raw ability for custom checks
    ability,
    user,
  };
}