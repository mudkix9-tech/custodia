"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { MapPin, Database, ShieldAlert } from 'lucide-react';
import React from 'react';
import { useSession } from 'next-auth/react';

const REGIONS = [
  { id: 'eu-west-1', name: 'Dublin (Ireland)', isDefault: true },
  { id: 'eu-central-1', name: 'Frankfurt (Germany /* eslint-disable-line @typescript-eslint/no-explicit-any */)', isDefault: false },
  { id: 'eu-west-3', name: 'Paris (France)', isDefault: false },
  { id: 'eu-north-1', name: 'Stockholm (Sweden)', isDefault: false },
];

export default function DataResidencyPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [selectedRegion, setSelectedRegion] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const { data: orgData, isLoading } = useQuery({
    queryKey: ['orgResidency'],
    queryFn: () => trpc.settings.getResidencyData.query(),
    enabled: !!session?.user
  });

  const updateResidency = useMutation({
    mutationFn: (data: { region: string }) => trpc.settings.updateResidency.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgResidency'] });
      setIsConfirming(false);
    }
  });

  if (isLoading || !orgData) return <div>Loading...</div>;

  const isEnterprise = (session?.user as any /* eslint-disable-line @typescript-eslint/no-explicit-any */)?.tier === 'enterprise';
  const currentRegion = REGIONS.find(r => r.id === (orgData.dataRegion || 'eu-west-1'));

  const handleMigrate = () => {
    if (confirm(`Are you sure you want to migrate your data to ${selectedRegion}? This process can take 15-30 minutes and your org will be placed in read-only mode during migration.`)) {
      updateResidency.mutate({ region: selectedRegion });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-ink-900">Data Residency</h1>
        <p className="text-ink-500 mt-1">Control where your data is physically stored and processed.</p>
      </div>

      {!isEnterprise ? (
        <div className="bg-sage-50 border border-sage-200 rounded-xl p-6 flex gap-4">
          <ShieldAlert className="w-6 h-6 text-sage-600 shrink-0" />
          <div>
            <h3 className="font-medium text-sage-900">Enterprise Feature</h3>
            <p className="text-sm text-sage-700 mt-1">
              Dedicated data residency is available on the Enterprise plan. Your data is currently stored securely in AWS Dublin (eu-west-1) in a multi-tenant environment.
            </p>
            <button className="mt-4 px-4 py-2 bg-sage-600 text-white rounded-lg text-sm font-medium">Upgrade to Enterprise</button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Current Status */}
          <div className="bg-white rounded-xl border border-ink-900/10 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-ink-900/10">
              <h2 className="text-lg font-medium">Current Status</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-ink-50 rounded-lg">
                  <MapPin className="w-6 h-6 text-ink-600" />
                </div>
                <div>
                  <div className="text-sm text-ink-500">Region</div>
                  <div className="font-medium text-ink-900">{currentRegion?.name || 'Unknown'}</div>
                  <div className="text-xs text-ink-400 mt-1">{orgData.dataRegion || 'eu-west-1'}</div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-ink-50 rounded-lg">
                  <Database className="w-6 h-6 text-ink-600" />
                </div>
                <div>
                  <div className="text-sm text-ink-500">Database Type</div>
                  <div className="font-medium text-ink-900">
                    {orgData.dedicatedDatabaseStatus === 'active' ? 'Dedicated Instance' : 'Shared Cluster'}
                  </div>
                  {orgData.dedicatedDatabaseStatus === 'active' && (
                    <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                      Active & Encrypted
                    </div>
                  )}
                  {orgData.dedicatedDatabaseStatus === 'provisioning' && (
                    <div className="text-xs text-amber-600 mt-1">Provisioning (can take up to 15m)...</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Migration UI */}
          <div className="bg-white rounded-xl border border-ink-900/10 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-ink-900/10">
              <h2 className="text-lg font-medium">Change Region</h2>
              <p className="text-sm text-ink-500 mt-1">
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
                      region.id === orgData.dataRegion ? 'bg-ink-50 border-ink-900/20 opacity-50 cursor-not-allowed' :
                      selectedRegion === region.id ? 'border-sage-500 bg-sage-50 ring-1 ring-sage-500' :
                      'border-ink-900/10 hover:border-ink-900/30'
                    }`}
                  >
                    <div className="font-medium text-ink-900">{region.name}</div>
                    <div className="text-sm text-ink-500 mt-1">{region.id}</div>
                    {region.id === orgData.dataRegion && (
                      <span className="inline-block mt-2 text-xs font-medium bg-ink-200 text-ink-700 px-2 py-1 rounded">Current Region</span>
                    )}
                  </div>
                ))}
              </div>

              {selectedRegion && selectedRegion !== orgData.dataRegion && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-sm text-amber-800">
                  <strong>Important:</strong> Changing your region will provision a new dedicated PostgreSQL instance in {REGIONS.find(r => r.id === selectedRegion)?.name}. Your existing data will be migrated, which can take several minutes. Your organization will be placed in read-only mode during this time.

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setSelectedRegion('')}
                      className="px-4 py-2 border border-amber-300 rounded text-amber-800 hover:bg-amber-100 font-medium"
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

            <div className="bg-ink-50 p-6 border-t border-ink-900/10 text-sm text-ink-600">
              <h4 className="font-medium text-ink-900 mb-2">Infrastructure Details</h4>
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
