'use client';

import React, { useState, useEffect } from 'react';

const COMMON_TOOLS = [
  { id: 'hubspot', name: 'HubSpot', logo: '🟧', industries: ['marketing_agency', 'consulting', 'generic'] },
  { id: 'mailchimp', name: 'Mailchimp', logo: '🐒', industries: ['marketing_agency', 'ecommerce', 'generic'] },
  { id: 'google_analytics', name: 'Google Analytics', logo: '📊', industries: ['marketing_agency', 'ecommerce', 'generic'] },
  { id: 'slack', name: 'Slack', logo: '💬', industries: ['saas', 'web_development', 'design_agency', 'generic'] },
  { id: 'stripe', name: 'Stripe', logo: '💳', industries: ['ecommerce', 'saas', 'generic'] },
  { id: 'meta', name: 'Meta/Facebook', logo: '🟦', industries: ['marketing_agency', 'ecommerce'] },
  { id: 'zoom', name: 'Zoom', logo: '📹', industries: ['consulting', 'recruitment', 'education', 'generic'] },
  { id: 'asana', name: 'Asana', logo: '🔴', industries: ['marketing_agency', 'design_agency', 'consulting', 'generic'] },
  { id: 'figma', name: 'Figma', logo: '🎨', industries: ['design_agency', 'marketing_agency', 'web_development'] },
  { id: 'shopify', name: 'Shopify', logo: '🛍️', industries: ['ecommerce'] },
  { id: 'woocommerce', name: 'WooCommerce', logo: '🛒', industries: ['ecommerce'] },
  { id: 'bigcommerce', name: 'BigCommerce', logo: '🏪', industries: ['ecommerce'] },
  { id: 'klarna', name: 'Klarna', logo: '💳', industries: ['ecommerce'] },
  { id: 'adyen', name: 'Adyen', logo: '💳', industries: ['ecommerce'] },
  { id: 'shipstation', name: 'ShipStation', logo: '📦', industries: ['ecommerce'] },
  { id: 'doctolib', name: 'Doctolib', logo: '🏥', industries: ['healthcare'] },
  { id: 'drchrono', name: 'DrChrono', logo: '⚕️', industries: ['healthcare'] },
  { id: 'jane_app', name: 'Jane App', logo: '🩺', industries: ['healthcare'] },
  { id: 'healthie', name: 'Healthie', logo: '🍏', industries: ['healthcare'] },
  { id: 'greenhouse', name: 'Greenhouse', logo: '🌱', industries: ['recruitment'] },
  { id: 'lever', name: 'Lever', logo: '📈', industries: ['recruitment'] },
  { id: 'workable', name: 'Workable', logo: '💼', industries: ['recruitment'] },
  { id: 'bullhorn', name: 'BullHorn', logo: '📢', industries: ['recruitment'] },
  { id: 'linkedin_recruiter', name: 'LinkedIn Recruiter', logo: '👔', industries: ['recruitment'] },
  { id: 'clio', name: 'Clio', logo: '⚖️', industries: ['legal'] },
  { id: 'practicepanther', name: 'PracticePanther', logo: '🐾', industries: ['legal'] },
  { id: 'mycase', name: 'MyCase', logo: '📁', industries: ['legal'] },
  { id: 'lawpay', name: 'LawPay', logo: '💳', industries: ['legal'] },
  { id: 'xero', name: 'Xero', logo: '📊', industries: ['accounting'] },
  { id: 'quickbooks', name: 'QuickBooks', logo: '🧾', industries: ['accounting'] },
  { id: 'freshbooks', name: 'FreshBooks', logo: '🌿', industries: ['accounting'] },
  { id: 'sage', name: 'Sage', logo: '🍃', industries: ['accounting'] },
  { id: 'procore', name: 'Procore', logo: '🏗️', industries: ['construction'] },
  { id: 'plangrid', name: 'PlanGrid', logo: '📐', industries: ['construction'] },
  { id: 'coconstruct', name: 'CoConstruct', logo: '🔨', industries: ['construction'] },
];

export function Step2AddTools({ onNext, industry }: { onNext: (tools: string[]) => void, industry: string }) {
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  // In a real app we would fetch the actual UUIDs from the global vendors table
  // For the UI component we'll just mock it and pass to the parent

  const toggleTool = (id: string) => {
    setSelectedTools(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const suggestedTools = COMMON_TOOLS.filter(t => t.industries.includes(industry));
  const otherTools = COMMON_TOOLS.filter(t => !t.industries.includes(industry));

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border max-w-4xl mx-auto w-full">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">What tools do you use?</h2>
        <p className="text-gray-500">Select the tools you use to process data. We'll use this to build your data map.</p>
      </div>

      {suggestedTools.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Suggested for your industry</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {suggestedTools.map(tool => (
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
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-800">{suggestedTools.length > 0 ? 'Other popular tools' : 'Popular tools'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {otherTools.map(tool => (
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
