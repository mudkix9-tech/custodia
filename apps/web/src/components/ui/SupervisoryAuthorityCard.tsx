"use client";

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { SupervisoryAuthority } from '@/types/marketing';

interface SupervisoryAuthorityCardProps {
  auth: SupervisoryAuthority;
}

export function SupervisoryAuthorityCard({ auth }: SupervisoryAuthorityCardProps) {
  return (
    <div className="bg-[#1F241D]/45 border border-[#2F362D]/90 p-5 rounded-xl hover:border-[#5F7556]/60 transition-all duration-300 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-[#2F362D]/40">
          <div className="relative group/tooltip flex items-center gap-1.5">
            <span className="font-mono font-bold text-[#F5F3ED] text-xs">{auth.code}</span>
            <HelpCircle className="w-3.5 h-3.5 text-[#9CA297]/50 hover:text-[#8BA381] cursor-help transition-colors" />
            
            {/* Tooltip Popover */}
            <div className="absolute bottom-full left-0 mb-2 w-52 p-3 bg-[#1F241D]/95 border border-[#2F362D] text-[#C5C8C1] text-[10px] rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 pointer-events-none backdrop-blur-md">
              <div className="font-bold text-[#F5F3ED] mb-1 text-[11px]">{auth.name}</div>
              <div className="text-[#8BA381] font-mono text-[9px] mb-1">{auth.country} Authority</div>
              <p className="text-[#9CA297] leading-relaxed text-[10px] pt-1 border-t border-[#2F362D]/40">{auth.focus}</p>
            </div>
          </div>
          <span className="text-[9px] text-[#9CA297]">{auth.country}</span>
        </div>
        <p className="text-[#F5F3ED] text-xs font-bold mb-2">{auth.name}</p>
        <p className="text-[#9CA297] text-[10.5px] leading-relaxed mb-3">{auth.focus}</p>
      </div>
      <div className="text-[10px] font-mono text-[#8BA381] bg-[#6E8B60]/5 border border-[#6E8B60]/15 p-2.5 rounded">
        <span className="font-bold text-[#F5F3ED] block mb-0.5 text-[9px]">ENFORCEMENT FOCUS:</span>
        {auth.enforcement}
      </div>
    </div>
  );
}
