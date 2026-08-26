'use client';

/**
 * JSON import form for the legacy gatherer's output.
 *
 * The audit measured the legacy pipeline's yield by counting JSON files.
 * `seed-data/vendors.json` and `seed-data/pending-review.json` are still on
 * disk; this is what puts them in the review queue instead of on the
 * filesystem. Server caps the body at 4 MB and slices the file to 500
 * records; oversized files error with `BAD_REQUEST`.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/utils/trpc';

export function ImportJsonForm() {
  const t = useTranslations('vendors');
  const [json, setJson] = useState('');
  const utils = trpc.useUtils();

  const importMutation = trpc.vendorIntelligence.importJson.useMutation({
    onSuccess: () => {
      setJson('');
      void utils.vendorIntelligence.listCandidates.invalidate();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        importMutation.mutate({ json, source: 'pending' });
      }}
      className="mt-4 space-y-3"
    >
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='[{"name": "ClickUp", "website": "https://www.clickup.com", "provenance": {...}}]'
        className="h-40 w-full rounded-xl border border-white/10 bg-[#08090A] p-3 font-mono text-xs text-[#F4F5F6] focus:border-[#C9A227] focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#6E747A]">
          {importMutation.data
            ? t('intelligence.import_done', { count: importMutation.data.imported })
            : t('intelligence.import_help')}
        </p>
        <button
          type="submit"
          disabled={!json.trim() || importMutation.isPending}
          className="rounded-xl bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#08090A] disabled:opacity-50"
        >
          {importMutation.isPending ? t('intelligence.importing') : t('intelligence.import_button')}
        </button>
      </div>
      {importMutation.error ? (
        <p className="text-xs text-red-400">{importMutation.error.message}</p>
      ) : null}
    </form>
  );
}
