"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Link } from '@/i18n/routing';
import { ChevronDown, Building2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

export function OrgSwitcher() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const { data: org } = trpc.settings.getOrgSettings.useQuery(undefined, {
    enabled: !!session?.user,
  });

  // Group admins only; fails silently for everyone else.
  const { data: childOrgs } = trpc.group.listChildOrgs.useQuery(undefined, {
    enabled: !!session?.user,
    retry: false,
  });

  // Identity is shown for every customer. The switcher affordance is the part
  // that is conditional -- previously the whole block returned null, so the
  // single-org majority saw no organisation name anywhere in the product.
  const canSwitch = !!childOrgs && childOrgs.length > 1;
  const orgName = org?.name;

  const identity = (
    <div className="flex items-center gap-2 overflow-hidden">
      <Building2 className="w-4 h-4 shrink-0 text-[#6E747A]" />
      <span className="text-sm font-medium truncate">
        {orgName ?? <span className="text-[#6E747A]">&hellip;</span>}
      </span>
    </div>
  );

  if (!canSwitch) {
    return (
      <div className="mb-6 w-full flex items-center p-2 rounded-lg border border-white/10 text-[#E6E8EA]">
        {identity}
      </div>
    );
  }

  return (
    <div className="relative mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="w-full flex items-center justify-between p-2 rounded-lg border border-white/10 text-[#E6E8EA] hover:bg-white/[0.04] transition-colors focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:outline-none"
      >
        {identity}
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0D0F11] border border-white/10 rounded-lg shadow-panel-elevated z-50 py-1 max-h-60 overflow-y-auto">
          <Link
            href="/group"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 text-sm text-[#C9A227] font-medium hover:bg-white/[0.04] transition-colors"
          >
            Group Dashboard
          </Link>
          <div className="h-px bg-white/10 my-1" />
          {childOrgs.map((child: { id: string; name: string }) => (
            <Link
              key={child.id}
              href={`/group/${child.id}`}
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-sm text-[#E6E8EA] hover:bg-white/[0.04] transition-colors truncate"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
