"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FieldError } from '@/components/ui/FieldError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';


const REQUEST_TYPES = [
  { id: 'access', label: 'Access my data', desc: 'I want to know what personal data you hold about me and how you use it' },
  { id: 'erasure', label: 'Delete my data', desc: 'I want you to permanently delete all my personal data' },
  { id: 'rectification', label: 'Correct my data', desc: 'Some of my personal data is inaccurate and I want it corrected' },
  { id: 'restriction', label: 'Restrict processing', desc: 'I want you to stop using my data but keep it stored' },
  { id: 'portability', label: 'Get a copy of my data', desc: 'I want a copy of my data in a machine-readable format to transfer elsewhere' },
  { id: 'objection', label: 'Object to processing', desc: 'I want to object to how you are using my data' },
];

const dsarSchema = z.object({
  requestType: z.string().min(1, 'Please select a request type'),
  subjectName: z.string().min(1, 'Name is required'),
  subjectEmail: z.string().email('Please enter a valid email address'),
  identifier: z.string().optional(),
  details: z.string().optional(),
  consentVerified: z.boolean().refine(val => val === true, { message: 'You must verify your identity' })
});

export function DsarIntakeForm({ orgSlug, orgName }: { orgSlug: string, orgName: string }) {
  const [step, setStep] = useState(1);
  const { register, handleSubmit, formState: { errors }, watch, setValue, control } = useForm({
    resolver: zodResolver(dsarSchema),
    defaultValues: {
      requestType: 'access',
      subjectName: '',
      subjectEmail: '',
      identifier: '',
      details: '',
      consentVerified: false
    }
  });
  const formData = watch();

  const [reference, setReference] = useState('');
  const submitMutation = trpc.dsar.submitPublic.useMutation();

  const onSubmit = async (data: any) => {
    try {
      const result = await submitMutation.mutateAsync({
        orgSlug,
        requestType: data.requestType,
        subjectName: data.subjectName,
        subjectEmail: data.subjectEmail,
        subjectIdentifier: { provided_id: data.identifier },
        details: data.details
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
        <div className="w-16 h-16 bg-[#C9A227]/10 text-[#C9A227] rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif text-[#F4F5F6] mb-2">Request Received</h2>
        <p className="text-[#9BA1A6] mb-6">Your request has been successfully submitted to {orgName}.</p>
        
        <div className="bg-[#08090A] rounded-xl p-6 inline-block text-left mb-8">
          <div className="text-[12px] font-bold text-[#6E747A] uppercase tracking-wider mb-1">Reference Number</div>
          <div className="text-xl font-mono text-[#F4F5F6]">{reference}</div>
        </div>

        <div className="text-[14px] text-[#9BA1A6] space-y-4 max-w-md mx-auto bg-[#0D0F11] border border-amber-900/50 rounded-xl p-6 shadow-panel-elevated">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-left">
              <strong className="block text-[#F4F5F6] mb-1">Action Required: Verify your identity</strong>
              We have sent a verification link to <strong>{formData.subjectEmail}</strong>. 
              We cannot process your request until you click the link in that email to confirm your identity.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-8 md:p-10">
      {step === 1 && (
        <div className="space-y-6 fade-up">
          <div>
            <h3 className="text-[15px] font-semibold text-[#F4F5F6] mb-4">What would you like to request?</h3>
            <div className="space-y-3">
              {REQUEST_TYPES.map((type) => (
                <label 
                  key={type.id} 
                  className={`block p-4 rounded-xl border cursor-pointer transition-colors ${formData.requestType === type.id ? 'border-[var(--org-primary)] bg-[var(--org-primary)]/5' : 'border-white/10 hover:border-white/20'}`}
                >
                  <div className="flex items-start gap-3">
                    <input 
                      type="radio" 
                      value={type.id}
                      {...register('requestType')}
                      className="mt-1 text-[var(--org-primary)] focus:ring-[var(--org-primary)]"
                    />
                    <div>
                      <div className="font-medium text-[#F4F5F6] mb-0.5">{type.label}</div>
                      <div className="text-[13px] text-[#6E747A]">{type.desc}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex justify-end">
            <Button 
              type="button"
              disabled={!formData.requestType}
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-[var(--org-primary)] text-white rounded-xl font-medium hover:bg-[var(--org-primary)]/90"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 fade-up">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[#E6E8EA]">Full Name</label>
              <Input 
                required
                type="text"
                {...register('subjectName')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[#E6E8EA]">Email Address</label>
              <Input 
                required
                type="email"
                {...register('subjectEmail')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[#E6E8EA]">Account ID or Username (Optional)</label>
            <p className="text-[12px] text-[#6E747A] mb-2">How can we identify your data in our systems?</p>
            <Input 
              type="text"
              {...register('identifier')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[#E6E8EA]">Specific Details (Optional)</label>
            <p className="text-[12px] text-[#6E747A] mb-2">Is there anything specific you want us to address?</p>
            <Textarea 
              rows={4}
              {...register('details')}
            />
          </div>

          <div className="pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <Controller
                name="consentVerified"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-1"
                  />
                )}
              />
              <span className="text-[13px] text-[#9BA1A6] leading-relaxed">
                I confirm that I am the data subject (or I am legally authorized to submit this request on their behalf), and the information provided is accurate. I understand that {orgName} must verify my identity before processing this request.
              </span>
            </label>
          </div>

          <div className="pt-6 border-t border-white/10 flex justify-between items-center">
            <Button 
              type="button"
              variant="ghost"
              onClick={() => setStep(1)}
              className="text-[14px] font-medium text-[#6E747A] hover:text-[#F4F5F6]"
            >
              Back
            </Button>
            <Button 
              type="submit"
              disabled={!formData.consentVerified || submitMutation.isPending}
              className="px-6 py-2.5 bg-[var(--org-primary)] text-white rounded-xl font-medium hover:bg-[var(--org-primary)]/90"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
