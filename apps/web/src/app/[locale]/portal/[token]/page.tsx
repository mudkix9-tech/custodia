// @ts-nocheck
'use client';

import { useParams } from 'next/navigation';
import { trpc } from '@/utils/trpc';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function ClientPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, error } = trpc.portal.getPortalData.useQuery(
    { token },
    { retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500/40"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full mx-4">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-gray-500">
            This compliance portal link is no longer active. Please contact your agency for a new link.
          </p>
        </div>
      </div>
    );
  }

  const primaryColor = (data.branding as any)?.primaryColor || '#4F46E5';
  const logoUrl = (data.branding as any)?.logoUrl;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt={data.orgName} className="h-8 object-contain" />
            ) : (
              <span className="text-xl font-bold text-gray-900">{data.orgName}</span>
            )}
            <div className="h-6 w-px bg-gray-300"></div>
            <span className="text-sm font-medium text-gray-500">Compliance Portal</span>
          </div>
          <div className="text-sm text-gray-500">
            Client: <span className="font-semibold text-gray-900">{data.clientName}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        
        {/* Score Card */}
        <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-8">
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="56" fill="none" stroke="#f3f4f6" strokeWidth="12" />
              <circle 
                cx="64" cy="64" r="56" fill="none" 
                stroke={primaryColor} strokeWidth="12" 
                strokeDasharray="351.86" 
                strokeDashoffset={351.86 - (351.86 * data.complianceScore) / 100}
                className="transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: primaryColor }}>{data.complianceScore}</span>
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Score</span>
            </div>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Compliance Posture</h2>
            <p className="text-gray-600">
              This dashboard provides a real-time overview of the data processing activities and vendor agreements maintained by <strong className="text-gray-900">{data.orgName}</strong> on behalf of <strong className="text-gray-900">{data.clientName}</strong>.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              Last updated: {new Date(data.lastUpdated).toLocaleDateString()}
            </div>
          </div>
        </section>

        {/* Processing Activities */}
        <section>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Record of Processing Activities (ROPA)</h3>
          {data.processingActivities.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center text-gray-500">
              No processing activities recorded.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/50 text-gray-600 border-b border-gray-100">
                  <tr>
                    <th className="py-4 px-6 font-medium">Activity</th>
                    <th className="py-4 px-6 font-medium">Lawful Basis</th>
                    <th className="py-4 px-6 font-medium">Data Categories</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.processingActivities.map((act, i) => (
                    <tr key={i} className="hover:bg-gray-50/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-medium text-gray-900">{act.name}</div>
                        <div className="text-gray-500 text-xs mt-1">{act.purpose}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                          {act.lawfulBasis.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600">{act.dataCategories || 'None specified'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Vendors */}
        <section>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Sub-Processors & Vendor Agreements</h3>
          {data.vendorDpaStatuses.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center text-gray-500">
              No vendors linked to your processing activities.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {data.vendorDpaStatuses.map((v, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div className="font-medium text-gray-900 mb-4">{v.name}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">DPA Status</span>
                    {v.dpaStatus === 'signed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Signed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500 gap-4">
          <div>
            Data processing dashboard managed by {data.orgName}
          </div>
          <Link href="https://custodia.io" target="_blank" className="hover:text-gray-900 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            Powered by Custodia
          </Link>
        </div>
      </footer>
    </div>
  );
}
