'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <div className="bg-[#0D0F11] p-8 rounded-xl shadow-panel-elevated border border-white/10 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-serif text-[#F4F5F6] mb-2">Invite your team</h2>
        <p className="text-[#6E747A]">Compliance is a team effort. Invite your colleagues to help manage privacy requests and data processing activities.</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Workspace Owner Context Indicator */}
        <div className="mb-6 p-3 bg-[#08090A] border border-white/10 rounded-xl text-xs text-[#E6E8EA] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#C9A227] shrink-0"></span>
          <span>You are logged in as the <strong>Workspace Owner</strong>. Invites will be sent to the colleagues below.</span>
        </div>

        <div className="space-y-3 mb-6">
          {invites.map((invite, index) => (
            <div key={index} className="flex gap-3 items-center">
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={invite.email}
                onChange={(e) => handleChange(index, 'email', e.target.value)}
                className="flex-1"
              />
              <Select
                value={invite.role}
                onValueChange={(value) => handleChange(index, 'role', value)}
              >
                <SelectTrigger className="w-32 bg-[#0D0F11]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => handleRemove(index)}
                className="text-[#6E747A] hover:text-red-400 shrink-0"
                title={invites.length <= 1 ? 'Clear row' : 'Remove row'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </Button>
            </div>
          ))}
        </div>

        {invites.length < 10 && (
          <Button
            variant="ghost"
            type="button"
            onClick={handleAdd}
            className="text-[#C9A227] hover:text-[#C9A227]/80 hover:bg-transparent font-semibold text-sm flex items-center p-0 h-auto mb-8 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Add another team member
          </Button>
        )}

        <div className="bg-[#08090A] p-4 border border-white/10 rounded-xl mb-8 text-sm text-[#E6E8EA]">
          <p className="font-semibold mb-1">Why invite your team?</p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-[#9BA1A6]">
            <li>Everyone can report data breaches (72-hour deadline requires fast response)</li>
            <li>Team members can complete mandatory GDPR training</li>
            <li>Audit trail shows individual accountability</li>
          </ul>
        </div>

        <div className="flex justify-between items-center border-t border-white/10 pt-6">
          <Button
            variant="ghost"
            type="button"
            onClick={() => onNext([])}
            className="text-[#9BA1A6] hover:text-[#F4F5F6]"
          >
            Skip for now
          </Button>
          <Button
            type="submit"
          >
            Send invitations and continue
          </Button>
        </div>
      </form>
    </div>
  );
}
