import React from 'react';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  onClick: () => void;
  className?: string;
}

export function ExportButton({ onClick, className = '' }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ${className}`}
      title="Export board"
    >
      <Download className="w-4 h-4" />
      <span>Export</span>
    </button>
  );
}