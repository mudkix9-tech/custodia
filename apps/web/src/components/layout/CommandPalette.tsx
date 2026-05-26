"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { trpc } from '@/utils/trpc';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // A basic implementation for MVP: searching vendors and ROPA locally.
  // In a full implementation, this might call a Meilisearch endpoint or a dedicated TRPC search route.
  const ropaQuery = trpc.ropa.list.useQuery({ limit: 100 }, { enabled: isOpen });
  const vendorQuery = trpc.vendors.getOrgVendors.useQuery({ limit: 100 }, { enabled: isOpen });

  if (!isOpen) return null;

  const ropaResults = ((ropaQuery.data?.data as any[]) || []).filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
  const vendorResults = ((vendorQuery.data?.data as any[]) || []).filter(item => item.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-ink-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-ink-900/10">
        <div className="flex items-center px-4 py-4 border-b border-ink-900/10">
          <Search className="w-5 h-5 text-ink-400 mr-3" />
          <input
            autoFocus
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-lg placeholder-ink-400"
            placeholder="Search activities, vendors, policies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-ink-100 text-ink-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.length > 0 && ropaResults.length === 0 && vendorResults.length === 0 && (
            <div className="p-8 text-center text-ink-500">No results found for "{query}"</div>
          )}

          {ropaResults.length > 0 && (
            <div className="mb-4">
              <div className="px-3 py-1 text-xs font-semibold text-ink-500 uppercase tracking-wider">Processing Activities</div>
              {ropaResults.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setIsOpen(false); router.push(`/ropa/${item.id}`); }}
                  className="w-full text-left px-3 py-3 rounded-lg hover:bg-bone-50 flex items-center justify-between group"
                >
                  <span className="font-medium text-ink-900">{item.name}</span>
                  <span className="text-xs text-ink-400 opacity-0 group-hover:opacity-100">Jump to →</span>
                </button>
              ))}
            </div>
          )}

          {vendorResults.length > 0 && (
            <div>
              <div className="px-3 py-1 text-xs font-semibold text-ink-500 uppercase tracking-wider">Vendors</div>
              {vendorResults.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setIsOpen(false); router.push(`/vendors/${item.id}`); }}
                  className="w-full text-left px-3 py-3 rounded-lg hover:bg-bone-50 flex items-center justify-between group"
                >
                  <span className="font-medium text-ink-900">{item.name}</span>
                  <span className="text-xs text-ink-400 opacity-0 group-hover:opacity-100">Jump to →</span>
                </button>
              ))}
            </div>
          )}

          {query === '' && (
            <div className="p-8 text-center flex flex-col items-center">
              <div className="flex gap-2 mb-4">
                <kbd className="px-2 py-1 bg-bone-50 border border-ink-900/10 rounded font-mono text-xs font-semibold text-ink-500">Cmd</kbd>
                <kbd className="px-2 py-1 bg-bone-50 border border-ink-900/10 rounded font-mono text-xs font-semibold text-ink-500">K</kbd>
              </div>
              <p className="text-sm text-ink-500">Start typing to search your workspace</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
