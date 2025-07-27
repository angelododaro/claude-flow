import { AbilityBuilder, createMongoAbility, MongoAbility, InferSubjects } from '@casl/ability';
import { User } from '../types';

// Define the subjects that can be acted upon
export type Resource = {
  id: string;
  type: string;
  userId: string;
  boardId: string;
  public?: boolean;
};

export type Board = {
  id: string;
  name: string;
  ownerId: string;
  collaboratorIds?: string[];
  public?: boolean;
};

export type Comment = {
  id: string;
  userId: string;
  resourceId: string;
  boardId: string;
};

// Define all possible subjects
type Subjects = InferSubjects<typeof Resource | typeof Board | typeof Comment | typeof User> | 'all';

// Define all possible actions
export type Actions = 
  | 'manage' // Full CRUD
  | 'create' 
  | 'read' 
  | 'update' 
  | 'delete'
  | 'share'
  | 'export'
  | 'comment'
  | 'invite';

// Define the Ability type
export type AppAbility = MongoAbility<[Actions, Subjects]>;

// Role definitions
export enum Role {
  ADMIN = 'admin',
  OWNER = 'owner',
  COLLABORATOR = 'collaborator',
  VIEWER = 'viewer',
  GUEST = 'guest'
}

// Define abilities based on user role and context
export function defineAbilitiesFor(user: User | null): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (!user) {
    // Guest users - very limited access
    can('read', 'Board', { public: true });
    can('read', 'Resource', { public: true });
    return build();
  }

  // Common permissions for all authenticated users
  can('create', 'Board');
  can('read', 'User');
  
  // Define role-based permissions
  switch (user.role) {
    case Role.ADMIN:
      // Admins can do everything
      can('manage', 'all');
      break;

    case Role.OWNER:
      // Board owner permissions
      can('manage', 'Board', { ownerId: user.id });
      can('manage', 'Resource', { boardId: { $in: user.ownedBoardIds || [] } });
      can('manage', 'Comment', { boardId: { $in: user.ownedBoardIds || [] } });
      can('share', 'Board', { ownerId: user.id });
      can('invite', 'Board', { ownerId: user.id });
      can('export', 'Board', { ownerId: user.id });
      break;

    case Role.COLLABORATOR:
      // Collaborator permissions
      can('read', 'Board', { 
        $or: [
          { collaboratorIds: { $in: [user.id] } },
          { ownerId: user.id },
          { public: true }
        ]
      });
      can('update', 'Board', { collaboratorIds: { $in: [user.id] } });
      can('create', 'Resource', { boardId: { $in: user.collaboratorBoardIds || [] } });
      can('update', 'Resource', { 
        $or: [
          { userId: user.id },
          { boardId: { $in: user.collaboratorBoardIds || [] } }
        ]
      });
      can('delete', 'Resource', { userId: user.id });
      can('comment', 'Resource', { boardId: { $in: user.collaboratorBoardIds || [] } });
      can('export', 'Board', { collaboratorIds: { $in: [user.id] } });
      break;

    case Role.VIEWER:
      // Viewer permissions - read only
      can('read', 'Board', {
        $or: [
          { collaboratorIds: { $in: [user.id] } },
          { ownerId: user.id },
          { public: true }
        ]
      });
      can('read', 'Resource', {
        $or: [
          { boardId: { $in: user.viewerBoardIds || [] } },
          { public: true }
        ]
      });
      can('read', 'Comment', { boardId: { $in: user.viewerBoardIds || [] } });
      can('export', 'Board', { 
        $or: [
          { collaboratorIds: { $in: [user.id] } },
          { public: true }
        ]
      });
      cannot('create', 'Resource');
      cannot('update', 'Resource');
      cannot('delete', 'Resource');
      break;

    case Role.GUEST:
      // Guest permissions - minimal access
      can('read', 'Board', { public: true });
      can('read', 'Resource', { public: true });
      cannot('create', 'Resource');
      cannot('update', 'Resource');
      cannot('delete', 'Resource');
      cannot('export', 'Board');
      break;
  }

  // Everyone can manage their own resources
  can('update', 'Resource', { userId: user.id });
  can('delete', 'Resource', { userId: user.id });
  can('update', 'Comment', { userId: user.id });
  can('delete', 'Comment', { userId: user.id });

  // Prevent users from deleting boards they don't own
  cannot('delete', 'Board', { ownerId: { $ne: user.id } });

  return build();
}

// Helper function to check if user can perform action
export function canUser(
  ability: AppAbility,
  action: Actions,
  subject: Subjects | any,
  field?: string
): boolean {
  return ability.can(action, subject, field);
}

// Export ability instance for use in components
export const ability = createMongoAbility<AppAbility>();

// Update ability when user changes
export function updateAbility(user: User | null) {
  const newAbility = defineAbilitiesFor(user);
  ability.update(newAbility.rules);
}