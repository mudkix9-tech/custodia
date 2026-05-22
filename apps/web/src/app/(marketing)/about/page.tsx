import React from 'react';

export default function AboutPage() {
  return (
    <div className="pt-24 pb-32 max-w-4xl mx-auto px-6 font-sans">
      <h1 className="text-4xl font-serif text-ink-900 mb-6 tracking-tight">About Privaro</h1>
      <p className="text-xl text-ink-500 mb-10">We believe GDPR compliance shouldn't be a blocker for innovation.</p>

      <div className="prose prose-sage max-w-none text-ink-600">
        <p>Privaro was built out of the frustration of seeing digital and marketing agencies struggle with fragmented, expensive compliance tools and consultants. We decided to build a platform that speaks the language of modern agencies.</p>
        <p>Our mission is to turn compliance from a liability into a competitive advantage.</p>
      </div>
    </div>
  );
}
