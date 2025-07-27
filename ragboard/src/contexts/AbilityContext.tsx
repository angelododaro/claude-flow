import React, { createContext, useContext, useEffect, useState } from 'react';
import { createContextualCan, useAbility as useCaslAbility } from '@casl/react';
import { AppAbility, defineAbilitiesFor, updateAbility } from '../auth/abilities';
import { useAuthContext } from './AuthContext';

// Create the ability context
const AbilityContext = createContext<AppAbility | undefined>(undefined);

// Create the Can component bound to our ability context
export const Can = createContextualCan(AbilityContext.Consumer);

// Provider component
export function AbilityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [ability, setAbility] = useState<AppAbility>(() => defineAbilitiesFor(user));

  // Update abilities when user changes
  useEffect(() => {
    const newAbility = defineAbilitiesFor(user);
    setAbility(newAbility);
    updateAbility(user); // Update the global ability instance
  }, [user]);

  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
}

// Custom hook to use ability in components
export function useAbility() {
  const context = useContext(AbilityContext);
  if (!context) {
    throw new Error('useAbility must be used within AbilityProvider');
  }
  return context;
}

// Re-export the useAbility hook from CASL with our context
export function useCaslAbilityHook() {
  return useCaslAbility(AbilityContext);
}

// Helper hooks for common permission checks
export function useCanCreate(subject: string) {
  const ability = useAbility();
  return ability.can('create', subject);
}

export function useCanRead(subject: string | any) {
  const ability = useAbility();
  return ability.can('read', subject);
}

export function useCanUpdate(subject: string | any) {
  const ability = useAbility();
  return ability.can('update', subject);
}

export function useCanDelete(subject: string | any) {
  const ability = useAbility();
  return ability.can('delete', subject);
}

export function useCanManage(subject: string | any) {
  const ability = useAbility();
  return ability.can('manage', subject);
}

export function useCanExport(subject: string | any) {
  const ability = useAbility();
  return ability.can('export', subject);
}

export function useCanShare(subject: string | any) {
  const ability = useAbility();
  return ability.can('share', subject);
}

// Component wrapper for conditional rendering based on permissions
interface CanDoProps {
  I: string; // action
  a: string | any; // subject
  field?: string;
  not?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function CanDo({ I, a, field, not = false, children, fallback = null }: CanDoProps) {
  const ability = useAbility();
  const canPerform = field ? ability.can(I as any, a, field) : ability.can(I as any, a);
  
  if (not ? !canPerform : canPerform) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}