"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function BlogPost({ params }: { params: { slug: string } }) {
  // Mock blog post rendering
  return (
    <div className="pt-24 pb-32">
       <div className="max-w-3xl mx-auto px-6">
          <Link href="/blog" className="inline-flex items-center gap-2 text-ink-500 hover:text-ink-900 mb-8 text-sm transition-colors">
             <ArrowLeft className="w-4 h-4"/> Back to blog
          </Link>
          <div className="flex items-center gap-3 mb-6">
             <span className="text-xs font-semibold text-sage-700 bg-sage-50 px-2.5 py-1 rounded-full border border-sage-500/20">Category</span>
             <span className="text-sm text-ink-400">June 1, 2026</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-ink-900 mb-8 tracking-tight capitalize">
             {params.slug.replace(/-/g, ' ')}
          </h1>

          <div className="prose prose-sage max-w-none text-ink-600 mb-16">
             <p className="lead text-lg text-ink-500 mb-8">
                This is a placeholder for the actual blog content which would be rendered from MDX files.
             </p>
             <h2>Introduction</h2>
             <p>As a digital agency, managing compliance is often an afterthought. However, the regulatory landscape in the EU is shifting, making it a critical business function.</p>
             <h2>Understanding the Basics</h2>
             <p>You need to understand the difference between being a data controller and a data processor. This fundamental distinction drives your entire compliance strategy.</p>
          </div>

          <div className="bg-sage-50 border border-sage-500/20 p-8 rounded-2xl text-center">
             <h3 className="text-xl font-serif text-ink-900 mb-3">Find out your GDPR score</h3>
             <p className="text-ink-600 mb-6">Take our free 3-minute assessment to see where your agency stands.</p>
             <Link href="/assessment" className="inline-flex bg-sage-700 hover:bg-sage-600 text-bone-50 text-sm font-semibold py-2.5 px-6 rounded-xl transition-all items-center justify-center gap-2 shadow-card">
                 Take the assessment <ArrowRight className="w-4 h-4"/>
             </Link>
          </div>
       </div>
    </div>
  );
}
