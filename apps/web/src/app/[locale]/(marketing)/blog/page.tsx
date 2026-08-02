"use client";

import React from 'react';
import Link from 'next/link';

export default function BlogIndex() {
  return (
    <div className="relative pt-24 pb-32 overflow-hidden min-h-screen">
      {/* Background decorations matching new design */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)] pointer-events-none" />
      <div aria-hidden="true" className="absolute -top-60 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none" />

      <section className="relative max-w-7xl mx-auto px-6 mb-20 text-center z-10">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-normal text-text-heading mb-6 tracking-[-0.032em]">
          The Agency Compliance Blog
        </h1>
        <p className="text-[17px] sm:text-[19px] text-text-muted max-w-2xl mx-auto text-pretty">
          Practical guides, regulatory updates, and deep dives into GDPR compliance for digital agencies.
        </p>
      </section>

      <section className="relative max-w-7xl mx-auto px-6 z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {[
             { title: "The Six Lawful Bases Under the GDPR and How to Choose the Right One", slug: "six-lawful-bases-gdpr", category: "GDPR Basics", date: "August 2, 2026", readTime: "10 min" },
             { title: "The Complete GDPR Compliance Guide for Agencies", slug: "gdpr-compliance-guide-agencies", category: "GDPR Basics", date: "June 1, 2026", readTime: "10 min" },
             { title: "What is a ROPA? A Practical Template for Marketing Teams", slug: "what-is-ropa-template", category: "Guides & Templates", date: "May 15, 2026", readTime: "8 min" },
             { title: "Why Google Consent Mode v2 Matters for Your Clients", slug: "google-consent-mode-v2", category: "Cookie Consent", date: "May 2, 2026", readTime: "6 min" }
           ].map((post, i) => (
              <Link href={`/blog/${post.slug}`} key={i} className="group bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom p-6 flex flex-col h-full border border-white/9 shadow-panel-elevated hover:border-white/20 transition-colors">
                 <div className="flex items-center gap-3 mb-6">
                    <span className="text-xs font-medium text-accent-gold bg-accent-gold/10 px-2.5 py-1 rounded-full border border-accent-gold/20">{post.category}</span>
                    <span className="text-[13px] text-text-muted">{post.readTime} read</span>
                 </div>
                 <h2 className="text-xl font-medium text-text-heading mb-4 group-hover:text-accent-gold transition-colors">{post.title}</h2>
                 <div className="mt-auto pt-6 border-t border-white/5 text-[13px] text-text-muted">
                    {post.date}
                 </div>
              </Link>
           ))}
        </div>
      </section>
    </div>
  );
}
