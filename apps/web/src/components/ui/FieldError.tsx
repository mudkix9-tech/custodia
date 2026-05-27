import React from 'react';
import { cn } from '@/utils/cn';

export function FieldError({ children, className }: { children?: React.ReactNode, className?: string }) {
  if (!children) return null;
  return (
    <p className={cn("text-[12px] font-medium text-red-500 mt-1.5 animate-in fade-in slide-in-from-top-1", className)}>
      {children}
    </p>
  );
}
