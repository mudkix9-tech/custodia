'use client';

import React, { useState, useEffect } from 'react';

const COMMON_TOOLS = [
  { id: 'hubspot', name: 'HubSpot', logo: '🟧' },
  { id: 'mailchimp', name: 'Mailchimp', logo: '🐒' },
  { id: 'google_analytics', name: 'Google Analytics', logo: '📊' },
  { id: 'slack', name: 'Slack', logo: '💬' },
  { id: 'stripe', name: 'Stripe', logo: '💳' },
  { id: 'meta', name: 'Meta/Facebook', logo: '🟦' },
  { id: 'zoom', name: 'Zoom', logo: '📹' },
  { id: 'asana', name: 'Asana', logo: '🔴' },
  { id: 'figma', name: 'Figma', logo: '🎨' },
];

export function Step2AddTools({ onNext }: { onNext: (tools: string[]) => void }) {
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  // In a real app we would fetch the actual UUIDs from the global vendors table
  // For the UI component we'll just mock it and pass to the parent

  const toggleTool = (id: string) => {
    setSelectedTools(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border max-w-4xl mx-auto w-full">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">What tools does your agency use?</h2>
        <p className="text-gray-500">Select the tools you use to process data. We'll use this to build your data map.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {COMMON_TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => toggleTool(tool.id)}
            className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${
              selectedTools.includes(tool.id)
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="text-3xl">{tool.logo}</div>
            <div className="font-medium text-sm text-gray-700">{tool.name}</div>
            {selectedTools.includes(tool.id) && (
              <div className="absolute top-2 right-2 text-blue-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center border-t pt-6">
        <button
          onClick={() => onNext([])}
          className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2"
        >
          Skip for now
        </button>
        <button
          onClick={() => onNext(selectedTools)}
          className="bg-blue-600 text-white font-medium py-2 px-8 rounded-md hover:bg-blue-700 transition"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
