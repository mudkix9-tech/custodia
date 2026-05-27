"use client";
import React from 'react';

export function Announcer() {
  return <div aria-live="polite" aria-atomic="true" className="sr-only" id="announcer" />;
}

export function announce(message: string) {
  const el = document.getElementById('announcer');
  if (el) {
    el.textContent = message;
    setTimeout(() => {
      if (el.textContent === message) el.textContent = '';
    }, 3000);
  }
}
