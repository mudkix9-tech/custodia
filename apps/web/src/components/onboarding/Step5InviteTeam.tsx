'use client';

import React, { useState } from 'react';

interface Step5Props {
  onNext: (invites: any[]) => void;
  companySize?: string;
}

export function Step5InviteTeam({ onNext, companySize }: Step5Props) {
  const [invites, setInvites] = useState<{ email: string; role: string }[]>(() => {
    const isLarge = companySize && ['26-50', '51-100', '100+'].includes(companySize);
    return isLarge
      ? [
          { email: '', role: 'member' },
          { email: '', role: 'member' },
          { email: '', role: 'member' },
        ]
      : [{ email: '', role: 'member' }];
  });

  const handleAdd = () => {
    if (invites.length < 10) {
      setInvites([...invites, { email: '', role: 'member' }]);
    }
  };

  const handleRemove = (index: number) => {
    if (invites.length <= 1) {
      setInvites([{ email: '', role: 'member' }]);
    } else {
      setInvites(invites.filter((_, i) => i !== index));
    }
  };

  const handleChange = (index: number, field: string, value: string) => {
    const newInvites = [...invites];
    newInvites[index] = { ...newInvites[index], [field]: value };
    setInvites(newInvites);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validInvites = invites.filter(i => i.email.trim() !== '');
    onNext(validInvites);
  };

  return (
    <div className="bg-[#0D0F11] p-8 rounded-xl shadow-panel-elevated border max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Invite your team</h2>
        <p className="text-gray-500">Compliance is a team effort. Invite your colleagues to help manage privacy requests and data processing activities.</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Workspace Owner Context Indicator */}
        <div className="mb-6 p-3 bg-gray-50 border border-gray-200/60 rounded-xl text-xs text-gray-600 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500/100 shrink-0"></span>
          <span>You are logged in as the <strong>Workspace Owner</strong>. Invites will be sent to the colleagues below.</span>
        </div>

        <div className="space-y-3 mb-6">
          {invites.map((invite, index) => (
            <div key={index} className="flex gap-3 items-center">
              <input
                type="email"
                placeholder="colleague@example.com"
                value={invite.email}
                onChange={(e) => handleChange(index, 'email', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={invite.role}
                onChange={(e) => handleChange(index, 'role', e.target.value)}
                className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-[#0D0F11] font-normal text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="text-gray-400 hover:text-red-500 p-2 transition-colors shrink-0"
                title={invites.length <= 1 ? 'Clear row' : 'Remove row'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          ))}
        </div>

        {invites.length < 10 && (
          <button
            type="button"
            onClick={handleAdd}
            className="text-blue-400 font-semibold text-sm flex items-center hover:text-blue-800 mb-8 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Add another team member
          </button>
        )}

        <div className="bg-blue-500/10 p-4 border border-blue-900/50 rounded-xl mb-8 text-sm text-blue-800">
          <p className="font-semibold mb-1">Why invite your team?</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Everyone can report data breaches (72-hour deadline requires fast response)</li>
            <li>Team members can complete mandatory GDPR training</li>
            <li>Audit trail shows individual accountability</li>
          </ul>
        </div>

        <div className="flex justify-between items-center border-t pt-6">
          <button
            type="button"
            onClick={() => onNext([])}
            className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2"
          >
            Skip for now
          </button>
          <button
            type="submit"
            className="bg-blue-600 text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-blue-700 transition"
          >
            Send invitations and continue
          </button>
        </div>
      </form>
    </div>
  );
}
