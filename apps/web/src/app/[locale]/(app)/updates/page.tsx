// @ts-nocheck
"use client";
import { GenericListSkeleton } from '@/components/skeletons/PageSkeleton';

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Filter, Search } from 'lucide-react';
import { RegulatoryUpdateCard } from '@/components/regulatory/RegulatoryUpdateCard';

export default function UpdatesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: updates, isLoading } = trpc.regulatory.listHistory.useQuery({ limit: 100 });

  if (isLoading) return <GenericListSkeleton />;

  const filteredUpdates = updates?.filter(u => 
    u.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.sourceName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto p-8 fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Regulatory Feed</h1>
          <p className="text-ink-600">Chronological history of all GDPR updates and DPA guidelines.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search updates..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-ink-900/10 rounded-lg text-sm focus:ring-sage-500 w-64"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-ink-900/10 rounded-lg text-sm text-ink-600 hover:bg-bone-50">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {filteredUpdates?.map(update => {
          return <RegulatoryUpdateCard key={update.id} update={update} />;
        })}
        {filteredUpdates?.length === 0 && (
          <div className="text-center py-20 text-ink-500">No regulatory updates found.</div>
        )}
      </div>
    </div>
  );
}
