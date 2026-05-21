'use client';

import React, { useState } from 'react';

export function Step5InviteTeam({ onNext }: { onNext: (invites: any[]) => void }) {
  const [invites, setInvites] = useState([{ email: '', role: 'member' }]);

  const handleAdd = () => {
    if (invites.length < 5) {
      setInvites([...invites, { email: '', role: 'member' }]);
    }
  };

  const handleRemove = (index: number) => {
    setInvites(invites.filter((_, i) => i !== index));
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
    <div className="bg-white p-8 rounded-xl shadow-sm border max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Invite your team</h2>
        <p className="text-gray-500">Compliance is a team effort. Invite your colleagues to help manage privacy requests and data processing activities.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 mb-6">
          {invites.map((invite, index) => (
            <div key={index} className="flex gap-4">
              <input
                type="email"
                placeholder="colleague@example.com"
                value={invite.email}
                onChange={(e) => handleChange(index, 'email', e.target.value)}
                className="flex-1 px-4 py-2 border rounded-md"
              />
              <select
                value={invite.role}
                onChange={(e) => handleChange(index, 'role', e.target.value)}
                className="w-32 px-3 py-2 border rounded-md bg-gray-50"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              {invites.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="text-gray-400 hover:text-red-500 p-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {invites.length < 5 && (
          <button
            type="button"
            onClick={handleAdd}
            className="text-blue-600 font-medium text-sm flex items-center hover:text-blue-800 mb-8"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            Add another team member
          </button>
        )}

        <div className="bg-blue-50 p-4 rounded-lg mb-8 text-sm text-blue-800">
          <p className="font-medium mb-1">Why invite your team?</p>
          <ul className="list-disc pl-5 space-y-1">
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
            className="bg-blue-600 text-white font-medium py-2 px-8 rounded-md hover:bg-blue-700 transition"
          >
            Send invitations
          </button>
        </div>
      </form>
    </div>
  );
}
