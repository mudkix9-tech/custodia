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
        <div className="w-8 h-8 rounded-full border-2 border-sage-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (orgSettings?.subscriptionTier !== 'enterprise') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-ink-900/10 p-8 text-center shadow-sm">
          <LifeBuoy className="w-12 h-12 text-ink-300 mx-auto mb-4" />
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Enterprise Support</h1>
          <p className="text-ink-600 mb-6 max-w-md mx-auto">
            Priority support is available exclusively for Enterprise customers.
            Upgrade your plan to get guaranteed SLAs and a dedicated account manager.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 bg-sage-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-sage-700 transition-colors"
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
        <h1 className="text-2xl font-serif text-ink-900">Priority Support</h1>
        <p className="text-sm text-ink-600 mt-1">
          Exclusive enterprise support tier with guaranteed SLAs and dedicated account management.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* SLA Card */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-ink-900">
            <Clock className="w-5 h-5 text-sage-600" />
            <h2 className="text-lg font-medium">SLA Tracking</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-ink-900/5">
              <span className="text-sm text-ink-600">Critical Issues</span>
              <span className="text-sm font-medium text-ink-900">4 hours</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-ink-600">Standard Issues</span>
              <span className="text-sm font-medium text-ink-900">24 hours</span>
            </div>
            <div className="mt-4 pt-4 border-t border-ink-900/5">
              <div className="text-xs text-sage-700 bg-sage-50 px-2 py-1.5 rounded inline-block font-medium">
                Current Status: Meeting all SLAs
              </div>
            </div>
          </div>
        </div>

        {/* Account Manager Card */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-ink-900">
            <MessagesSquare className="w-5 h-5 text-sage-600" />
            <h2 className="text-lg font-medium">Account Manager</h2>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-bone-100 flex items-center justify-center text-ink-500 font-medium text-lg">
              JS
            </div>
            <div>
              <div className="font-medium text-ink-900">Jane Smith</div>
              <div className="text-sm text-ink-500">jane.smith@trycustodia.online</div>
            </div>
          </div>
          <a
            href="mailto:jane.smith@trycustodia.online"
            className="w-full flex items-center justify-center gap-2 bg-bone-50 text-ink-700 hover:bg-bone-100 border border-ink-900/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Email Jane
          </a>
          <a
            href="#"
            className="w-full mt-2 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Open Slack Connect
          </a>
        </div>

        {/* QBR Card */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-ink-900">
            <Calendar className="w-5 h-5 text-sage-600" />
            <h2 className="text-lg font-medium">Business Review</h2>
          </div>
          <div className="mb-4">
            <div className="text-sm text-ink-600 mb-1">Next Scheduled QBR</div>
            <div className="font-medium text-ink-900">{format(nextQbrDate, 'MMMM d, yyyy')}</div>
          </div>
          <button className="w-full bg-sage-600 text-white hover:bg-sage-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Generate Pre-read PDF
          </button>
          <p className="text-xs text-ink-400 mt-3 text-center">
            PDF includes your latest compliance data and customized recommendations.
          </p>
        </div>
      </div>

      {/* Open Tickets */}
      <div className="bg-white rounded-2xl border border-ink-900/10 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-ink-900/10 flex justify-between items-center">
          <h2 className="text-lg font-medium text-ink-900">Recent Tickets</h2>
          <button className="text-sm bg-bone-50 hover:bg-bone-100 text-ink-700 px-3 py-1.5 rounded-lg border border-ink-900/10 font-medium transition-colors">
            New Ticket
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bone-50 text-ink-500 font-medium border-b border-ink-900/10">
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
                <tr key={ticket.id} className="hover:bg-bone-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-ink-500">{ticket.id}</td>
                  <td className="px-6 py-4 font-medium text-ink-900">{ticket.subject}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${ticket.status === 'Open' ? 'bg-amber-100 text-amber-800' :
                        ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-sage-100 text-sage-800'}`}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-ink-600">{ticket.priority}</span>
                  </td>
                  <td className="px-6 py-4 text-ink-500">
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
