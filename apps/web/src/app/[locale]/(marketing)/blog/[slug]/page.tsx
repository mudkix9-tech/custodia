"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function BlogPost({ params }: { params: { slug: string } }) {
  // Mock blog post rendering
  return (
    <div className="relative pt-24 pb-32 overflow-hidden min-h-screen">
       {/* Background decorations matching new design */}
       <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)] pointer-events-none" />
       <div aria-hidden="true" className="absolute -top-60 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none" />

       <div className="relative max-w-3xl mx-auto px-6 z-10">
          <Link href="/blog" className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary mb-8 text-[14px] transition-colors">
             <ArrowLeft className="w-4 h-4"/> Back to blog
          </Link>
          <div className="flex items-center gap-3 mb-6">
             <span className="text-xs font-medium text-accent-gold bg-accent-gold/10 px-2.5 py-1 rounded-full border border-accent-gold/20">Category</span>
             <span className="text-[13px] text-text-muted">June 1, 2026</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-normal text-text-heading mb-8 tracking-[-0.032em] capitalize">
             {params.slug.replace(/-/g, ' ')}
          </h1>

          <div className="prose prose-invert prose-p:text-text-primary prose-headings:text-text-heading prose-headings:font-normal prose-headings:tracking-tight max-w-none mb-16">
             <p className="lead text-lg text-text-muted mb-8">
                This is a placeholder for the actual blog content which would be rendered from MDX files.
             </p>
             <h2 className="text-2xl mt-10 mb-4">Introduction</h2>
             <p className="mb-4">As a digital agency, managing compliance is often an afterthought. However, the regulatory landscape in the EU is shifting, making it a critical business function.</p>
             <h2 className="text-2xl mt-10 mb-4">Understanding the Basics</h2>
             <p className="mb-4">You need to understand the difference between being a data controller and a data processor. This fundamental distinction drives your entire compliance strategy.</p>
          </div>

          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-10 shadow-panel-elevated text-center mt-16">
             <h3 className="text-2xl font-normal text-text-heading mb-3 tracking-[-0.032em]">Find out your GDPR score</h3>
             <p className="text-text-muted mb-8 text-[15px]">Take our free 3-minute assessment to see where your agency stands.</p>
             <Link href="/assessment" className="inline-flex items-center justify-center gap-2 text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-8 py-3.5 transition-colors">
                 Take the assessment <ArrowRight className="w-4 h-4"/>
             </Link>
          </div>
       </div>
    </div>
  );
}
