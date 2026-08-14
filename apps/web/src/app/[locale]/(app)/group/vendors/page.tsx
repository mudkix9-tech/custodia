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
          <Link href="/group" className="text-sm text-[#6E747A] hover:text-[#F4F5F6] transition-colors">Group Dashboard</Link>
          <span className="text-[#6E747A]">/</span>
          <span className="text-sm font-medium text-[#F4F5F6]">Cross-Entity Vendors</span>
        </div>
        <h1 className="text-2xl font-serif text-[#F4F5F6]">Group Vendor Consistency</h1>
        <p className="mt-2 text-sm text-[#6E747A]">Identify gaps in DPA status for vendors used across multiple entities in your group.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#0D0F11] hairline p-6 rounded-xl flex flex-col shadow-panel-elevated">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-[#6E747A]" />
            <div className="text-sm font-medium text-[#E6E8EA]">Shared Vendors</div>
          </div>
          <div className="text-3xl font-medium text-[#F4F5F6]">{vendorsData?.length || 0}</div>
          <div className="text-xs text-[#6E747A] mt-1">Vendors used by 2+ entities</div>
        </div>
        
        <div className="bg-[#0D0F11] hairline p-6 rounded-xl flex flex-col shadow-panel-elevated border border-transparent hover:border-amber-900/50 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div className="text-sm font-medium text-amber-400">Inconsistencies</div>
          </div>
          <div className="text-3xl font-medium text-amber-400">{totalInconsistencies}</div>
          <div className="text-xs text-amber-400/70 mt-1">Vendors with mismatched DPA status</div>
        </div>
      </div>

      <div className="bg-[#0D0F11] hairline rounded-xl shadow-panel-elevated overflow-hidden mb-8">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#08090A]/50">
          <h2 className="text-lg font-medium text-[#F4F5F6]">Cross-Entity Vendor Breakdown</h2>
        </div>
        <div className="divide-y divide-white/10">
          <div className="grid grid-cols-12 gap-4 p-4 bg-[#08090A] text-xs font-medium text-[#6E747A] uppercase tracking-wider">
            <div className="col-span-4">Vendor</div>
            <div className="col-span-2 text-center">Usage</div>
            <div className="col-span-3">Status</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          
          {vendorsData?.length === 0 && (
            <div className="p-8 text-center text-[#6E747A] text-sm">
              No vendors are shared across multiple entities in this group.
            </div>
          )}

          {vendorsData?.map((vendor: any) => {
            const signedCount = vendor.entityDetails.filter((e: any) => e.dpaStatus === 'signed').length;
            const missingCount = vendor.entityDetails.length - signedCount;
            const isExpanded = expandedVendor === vendor.vendorId;

            return (
              <React.Fragment key={vendor.vendorId}>
                <div className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors ${vendor.inconsistent ? 'bg-amber-500/30 hover:bg-amber-500/60' : 'hover:bg-[#08090A]'}`}>
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-[#9BA1A6] font-medium text-sm">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-[#F4F5F6]">{vendor.vendorName}</div>
                      {vendor.inconsistent && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-amber-400 font-medium">
                          <AlertTriangle className="w-3 h-3" /> Inconsistent Posture
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="col-span-2 text-center text-sm text-[#E6E8EA]">
                    Used by {vendor.usedByCount} entities
                  </div>

                  <div className="col-span-3 text-sm">
                    {vendor.inconsistent ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 text-[#C9A227] font-medium"><CheckCircle2 className="w-3.5 h-3.5"/> {signedCount} Signed</span>
                        <span className="inline-flex items-center gap-1 text-red-400 font-medium"><XCircle className="w-3.5 h-3.5"/> {missingCount} Missing</span>
                      </div>
                    ) : (
                      signedCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/30">
                          Consistently Signed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-900/50">
                          Consistently Missing
                        </span>
                      )
                    )}
                  </div>

                  <div className="col-span-3 flex justify-end">
                    <button
                      onClick={() => setExpandedVendor(isExpanded ? null : vendor.vendorId)}
                      className="px-3 py-1.5 bg-[#0D0F11] hover:bg-white/5 text-[#E6E8EA] rounded-lg text-sm font-medium transition-colors border border-bone-300 shadow-panel-elevated"
                    >
                      {isExpanded ? 'Hide Details' : 'Compare Entities'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="col-span-12 bg-[#08090A]/50 p-4 border-b border-white/10">
                    <div className="rounded-lg border border-white/10 bg-[#0D0F11] overflow-hidden shadow-panel-elevated">
                      <table className="min-w-full divide-y divide-white/10">
                        <thead className="bg-[#08090A]">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#6E747A] uppercase tracking-wider">Entity</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#6E747A] uppercase tracking-wider">DPA Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[#6E747A] uppercase tracking-wider">Risk Score</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-[#6E747A] uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-[#0D0F11] divide-y divide-white/10">
                          {vendor.entityDetails.map((detail: any, idx: number) => (
                            <tr key={idx} className={vendor.inconsistent && detail.dpaStatus !== 'signed' ? 'bg-red-500/20' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#F4F5F6]">
                                {detail.orgName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {detail.dpaStatus === 'signed' ? (
                                  <span className="inline-flex items-center gap-1 text-[#C9A227]"><CheckCircle2 className="w-4 h-4"/> Signed</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-400"><XCircle className="w-4 h-4"/> Missing</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#6E747A]">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium
                                    ${detail.riskLevel === 'critical' ? 'bg-red-500/20 text-red-400' : 
                                      detail.riskLevel === 'high' ? 'bg-amber-500/15 text-amber-400' : 
                                      detail.riskLevel === 'medium' ? 'bg-blue-100 text-blue-400' : 
                                      'bg-[#C9A227]/15 text-[#C9A227]'}`}>
                                    {detail.riskLevel || 'unknown'}
                                  </span>
                                  <span className="text-xs text-[#6E747A]">({detail.riskScore})</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <Link href={`/vendors/${vendor.vendorId}`} className="text-[#6E747A] hover:text-[#F4F5F6]" onClick={() => {
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
