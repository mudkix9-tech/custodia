"use client";

import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { sendContactMessage } from '@/actions/contact';

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const formData = new FormData(e.currentTarget);
    
    try {
      const result = await sendContactMessage(formData);
      
      if (result.success) {
        setIsSuccess(true);
      } else {
        setSubmitError(result.error || 'Something went wrong.');
      }
    } catch (err) {
      console.error(err);
      setSubmitError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="relative pt-24 pb-32 overflow-hidden flex items-center justify-center min-h-[60vh]">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)] pointer-events-none" />
        <div aria-hidden="true" className="absolute -top-60 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none" />

        <div className="relative z-10 bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-10 shadow-panel-elevated text-center max-w-md w-full mx-6">
          <CheckCircle className="w-12 h-12 text-accent-gold mx-auto mb-6" />
          <h2 className="text-2xl text-text-heading mb-4">Message Sent</h2>
          <p className="text-text-muted mb-8">Thanks for reaching out. Our team will get back to you shortly.</p>
          <button 
            type="button"
            onClick={() => setIsSuccess(false)} 
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-text-primary border border-white/12 transition-colors"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pt-24 pb-32 overflow-hidden">
      {/* Background decorations matching new design */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(120%_80%_at_50%_0%,#000_20%,transparent_75%)] pointer-events-none" />
      <div aria-hidden="true" className="absolute -top-60 left-1/2 w-[900px] h-[520px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,var(--color-accent-transparent),transparent_70%)] pointer-events-none" />

      <div className="relative max-w-2xl mx-auto px-6">
        <h1 className="text-4xl sm:text-5xl font-normal text-text-heading mb-6 tracking-[-0.032em] text-center text-balance">Contact Us</h1>
        <p className="text-[17px] sm:text-[19px] text-text-muted mb-12 text-center text-pretty">
          Have a question or want to book a demo? We're here to help.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 bg-gradient-to-b from-surface-panel-top to-surface-panel-bottom border border-white/9 p-8 sm:p-10 shadow-panel-elevated">
          {submitError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[14px] rounded-md">
              {submitError}
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <div>
               <label className="block text-[13px] font-medium text-text-primary mb-2">First Name</label>
               <input name="firstName" required type="text" className="w-full bg-surface-base text-text-primary px-4 py-2.5 border border-white/12 hover:border-white/20 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-colors outline-none" />
             </div>
             <div>
               <label className="block text-[13px] font-medium text-text-primary mb-2">Last Name</label>
               <input name="lastName" required type="text" className="w-full bg-surface-base text-text-primary px-4 py-2.5 border border-white/12 hover:border-white/20 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-colors outline-none" />
             </div>
          </div>
          <div>
             <label className="block text-[13px] font-medium text-text-primary mb-2">Work Email</label>
             <input name="email" required type="email" className="w-full bg-surface-base text-text-primary px-4 py-2.5 border border-white/12 hover:border-white/20 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-colors outline-none" />
          </div>
          <div>
             <label className="block text-[13px] font-medium text-text-primary mb-2">Message</label>
             <textarea name="message" required rows={5} className="w-full bg-surface-base text-text-primary px-4 py-2.5 border border-white/12 hover:border-white/20 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-colors outline-none"></textarea>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full mt-2 text-[15px] font-medium text-surface-base bg-accent-gold hover:bg-accent-gold-hover py-3.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
}
