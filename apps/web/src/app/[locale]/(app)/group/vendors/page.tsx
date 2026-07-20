// @ts-nocheck
"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import Link from 'next/link';
import { Building2, AlertTriangle, CheckCircle2, XCircle, FileText, Activity } from 'lucide-react';

export default function GroupVendorConsistencyPage() {
  const { data: vendorsData, isLoading } = trpc.group.getGroupVendorConsistency.useQuery();
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  if (isLoading) return <div className="p-8">Loading Vendor Consistency...</div>;

  const totalInconsistencies = vendorsData?.filter((v: any) => v.inconsistent).length || 0;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/group" className="text-sm text-ink-500 hover:text-ink-900 transition-colors">Group Dashboard</Link>
          <span className="text-ink-400">/</span>
          <span className="text-sm font-medium text-ink-900">Cross-Entity Vendors</span>
        </div>
        <h1 className="text-2xl font-serif text-ink-900">Group Vendor Consistency</h1>
        <p className="mt-2 text-sm text-ink-500">Identify gaps in DPA status for vendors used across multiple entities in your group.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white hairline p-6 rounded-xl flex flex-col shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-ink-400" />
            <div className="text-sm font-medium text-ink-700">Shared Vendors</div>
          </div>
          <div className="text-3xl font-medium text-ink-900">{vendorsData?.length || 0}</div>
          <div className="text-xs text-ink-500 mt-1">Vendors used by 2+ entities</div>
        </div>
        
        <div className="bg-white hairline p-6 rounded-xl flex flex-col shadow-sm border border-transparent hover:border-amber-200 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div className="text-sm font-medium text-amber-700">Inconsistencies</div>
          </div>
          <div className="text-3xl font-medium text-amber-600">{totalInconsistencies}</div>
          <div className="text-xs text-amber-600/70 mt-1">Vendors with mismatched DPA status</div>
        </div>
      </div>

      <div className="bg-white hairline rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-ink-100 flex justify-between items-center bg-bone-50/50">
          <h2 className="text-lg font-medium text-ink-900">Cross-Entity Vendor Breakdown</h2>
        </div>
        <div className="divide-y divide-ink-100">
          <div className="grid grid-cols-12 gap-4 p-4 bg-bone-50 text-xs font-medium text-ink-500 uppercase tracking-wider">
            <div className="col-span-4">Vendor</div>
            <div className="col-span-2 text-center">Usage</div>
            <div className="col-span-3">Status</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          
          {vendorsData?.length === 0 && (
            <div className="p-8 text-center text-ink-500 text-sm">
              No vendors are shared across multiple entities in this group.
            </div>
          )}

          {vendorsData?.map((vendor: any) => {
            const signedCount = vendor.entityDetails.filter((e: any) => e.dpaStatus === 'signed').length;
            const missingCount = vendor.entityDetails.length - signedCount;
            const isExpanded = expandedVendor === vendor.vendorId;

            return (
              <React.Fragment key={vendor.vendorId}>
                <div className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors ${vendor.inconsistent ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-bone-50'}`}>
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-ink-100 flex items-center justify-center text-ink-600 font-medium text-sm">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-ink-900">{vendor.vendorName}</div>
                      {vendor.inconsistent && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 font-medium">
                          <AlertTriangle className="w-3 h-3" /> Inconsistent Posture
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="col-span-2 text-center text-sm text-ink-700">
                    Used by {vendor.usedByCount} entities
                  </div>

                  <div className="col-span-3 text-sm">
                    {vendor.inconsistent ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 text-sage-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5"/> {signedCount} Signed</span>
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium"><XCircle className="w-3.5 h-3.5"/> {missingCount} Missing</span>
                      </div>
                    ) : (
                      signedCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sage-50 text-sage-700 border border-sage-200">
                          Consistently Signed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                          Consistently Missing
                        </span>
                      )
                    )}
                  </div>

                  <div className="col-span-3 flex justify-end">
                    <button
                      onClick={() => setExpandedVendor(isExpanded ? null : vendor.vendorId)}
                      className="px-3 py-1.5 bg-white hover:bg-bone-100 text-ink-700 rounded-lg text-sm font-medium transition-colors border border-bone-300 shadow-sm"
                    >
                      {isExpanded ? 'Hide Details' : 'Compare Entities'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="col-span-12 bg-bone-50/50 p-4 border-b border-ink-100">
                    <div className="rounded-lg border border-ink-200 bg-white overflow-hidden shadow-sm">
                      <table className="min-w-full divide-y divide-ink-200">
                        <thead className="bg-bone-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Entity</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">DPA Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-500 uppercase tracking-wider">Risk Score</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-ink-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-ink-100">
                          {vendor.entityDetails.map((detail: any, idx: number) => (
                            <tr key={idx} className={vendor.inconsistent && detail.dpaStatus !== 'signed' ? 'bg-red-50/20' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ink-900">
                                {detail.orgName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {detail.dpaStatus === 'signed' ? (
                                  <span className="inline-flex items-center gap-1 text-sage-600"><CheckCircle2 className="w-4 h-4"/> Signed</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4"/> Missing</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium
                                    ${detail.riskLevel === 'critical' ? 'bg-red-100 text-red-700' : 
                                      detail.riskLevel === 'high' ? 'bg-amber-100 text-amber-700' : 
                                      detail.riskLevel === 'medium' ? 'bg-blue-100 text-blue-700' : 
                                      'bg-sage-100 text-sage-700'}`}>
                                    {detail.riskLevel || 'unknown'}
                                  </span>
                                  <span className="text-xs text-ink-400">({detail.riskScore})</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <Link href={`/vendors/${vendor.vendorId}`} className="text-ink-500 hover:text-ink-900" onClick={() => {
                                  // In a real app, this would use a context switcher or pass the target org header
                                  // For now, we simulate navigating to the vendor profile in that org's context
                                  document.cookie = `targetOrgId=${detail.orgId}; path=/;`;
                                }}>
                                  View Profile <span aria-hidden="true">&rarr;</span>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
