import React from 'react';
import { Can } from '../contexts/AbilityContext';
import { Shield } from 'lucide-react';

interface PermissionGateProps {
  I: string; // action
  a: string | any; // subject
  field?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ I, a, field, fallback, children }: PermissionGateProps) {
  const defaultFallback = (
    <div className="flex items-center justify-center p-4 text-gray-500">
      <Shield className="w-5 h-5 mr-2" />
      <span>You don't have permission to {I} this {typeof a === 'string' ? a : 'resource'}</span>
    </div>
  );

  return (
    <Can I={I as any} a={a} field={field}>
      {children}
    </Can>
  );
}