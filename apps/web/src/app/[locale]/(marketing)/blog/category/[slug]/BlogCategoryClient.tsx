"use client";

import React from 'react';
import { Link } from '@/i18n/routing';
import { ArrowLeft } from 'lucide-react';

export default function BlogCategory({ params }: { params: { slug: string } }) {
  return (
    <div className="pt-24 pb-32 [font-family:var(--font-plex-sans)]">
      <section className="max-w-7xl mx-auto px-6 mb-20 text-center">
        <Link href="/blog" className="inline-flex items-center gap-2 text-text-muted hover:text-text-heading mb-8 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4"/> Back to all posts
        </Link>
        <h1 className="text-4xl md:text-6xl text-text-heading mb-6 tracking-tight capitalize">{params.slug.replace(/-/g, ' ')} Posts</h1>
      </section>

      <section className="max-w-7xl mx-auto px-6">
         {/* Placeholder grid similar to blog index */}
         <div className="text-center text-text-muted">Posts for this category will appear here.</div>
      </section>
    </div>
  );
}
