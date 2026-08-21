"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';
import { useToast } from '@/components/ui/Toast';
import { Landmark } from 'lucide-react';

/**
 * N114. The client's identity *as a controller*, which is what Article 30(2)(a)
 * requires a processor's record to carry.
 *
 * These are not CRM fields. The agency case is the whole point: forty clients
 * means forty Article 30(2) records, each of which has to name that client's
 * legal entity, address, Article 27 representative and data protection officer.
 * `name` and `contactEmail` were all the schema held, so every processor record
 * the module produced named the *agency's* DPO as the controller's — a document
 * that misidentifies the controller to a supervisory authority.
 *
 * The values land in the Article 30 export the moment they are saved; there is no
 * separate step, because the point of recording them is that they appear there.
 */
export function ControllerIdentityPanel({ client }: { client: any }) {
  const t = useTranslations('clients.detail.controller');
  const toast = useToast();
  const utils = trpc.useUtils();
  const update = trpc.clients.updateControllerIdentity.useMutation();

  const address = (client.controllerAddress ?? {}) as Record<string, string>;
  const representative = (client.controllerRepresentative ?? {}) as Record<string, string>;

  const [form, setForm] = useState({
    legalName: client.legalName ?? '',
    street: address.street ?? '',
    city: address.city ?? '',
    postalCode: address.postalCode ?? '',
    country: address.country ?? '',
    repName: representative.name ?? '',
    repEmail: representative.email ?? '',
    controllerDpoName: client.controllerDpoName ?? '',
    controllerDpoEmail: client.controllerDpoEmail ?? '',
    processingCategories: (client.processingCategories ?? []).join(', '),
  });
  const [dirty, setDirty] = useState(false);

  const set = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: client.id,
        legalName: form.legalName || null,
        controllerAddress: form.street || form.city || form.postalCode || form.country
          ? { street: form.street, city: form.city, postalCode: form.postalCode, country: form.country }
          : null,
        controllerRepresentative: form.repName || form.repEmail
          ? { name: form.repName, email: form.repEmail }
          : null,
        controllerDpoName: form.controllerDpoName || null,
        controllerDpoEmail: form.controllerDpoEmail || null,
        processingCategories: form.processingCategories
          .split(',')
          .map((value: string) => value.trim())
          .filter(Boolean),
      });
      setDirty(false);
      utils.clients.get.invalidate({ id: client.id });
      toast(t('saved'));
    } catch (err) {
      toast(t('save_failed'), { tone: 'error', description: err instanceof Error ? err.message : undefined });
    }
  };

  // Called, not rendered as `<Field/>`. A component declared inside a render is a
  // new type on every render, so React remounts the input rather than updating
  // it — and a controlled input that remounts loses focus after one keystroke.
  const Field = (props: { name: keyof typeof form; label: string; hint?: string }) => (
    <div>
      <label htmlFor={`controller-${props.name}`} className="text-[12px] text-[#6E747A] font-medium uppercase tracking-wider">
        {props.label}
      </label>
      <input
        id={`controller-${props.name}`}
        value={form[props.name]}
        onChange={(e) => set(props.name, e.target.value)}
        className="mt-1 w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-[14px] text-[#F4F5F6]"
      />
      {props.hint ? <p className="mt-1 text-[11.5px] text-[#6E747A]">{props.hint}</p> : null}
    </div>
  );

  return (
    <section className="bg-[#0D0F11] border border-white/10 rounded-2xl p-6 shadow-panel-elevated">
      <div className="flex items-start gap-3 mb-4">
        <Landmark className="w-5 h-5 text-[#C9A227] mt-0.5" aria-hidden="true" />
        <div>
          <h3 className="text-lg font-bold text-[#F4F5F6]">{t('title')}</h3>
          <p className="text-[12.5px] text-[#6E747A] mt-1 max-w-2xl">{t('subtitle')}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {Field({ name: 'legalName', label: t('legal_name'), hint: t('legal_name_hint') })}
        </div>
        {Field({ name: 'street', label: t('street') })}
        {Field({ name: 'city', label: t('city') })}
        {Field({ name: 'postalCode', label: t('postal_code') })}
        {Field({ name: 'country', label: t('country') })}
        {Field({ name: 'repName', label: t('representative_name'), hint: t('representative_hint') })}
        {Field({ name: 'repEmail', label: t('representative_email') })}
        {Field({ name: 'controllerDpoName', label: t('dpo_name'), hint: t('dpo_hint') })}
        {Field({ name: 'controllerDpoEmail', label: t('dpo_email') })}
        <div className="sm:col-span-2">
          {Field({ name: 'processingCategories', label: t('processing_categories'), hint: t('processing_categories_hint') })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || update.isPending}
        className="mt-5 rounded-lg bg-[#C9A227] px-4 py-2 text-[13px] font-medium text-[#08090A] hover:bg-[#E5C463] disabled:opacity-40"
      >
        {update.isPending ? t('saving') : t('save')}
      </button>
    </section>
  );
}
