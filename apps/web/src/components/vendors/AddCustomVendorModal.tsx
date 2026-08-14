"use client";

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';

/**
 * The "Add Custom Vendor" control in the register toolbar had no handler, so the
 * only route into the vendor list was the discovery scan — a customer whose
 * processor is not on a website they own could not record it at all.
 *
 * `vendors.createCustom` already existed; nothing called it.
 */
export function AddCustomVendorModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState('');

  const createMutation = trpc.vendors.createCustom.useMutation({
    onSuccess: () => {
      toast(`${name.trim()} added to the register`);
      setName('');
      setWebsite('');
      setCategory('');
      setCountry('');
      onCreated?.();
      onClose();
    },
    onError: (err) => {
      toast('Could not add the vendor', { tone: 'error', description: err.message });
    },
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || createMutation.isPending) return;
    createMutation.mutate({
      name: name.trim(),
      website: website.trim() || undefined,
      category: category.trim() || undefined,
      headquartersCountry: country.trim() || undefined,
    });
  };

  const field =
    'w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[14px] text-[#F4F5F6] placeholder:text-[#6E747A] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-vendor-title"
        className="rise-in w-full max-w-md rounded-2xl border border-white/10 bg-[#0D0F11] shadow-panel-elevated"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="add-vendor-title" className="font-serif text-lg text-[#F4F5F6]">
            Add custom vendor
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[#6E747A] transition-colors hover:text-[#E6E8EA]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label htmlFor="vendor-name" className="mb-1.5 block text-[13px] font-medium text-[#E6E8EA]">
              Vendor name <span className="text-[#C9A227]">*</span>
            </label>
            <input
              id="vendor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Northbound Analytics"
              className={field}
            />
          </div>

          <div>
            <label htmlFor="vendor-website" className="mb-1.5 block text-[13px] font-medium text-[#E6E8EA]">
              Website
            </label>
            <input
              id="vendor-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className={field}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="vendor-category" className="mb-1.5 block text-[13px] font-medium text-[#E6E8EA]">
                Category
              </label>
              <input
                id="vendor-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Analytics"
                className={field}
              />
            </div>
            <div>
              <label htmlFor="vendor-country" className="mb-1.5 block text-[13px] font-medium text-[#E6E8EA]">
                HQ country
              </label>
              <input
                id="vendor-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="IE"
                className={field}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-[13.5px] text-[#E6E8EA] transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="rounded-lg bg-[#C9A227] px-4 py-2 text-[13.5px] font-medium text-[#08090A] transition-colors hover:bg-[#E5C463] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding…' : 'Add vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
