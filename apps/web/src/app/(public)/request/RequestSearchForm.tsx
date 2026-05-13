"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RequestSearchForm() {
  const [slug, setSlug] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (slug.trim()) {
      // In a real app, this would search an API by name and return the slug.
      // For MVP, we assume the user types the exact slug or we sanitize it.
      const safeSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      router.push(`/${safeSlug}/request`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-ink-900/10">
      <div className="flex gap-3">
        <input 
          type="text" 
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Enter organization ID or slug (e.g., acme-corp)"
          className="flex-1 bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500"
        />
        <button 
          type="submit"
          disabled={!slug.trim()}
          className="px-6 py-3 bg-ink-900 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-ink-800 transition-colors"
        >
          Continue
        </button>
      </div>
    </form>
  );
}
