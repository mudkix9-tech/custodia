"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import FocusTrap from 'focus-trap-react';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const ropaQuery = trpc.ropa.list.useQuery({ limit: 100 }, { enabled: isOpen });
  const vendorQuery = trpc.vendors.getOrgVendors.useQuery({ limit: 100 }, { enabled: isOpen });

  const ropaResults = ((ropaQuery.data?.data as any[]) || []).filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => ({ ...item, type: 'ropa', href: `/ropa/${item.id}` }));
  const vendorResults = ((vendorQuery.data?.data as any[]) || []).filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => ({ ...item, type: 'vendor', href: `/vendors/${item.id}` }));

  const allResults = [...ropaResults, ...vendorResults];

  useEffect(() => {
    setActiveIndex(query.length > 0 && allResults.length > 0 ? 0 : -1);
  }, [query, ropaResults.length, vendorResults.length]);

  const handleSelect = (item: any) => {
    setIsOpen(false);
    router.push(item.href);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, allResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && allResults[activeIndex]) {
          handleSelect(allResults[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(allResults.length - 1);
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <FocusTrap focusTrapOptions={{ initialFocus: false, escapeDeactivates: false, clickOutsideDeactivates: true, onDeactivate: () => setIsOpen(false) }}>
      <div
        className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-ink-900/40 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmd-palette-label"
        onKeyDown={handleKeyDown}
      >
        <h2 id="cmd-palette-label" className="sr-only">Search commands</h2>

        <div className="bg-[#0D0F11] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/10 flex flex-col">
          <div className="flex items-center px-4 py-4 border-b border-white/10">
            <Search className="w-5 h-5 text-[#6E747A] mr-3" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              className="flex-1 bg-transparent border-none outline-none text-lg placeholder-ink-400"
              role="combobox"
              aria-expanded={allResults.length > 0}
              aria-controls="cmd-results"
              aria-activedescendant={activeIndex >= 0 ? `cmd-result-${activeIndex}` : undefined}
              aria-autocomplete="list"
              aria-label="Search for pages, actions, and resources"
              placeholder="Search activities, vendors, policies..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-white/10 text-[#6E747A] focus:outline-none focus:ring-2 focus:ring-ink-500"
              aria-label="Close search"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {query.length > 0 && allResults.length === 0 && (
              <p role="status" aria-live="polite" className="p-8 text-center text-[#6E747A]">No results found for "{query}"</p>
            )}

            {allResults.length > 0 && (
              <ul id="cmd-results" role="listbox" aria-label="Search results">
                {allResults.map((result, i) => (
                  <li
                    key={result.id}
                    id={`cmd-result-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full text-left px-3 py-3 rounded-lg flex items-center justify-between cursor-pointer group ${i === activeIndex ? 'bg-white/5 text-[#F4F5F6]' : 'text-[#E6E8EA] hover:bg-[#08090A]'}`}
                  >
                    <div>
                      <span className="text-[10px] font-semibold text-[#6E747A] uppercase tracking-wider block mb-1">{result.type === 'ropa' ? 'Processing Activity' : 'Vendor'}</span>
                      <span className="font-medium">{result.name}</span>
                    </div>
                    <span className="text-xs text-[#6E747A] opacity-0 group-hover:opacity-100">Jump to →</span>
                  </li>
                ))}
              </ul>
            )}

            {query === '' && (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="flex gap-2 mb-4">
                  <kbd className="px-2 py-1 bg-[#08090A] border border-white/10 rounded font-mono text-xs font-semibold text-[#6E747A]">Cmd</kbd>
                  <kbd className="px-2 py-1 bg-[#08090A] border border-white/10 rounded font-mono text-xs font-semibold text-[#6E747A]">K</kbd>
                </div>
                <p className="text-sm text-[#6E747A]">Start typing to search your workspace</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
