// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { ChevronDown, Building2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

export function OrgSwitcher() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  // Only try to fetch if we think they might have access, but group role isn't currently added to nextauth session easily
  // In reality we should check role from session here or fetch it
  const { data: childOrgs } = trpc.group.listChildOrgs.useQuery(undefined, {
      enabled: !!session?.user,
      retry: false // Fail silently if not group admin
  });

  if (!childOrgs || childOrgs.length <= 1) return null;

  return (
    <div className="relative mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded-lg bg-bone-100 border border-bone-200 text-ink-700 hover:bg-bone-200 transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
           <Building2 className="w-4 h-4 shrink-0" />
           <span className="text-sm font-medium truncate">Switch Entity...</span>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-bone-200 rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
          <Link
             href="/group"
             onClick={() => setIsOpen(false)}
             className="block px-3 py-2 text-sm text-sage-700 font-medium hover:bg-bone-50 transition-colors"
          >
             Group Dashboard
          </Link>
          <div className="h-px bg-bone-200 my-1" />
          {childOrgs.map(org => (
            <Link
              key={org.id}
              href={`/group/${org.id}`}
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-sm text-ink-700 hover:bg-bone-50 transition-colors truncate"
            >
              {org.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
