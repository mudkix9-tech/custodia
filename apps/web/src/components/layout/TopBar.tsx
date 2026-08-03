"use client";

import React from 'react';
import { Menu } from 'lucide-react';
import { Logo } from './Sidebar';

export function TopBar() {
  return (
    <div className="lg:hidden sticky top-0 z-20 bg-[#08090A]/90 backdrop-blur border-b border-ink-900/8 px-4 py-3 flex items-center justify-between">
      <Logo />
      <button className="p-2 rounded-md hover:bg-white/5">
        <Menu size={18} />
      </button>
    </div>
  );
}
