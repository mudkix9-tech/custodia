import React from 'react';

export default function ContactPage() {
  return (
    <div className="pt-24 pb-32 max-w-3xl mx-auto px-6 font-sans">
      <h1 className="text-4xl font-serif text-ink-900 mb-6 tracking-tight text-center">Contact Us</h1>
      <p className="text-lg text-ink-500 mb-12 text-center">Have a question or want to book a demo? We're here to help.</p>

      <form className="space-y-6 bg-white p-8 rounded-2xl shadow-sm hairline">
        <div className="grid grid-cols-2 gap-6">
           <div>
             <label className="block text-sm font-semibold text-ink-900 mb-2">First Name</label>
             <input type="text" className="w-full px-4 py-2 border border-ink-900/10 rounded-lg focus:ring-sage-500 focus:border-sage-500" />
           </div>
           <div>
             <label className="block text-sm font-semibold text-ink-900 mb-2">Last Name</label>
             <input type="text" className="w-full px-4 py-2 border border-ink-900/10 rounded-lg focus:ring-sage-500 focus:border-sage-500" />
           </div>
        </div>
        <div>
           <label className="block text-sm font-semibold text-ink-900 mb-2">Work Email</label>
           <input type="email" className="w-full px-4 py-2 border border-ink-900/10 rounded-lg focus:ring-sage-500 focus:border-sage-500" />
        </div>
        <div>
           <label className="block text-sm font-semibold text-ink-900 mb-2">Message</label>
           <textarea rows={4} className="w-full px-4 py-2 border border-ink-900/10 rounded-lg focus:ring-sage-500 focus:border-sage-500"></textarea>
        </div>
        <button type="button" className="w-full bg-sage-700 hover:bg-sage-600 text-bone-50 font-semibold py-3 px-6 rounded-xl transition-all shadow-card">
          Send Message
        </button>
      </form>
    </div>
  );
}
