"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

const REQUEST_TYPES = [
  { id: 'access', label: 'Access my data', desc: 'I want to know what personal data you hold about me and how you use it' },
  { id: 'erasure', label: 'Delete my data', desc: 'I want you to permanently delete all my personal data' },
  { id: 'rectification', label: 'Correct my data', desc: 'Some of my personal data is inaccurate and I want it corrected' },
  { id: 'restriction', label: 'Restrict processing', desc: 'I want you to stop using my data but keep it stored' },
  { id: 'portability', label: 'Get a copy of my data', desc: 'I want a copy of my data in a machine-readable format to transfer elsewhere' },
  { id: 'objection', label: 'Object to processing', desc: 'I want to object to how you are using my data' },
];

export function DsarIntakeForm({ orgSlug, orgName }: { orgSlug: string, orgName: string }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    requestType: '',
    subjectName: '',
    subjectEmail: '',
    identifier: '',
    details: '',
    consent: false,
  });

  const [reference, setReference] = useState('');
  const submitMutation = trpc.dsar.submitPublic.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consent) return;

    try {
      const result = await submitMutation.mutateAsync({
        orgSlug,
        requestType: formData.requestType,
        subjectName: formData.subjectName,
        subjectEmail: formData.subjectEmail,
        subjectIdentifier: { provided_id: formData.identifier },
        details: formData.details
      });
      setReference(result.referenceNumber);
      setStep(3); // Success step
    } catch (err) {
      console.error('Failed to submit DSAR', err);
    }
  };

  if (step === 3) {
    return (
      <div className="p-10 text-center fade-up">
        <div className="w-16 h-16 bg-sage-50 text-sage-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif text-ink-900 mb-2">Request Received</h2>
        <p className="text-ink-600 mb-6">Your request has been successfully submitted to {orgName}.</p>
        
        <div className="bg-bone-50 rounded-xl p-6 inline-block text-left mb-8">
          <div className="text-[12px] font-bold text-ink-400 uppercase tracking-wider mb-1">Reference Number</div>
          <div className="text-xl font-mono text-ink-900">{reference}</div>
        </div>

        <div className="text-[14px] text-ink-600 space-y-4 max-w-md mx-auto bg-white border border-amber-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-left">
              <strong className="block text-ink-900 mb-1">Action Required: Verify your identity</strong>
              We have sent a verification link to <strong>{formData.subjectEmail}</strong>. 
              We cannot process your request until you click the link in that email to confirm your identity.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-8 md:p-10">
      {step === 1 && (
        <div className="space-y-6 fade-up">
          <div>
            <h3 className="text-[15px] font-semibold text-ink-900 mb-4">What would you like to request?</h3>
            <div className="space-y-3">
              {REQUEST_TYPES.map((type) => (
                <label 
                  key={type.id} 
                  className={`block p-4 rounded-xl border cursor-pointer transition-colors ${formData.requestType === type.id ? 'border-[var(--org-primary)] bg-[var(--org-primary)]/5' : 'border-ink-900/10 hover:border-ink-900/20'}`}
                >
                  <div className="flex items-start gap-3">
                    <input 
                      type="radio" 
                      name="requestType"
                      checked={formData.requestType === type.id}
                      onChange={() => setFormData(prev => ({...prev, requestType: type.id}))}
                      className="mt-1 text-[var(--org-primary)] focus:ring-[var(--org-primary)]"
                    />
                    <div>
                      <div className="font-medium text-ink-900 mb-0.5">{type.label}</div>
                      <div className="text-[13px] text-ink-500">{type.desc}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-ink-900/10 flex justify-end">
            <button 
              type="button"
              disabled={!formData.requestType}
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-[var(--org-primary)] text-white rounded-xl font-medium disabled:opacity-50 transition-opacity"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 fade-up">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-ink-700">Full Name</label>
              <input 
                required
                type="text"
                value={formData.subjectName}
                onChange={e => setFormData(prev => ({...prev, subjectName: e.target.value}))}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--org-primary)]/20 focus:border-[var(--org-primary)]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-ink-700">Email Address</label>
              <input 
                required
                type="email"
                value={formData.subjectEmail}
                onChange={e => setFormData(prev => ({...prev, subjectEmail: e.target.value}))}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--org-primary)]/20 focus:border-[var(--org-primary)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-ink-700">Account ID or Username (Optional)</label>
            <p className="text-[12px] text-ink-500 mb-2">How can we identify your data in our systems?</p>
            <input 
              type="text"
              value={formData.identifier}
              onChange={e => setFormData(prev => ({...prev, identifier: e.target.value}))}
              className="w-full bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--org-primary)]/20 focus:border-[var(--org-primary)]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-ink-700">Specific Details (Optional)</label>
            <p className="text-[12px] text-ink-500 mb-2">Is there anything specific you want us to address?</p>
            <textarea 
              rows={4}
              value={formData.details}
              onChange={e => setFormData(prev => ({...prev, details: e.target.value}))}
              className="w-full bg-bone-50 border border-ink-900/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--org-primary)]/20 focus:border-[var(--org-primary)]"
            />
          </div>

          <div className="pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                required
                type="checkbox"
                checked={formData.consent}
                onChange={e => setFormData(prev => ({...prev, consent: e.target.checked}))}
                className="mt-1 text-[var(--org-primary)] focus:ring-[var(--org-primary)] rounded border-ink-900/20"
              />
              <span className="text-[13px] text-ink-600 leading-relaxed">
                I confirm that I am the data subject (or I am legally authorized to submit this request on their behalf), and the information provided is accurate. I understand that {orgName} must verify my identity before processing this request.
              </span>
            </label>
          </div>

          <div className="pt-6 border-t border-ink-900/10 flex justify-between items-center">
            <button 
              type="button"
              onClick={() => setStep(1)}
              className="text-[14px] font-medium text-ink-500 hover:text-ink-900"
            >
              Back
            </button>
            <button 
              type="submit"
              disabled={!formData.consent || submitMutation.isPending}
              className="px-6 py-2.5 bg-[var(--org-primary)] text-white rounded-xl font-medium disabled:opacity-50 transition-opacity"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
