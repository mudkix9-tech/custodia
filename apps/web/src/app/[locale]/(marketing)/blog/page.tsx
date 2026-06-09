"use client";

import React from 'react';
import Link from 'next/link';

export default function BlogIndex() {
  return (
    <div className="pt-24 pb-32">
      <section className="max-w-7xl mx-auto px-6 mb-20 text-center">
        <h1 className="text-4xl md:text-6xl font-serif text-ink-900 mb-6 tracking-tight">The Agency Compliance Blog</h1>
        <p className="text-xl text-ink-500 max-w-2xl mx-auto">
          Practical guides, regulatory updates, and deep dives into GDPR compliance for digital agencies.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {[
             { title: "The Complete GDPR Compliance Guide for Agencies", slug: "gdpr-compliance-guide-agencies", category: "GDPR Basics", date: "June 1, 2026", readTime: "15 min" },
             { title: "What is a ROPA? A Practical Template for Marketing Teams", slug: "what-is-ropa-template", category: "Guides & Templates", date: "May 15, 2026", readTime: "8 min" },
             { title: "Why Google Consent Mode v2 Matters for Your Clients", slug: "google-consent-mode-v2", category: "Cookie Consent", date: "May 2, 2026", readTime: "6 min" }
           ].map((post, i) => (
              <Link href={`/blog/${post.slug}`} key={i} className="group bg-white p-6 rounded-2xl hairline shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                 <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-semibold text-sage-700 bg-sage-50 px-2.5 py-1 rounded-full border border-sage-500/20">{post.category}</span>
                    <span className="text-xs text-ink-400">{post.readTime} read</span>
                 </div>
                 <h2 className="text-xl font-bold text-ink-900 mb-4 group-hover:text-sage-700 transition-colors">{post.title}</h2>
                 <div className="mt-auto pt-6 border-t border-ink-900/5 text-sm text-ink-500">
                    {post.date}
                 </div>
              </Link>
           ))}
        </div>
      </section>
    </div>
  );
}
