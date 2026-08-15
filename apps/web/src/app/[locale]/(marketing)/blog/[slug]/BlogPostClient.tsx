"use client";

import React, { use } from 'react';
import { Link } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { POSTS } from '../posts';

const componentCache = new Map<string, React.LazyExoticComponent<React.ComponentType>>();

function getPostComponent(slug: string, loader: () => Promise<{ default: React.ComponentType }>) {
  let Comp = componentCache.get(slug);
  if (!Comp) {
    Comp = React.lazy(loader);
    componentCache.set(slug, Comp);
  }
  return Comp;
}

export default function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const post = POSTS[resolvedParams.slug];

  if (!post) {
    notFound();
  }

  const PostComponent = getPostComponent(resolvedParams.slug, post.component);

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
             <span className="text-xs font-medium text-accent-gold bg-accent-gold/10 px-2.5 py-1 rounded-full border border-accent-gold/20">
               {post.category}
             </span>
             <span className="text-[13px] text-text-muted">
               {post.date}
             </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-normal text-text-heading mb-8 tracking-[-0.032em] capitalize">
             {post.title}
          </h1>

          <div className="prose prose-invert prose-p:text-text-primary prose-headings:text-text-heading prose-headings:font-normal prose-headings:tracking-tight max-w-none mb-16">
             <React.Suspense fallback={<div className="animate-pulse h-96 bg-white/5 rounded-lg"></div>}>
               {React.createElement(PostComponent)}
             </React.Suspense>
          </div>

          <div className="bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-10 shadow-panel-elevated text-center mt-16">
             <h3 className="text-2xl font-normal text-text-heading mb-3 tracking-[-0.032em]">Find out your GDPR score</h3>
             <p className="text-text-muted mb-8 text-[15px]">Take our free 12-minute assessment to see where your agency stands.</p>
             <Link href="/assessment" className="inline-flex items-center justify-center gap-2 text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover px-8 py-3.5 transition-colors">
                 Take the assessment <ArrowRight className="w-4 h-4"/>
             </Link>
          </div>
       </div>
    </div>
  );
}
