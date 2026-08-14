"use client";

import React from 'react';
import { trpc } from '@/utils/trpc';
import { Clock, MessagesSquare, Calendar, ExternalLink, LifeBuoy } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

export default function EnterpriseSupportPage() {
  const { data: orgSettings, isLoading } = trpc.settings.getOrgSettings.useQuery();

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#C9A227] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (orgSettings?.subscriptionTier !== 'enterprise') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-8 text-center shadow-panel-elevated">
          <LifeBuoy className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-2">Enterprise Support</h1>
          <p className="text-[#9BA1A6] mb-6 max-w-md mx-auto">
            Priority support is available exclusively for Enterprise customers.
            Upgrade your plan to get guaranteed SLAs and a dedicated account manager.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] px-4 py-2 rounded-lg font-medium hover:bg-[#E5C463] transition-colors"
          >
            Manage Subscription
          </Link>
        </div>
      </div>
    );
  }

  // Mock data for enterprise support
  const nextQbrDate = new Date();
  nextQbrDate.setMonth(nextQbrDate.getMonth() + 2);

  const now = new Date();
  const mockTickets = [
    { id: 'TKT-1042', subject: 'Custom DPA template formatting', status: 'Open', priority: 'Standard', lastUpdated: now },
    { id: 'TKT-1038', subject: 'SSO provider configuration assistance', status: 'In Progress', priority: 'High', lastUpdated: new Date(now.getTime() - 86400000) },
    { id: 'TKT-0985', subject: 'Vendor bulk import issue', status: 'Closed', priority: 'Standard', lastUpdated: new Date(now.getTime() - 86400000 * 5) },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-serif text-[#F4F5F6]">Priority Support</h1>
        <p className="text-sm text-[#9BA1A6] mt-1">
          Exclusive enterprise support tier with guaranteed SLAs and dedicated account management.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* SLA Card */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-3 mb-4 text-[#F4F5F6]">
            <Clock className="w-5 h-5 text-[#C9A227]" />
            <h2 className="text-lg font-medium">SLA Tracking</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-sm text-[#9BA1A6]">Critical Issues</span>
              <span className="text-sm font-medium text-[#F4F5F6]">4 hours</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#9BA1A6]">Standard Issues</span>
              <span className="text-sm font-medium text-[#F4F5F6]">24 hours</span>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-xs text-[#C9A227] bg-[#C9A227]/10 px-2 py-1.5 rounded inline-block font-medium">
                Current Status: Meeting all SLAs
              </div>
            </div>
          </div>
        </div>

        {/* Account Manager Card */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-3 mb-4 text-[#F4F5F6]">
            <MessagesSquare className="w-5 h-5 text-[#C9A227]" />
            <h2 className="text-lg font-medium">Account Manager</h2>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#6E747A] font-medium text-lg">
              JS
            </div>
            <div>
              <div className="font-medium text-[#F4F5F6]">Jane Smith</div>
              <div className="text-sm text-[#6E747A]">jane.smith@trycustodia.online</div>
            </div>
          </div>
          <a
            href="mailto:jane.smith@trycustodia.online"
            className="w-full flex items-center justify-center gap-2 bg-[#08090A] text-[#E6E8EA] hover:bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Email Jane
          </a>
          <a
            href="#"
            className="w-full mt-2 flex items-center justify-center gap-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-100 border border-indigo-900/50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Open Slack Connect
          </a>
        </div>

        {/* QBR Card */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-3 mb-4 text-[#F4F5F6]">
            <Calendar className="w-5 h-5 text-[#C9A227]" />
            <h2 className="text-lg font-medium">Business Review</h2>
          </div>
          <div className="mb-4">
            <div className="text-sm text-[#9BA1A6] mb-1">Next Scheduled QBR</div>
            <div className="font-medium text-[#F4F5F6]">{format(nextQbrDate, 'MMMM d, yyyy')}</div>
          </div>
          <button className="w-full bg-[#C9A227] hover:bg-[#E5C463] text-[#08090A] px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Generate Pre-read PDF
          </button>
          <p className="text-xs text-[#6E747A] mt-3 text-center">
            PDF includes your latest compliance data and customized recommendations.
          </p>
        </div>
      </div>

      {/* Open Tickets */}
      <div className="bg-[#0D0F11] rounded-2xl border border-white/10 shadow-panel-elevated overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-lg font-medium text-[#F4F5F6]">Recent Tickets</h2>
          <button className="text-sm bg-[#08090A] hover:bg-white/5 text-[#E6E8EA] px-3 py-1.5 rounded-lg border border-white/10 font-medium transition-colors">
            New Ticket
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#08090A] text-[#6E747A] font-medium border-b border-white/10">
              <tr>
                <th className="px-6 py-3">Ticket ID</th>
                <th className="px-6 py-3">Subject</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-900/10">
              {mockTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-[#08090A]/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-[#6E747A]">{ticket.id}</td>
                  <td className="px-6 py-4 font-medium text-[#F4F5F6]">{ticket.subject}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${ticket.status === 'Open' ? 'bg-amber-500/15 text-amber-800' :
                        ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-[#C9A227]/15 text-[#C9A227]'}`}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[#9BA1A6]">{ticket.priority}</span>
                  </td>
                  <td className="px-6 py-4 text-[#6E747A]">
                    {format(ticket.lastUpdated, 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
