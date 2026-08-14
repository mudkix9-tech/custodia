"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/utils/trpc';
import { MapPin, Database, ShieldAlert } from 'lucide-react';
import React from 'react';
import { useSession } from 'next-auth/react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import Link from 'next/link';

const REGIONS = [
  { id: 'eu-west-1', name: 'Dublin (Ireland)', isDefault: true },
  { id: 'eu-central-1', name: 'Frankfurt (Germany /* eslint-disable-line @typescript-eslint/no-explicit-any */)', isDefault: false },
  { id: 'eu-west-3', name: 'Paris (France)', isDefault: false },
  { id: 'eu-north-1', name: 'Stockholm (Sweden)', isDefault: false },
];

export default function DataResidencyPage() {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [selectedRegion, setSelectedRegion] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const { data: orgData, isLoading } = trpc.settings.getResidencyData.useQuery(undefined, {
    enabled: !!session?.user
  });

  const utils = trpc.useUtils();
  const updateResidency = trpc.settings.updateResidency.useMutation({
    onSuccess: () => {
      utils.settings.getResidencyData.invalidate();
      setIsConfirming(false);
    }
  });

  if (isLoading || !orgData) return <div>Loading...</div>;

  const isEnterprise = (session?.user as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)?.tier === 'enterprise';
  const currentRegion = REGIONS.find(r => r.id === (orgData.dataRegion || 'eu-west-1'));

  const handleMigrate = async () => {
    const ok = await confirm({
      title: `Migrate data to ${selectedRegion}?`,
      description:
        'The migration takes 15-30 minutes. Your organisation is placed in read-only mode for the whole of it, so nobody can record a breach or respond to a DSAR until it finishes.',
      confirmText: 'Start migration',
      variant: 'destructive',
    });
    if (ok) updateResidency.mutate({ region: selectedRegion });
  };

  return (
    <div className="mx-auto max-w-[1040px] px-8 pt-10 pb-24 rise-in">
      {confirmDialog}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-set-fg">Data Residency</h1>
        <p className="text-set-fg-subtle mt-1">Control where your data is physically stored and processed.</p>
      </div>

      {!isEnterprise ? (
        <div className="bg-set-gold/10 border border-set-gold/30 rounded-xl p-6 flex gap-4">
          <ShieldAlert className="w-6 h-6 text-set-gold shrink-0" />
          <div>
            <h3 className="font-medium text-set-fg">Enterprise Feature</h3>
            <p className="text-sm text-set-fg-muted mt-1">
              Dedicated data residency is available on the Enterprise plan. Your data is currently stored securely in AWS Dublin (eu-west-1) in a multi-tenant environment.
            </p>
            <Link href="/settings/billing" className="mt-4 inline-block px-4 py-2 rounded-lg text-sm font-semibold bg-set-gold text-[#0A0A0A] hover:bg-set-gold-hi transition-colors">Upgrade to Enterprise</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Current Status */}
          <div className="rounded-xl border border-set-line bg-set-panel shadow-panel-elevated overflow-hidden">
            <div className="p-6 border-b border-set-line">
              <h2 className="text-[14.5px] font-semibold tracking-[-0.005em]">Current Status</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-set-sunken rounded-lg">
                  <MapPin className="w-6 h-6 text-set-fg-muted" />
                </div>
                <div>
                  <div className="text-sm text-set-fg-subtle">Region</div>
                  <div className="font-medium text-set-fg">{currentRegion?.name || 'Unknown'}</div>
                  <div className="text-xs text-set-fg-subtle mt-1">{orgData.dataRegion || 'eu-west-1'}</div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-set-sunken rounded-lg">
                  <Database className="w-6 h-6 text-set-fg-muted" />
                </div>
                <div>
                  <div className="text-sm text-set-fg-subtle">Database Type</div>
                  <div className="font-medium text-set-fg">
                    {orgData.dedicatedDatabaseStatus === 'active' ? 'Dedicated Instance' : 'Shared Cluster'}
                  </div>
                  {orgData.dedicatedDatabaseStatus === 'active' && (
                    <div className="text-xs text-set-ok mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-set-ok/120 inline-block"></span>
                      Active & Encrypted
                    </div>
                  )}
                  {orgData.dedicatedDatabaseStatus === 'provisioning' && (
                    <div className="text-xs text-amber-400 mt-1">Provisioning (can take up to 15m)...</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Migration UI */}
          <div className="rounded-xl border border-set-line bg-set-panel shadow-panel-elevated overflow-hidden">
            <div className="p-6 border-b border-set-line">
              <h2 className="text-[14.5px] font-semibold tracking-[-0.005em]">Change Region</h2>
              <p className="text-sm text-set-fg-subtle mt-1">
                Select a new region to provision a dedicated database and migrate your data.
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {REGIONS.map(region => (
                  <div
                    key={region.id}
                    onClick={() => {
                      if (region.id !== orgData.dataRegion && orgData.dedicatedDatabaseStatus !== 'provisioning') {
                        setSelectedRegion(region.id);
                      }
                    }}
                    className={`border p-4 rounded-xl cursor-pointer transition-colors ${
                      region.id === orgData.dataRegion ? 'bg-set-sunken border-set-line-strong opacity-50 cursor-not-allowed' :
                      selectedRegion === region.id ? 'border-set-gold bg-set-gold/10 ring-1 ring-set-gold/40' :
                      'border-set-line hover:border-set-line-strong'
                    }`}
                  >
                    <div className="font-medium text-set-fg">{region.name}</div>
                    <div className="text-sm text-set-fg-subtle mt-1">{region.id}</div>
                    {region.id === orgData.dataRegion && (
                      <span className="inline-block mt-2 text-xs font-medium bg-white/10 text-set-fg px-2 py-1 rounded">Current Region</span>
                    )}
                  </div>
                ))}
              </div>

              {selectedRegion && selectedRegion !== orgData.dataRegion && (
                <div className="bg-amber-500/10 p-4 rounded-lg border border-amber-900/50 text-sm text-amber-300">
                  <strong>Important:</strong> Changing your region will provision a new dedicated PostgreSQL instance in {REGIONS.find(r => r.id === selectedRegion)?.name}. Your existing data will be migrated, which can take several minutes. Your organization will be placed in read-only mode during this time.

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setSelectedRegion('')}
                      className="px-4 py-2 border border-amber-500/30 rounded text-amber-300 hover:bg-amber-500/15 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMigrate}
                      disabled={updateResidency.isPending}
                      className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 font-medium disabled:opacity-50"
                    >
                      {updateResidency.isPending ? 'Starting Migration...' : 'Confirm & Start Migration'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-set-sunken p-6 border-t border-set-line text-sm text-set-fg-muted">
              <h4 className="font-medium text-set-fg mb-2">Infrastructure Details</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Dedicated PostgreSQL 16 instance, Multi-AZ.</li>
                <li>Encrypted at rest using AWS KMS.</li>
                <li>Automated daily backups retained for 7 days.</li>
                <li>Documents and attachments stored in regional S3 buckets.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
