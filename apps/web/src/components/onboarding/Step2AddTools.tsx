'use client';

import React, { useState } from 'react';
import { getToolIcon } from './toolIcons';
import { Search, Plus } from 'lucide-react';

const COMMON_TOOLS = [
  // Cross-Industry Universals
  { id: 'google_workspace', name: 'Google Workspace', industries: [] },
  { id: 'microsoft_365', name: 'Microsoft 365', industries: [] },
  { id: 'slack', name: 'Slack', industries: [] },
  { id: 'zoom', name: 'Zoom', industries: [] },
  { id: 'stripe', name: 'Stripe', industries: [] },
  { id: 'quickbooks', name: 'QuickBooks', industries: [] },
  { id: 'notion', name: 'Notion', industries: [] },
  { id: 'aws', name: 'AWS', industries: [] },
  { id: 'dropbox', name: 'Dropbox', industries: [] },
  { id: 'zendesk', name: 'Zendesk', industries: [] },

  // Marketing Agency
  { id: 'hubspot', name: 'HubSpot', industries: ['marketing_agency', 'consulting'] },
  { id: 'mailchimp', name: 'Mailchimp', industries: ['marketing_agency', 'ecommerce', 'nonprofit'] },
  { id: 'google_analytics', name: 'Google Analytics', industries: ['marketing_agency', 'ecommerce'] },
  { id: 'meta', name: 'Meta/Facebook', industries: ['marketing_agency', 'ecommerce'] },
  { id: 'asana', name: 'Asana', industries: ['marketing_agency', 'design_agency', 'consulting'] },
  { id: 'figma', name: 'Figma', industries: ['design_agency', 'marketing_agency', 'web_development'] },

  // Design Agency
  { id: 'adobe', name: 'Adobe Creative Cloud', industries: ['design_agency'] },
  { id: 'canva', name: 'Canva', industries: ['design_agency', 'marketing_agency', 'nonprofit'] },

  // Web Development
  { id: 'github', name: 'GitHub', industries: ['web_development', 'saas'] },
  { id: 'jira', name: 'Jira', industries: ['web_development', 'saas'] },
  { id: 'vercel', name: 'Vercel', industries: ['web_development'] },
  { id: 'sentry', name: 'Sentry', industries: ['web_development', 'saas'] },

  // Ecommerce
  { id: 'shopify', name: 'Shopify', industries: ['ecommerce'] },
  { id: 'woocommerce', name: 'WooCommerce', industries: ['ecommerce'] },
  { id: 'bigcommerce', name: 'BigCommerce', industries: ['ecommerce'] },
  { id: 'klarna', name: 'Klarna', industries: ['ecommerce'] },
  { id: 'adyen', name: 'Adyen', industries: ['ecommerce'] },
  { id: 'shipstation', name: 'ShipStation', industries: ['ecommerce'] },
  { id: 'klaviyo', name: 'Klaviyo', industries: ['ecommerce', 'marketing_agency'] },

  // SaaS
  { id: 'intercom', name: 'Intercom', industries: ['saas'] },
  { id: 'salesforce', name: 'Salesforce', industries: ['saas', 'consulting', 'real_estate'] },

  // Recruitment
  { id: 'greenhouse', name: 'Greenhouse', industries: ['recruitment'] },
  { id: 'lever', name: 'Lever', industries: ['recruitment'] },
  { id: 'workable', name: 'Workable', industries: ['recruitment'] },
  { id: 'bullhorn', name: 'Bullhorn', industries: ['recruitment'] },
  { id: 'linkedin_recruiter', name: 'LinkedIn Recruiter', industries: ['recruitment'] },

  // Healthcare
  { id: 'doctolib', name: 'Doctolib', industries: ['healthcare'] },
  { id: 'drchrono', name: 'DrChrono', industries: ['healthcare'] },
  { id: 'jane_app', name: 'Jane App', industries: ['healthcare'] },
  { id: 'healthie', name: 'Healthie', industries: ['healthcare'] },

  // Legal
  { id: 'clio', name: 'Clio', industries: ['legal'] },
  { id: 'practicepanther', name: 'PracticePanther', industries: ['legal'] },
  { id: 'mycase', name: 'MyCase', industries: ['legal'] },
  { id: 'lawpay', name: 'LawPay', industries: ['legal'] },
  { id: 'docusign', name: 'DocuSign', industries: ['legal', 'real_estate', 'consulting'] },

  // Accounting
  { id: 'xero', name: 'Xero', industries: ['accounting'] },
  { id: 'freshbooks', name: 'FreshBooks', industries: ['accounting'] },
  { id: 'sage', name: 'Sage', industries: ['accounting'] },

  // Hospitality
  { id: 'booking', name: 'Booking.com', industries: ['hospitality'] },
  { id: 'airbnb', name: 'Airbnb', industries: ['hospitality'] },

  // Construction
  { id: 'procore', name: 'Procore', industries: ['construction'] },
  { id: 'plangrid', name: 'PlanGrid', industries: ['construction'] },
  { id: 'coconstruct', name: 'CoConstruct', industries: ['construction'] },

  // Education
  { id: 'canvas_lms', name: 'Canvas LMS', industries: ['education'] },

  // Real Estate
  { id: 'zillow', name: 'Zillow', industries: ['real_estate'] }
];

const UNIVERSALS = ['google_workspace', 'microsoft_365', 'slack', 'zoom', 'stripe', 'quickbooks', 'notion', 'aws', 'dropbox', 'zendesk'];

export function Step2AddTools({ onNext, industry }: { onNext: (tools: string[]) => void, industry: string }) {
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [customTools, setCustomTools] = useState<string[]>([]);
  const [newCustomTool, setNewCustomTool] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleTool = (id: string) => {
    setSelectedTools(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleAddCustomTool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomTool.trim()) return;
    const toolName = newCustomTool.trim();
    if (!customTools.includes(toolName)) {
      setCustomTools(prev => [...prev, toolName]);
      setSelectedTools(prev => [...prev, toolName]);
    }
    setNewCustomTool('');
  };

  const removeCustomTool = (name: string) => {
    setCustomTools(prev => prev.filter(t => t !== name));
    setSelectedTools(prev => prev.filter(t => t !== name));
  };

  // 1. Curated suggestions for selected industry
  const suggestedTools = industry === 'other' 
    ? [] 
    : COMMON_TOOLS.filter(t => t.industries.includes(industry));

  const suggestedIds = new Set(suggestedTools.map(t => t.id));

  // 2. Popular tools (Universals minus suggested)
  const popularTools = COMMON_TOOLS.filter(t => 
    UNIVERSALS.includes(t.id) && !suggestedIds.has(t.id)
  );
  
  const popularIds = new Set(popularTools.map(t => t.id));

  // 3. All other tools (Sorted alphabetically and deduplicated)
  const allOtherTools = COMMON_TOOLS.filter(t => 
    !suggestedIds.has(t.id) && !popularIds.has(t.id)
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Search filter for all other tools section
  const filteredOtherTools = allOtherTools.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border max-w-4xl mx-auto w-full">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">What tools do you use?</h2>
        <p className="text-gray-500 max-w-lg mx-auto">Select the tools you use to process data. We'll use this to build your data map.</p>
      </div>

      {/* Suggested Section */}
      {suggestedTools.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Suggested for your industry</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {suggestedTools.map(tool => {
              const isSelected = selectedTools.includes(tool.id);
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => toggleTool(tool.id)}
                  className={`relative p-4 border rounded-xl flex flex-col items-center justify-center gap-3 transition-all select-none min-h-[110px] ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-100'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="shrink-0">{getToolIcon(tool.id, "w-8 h-8")}</div>
                  <div className="font-semibold text-xs text-gray-700 text-center">{tool.name}</div>
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 bg-blue-600 text-white rounded-full p-0.5 shadow-sm shrink-0">
                      <svg className="w-3 h-3 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Popular Tools Section */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
          {suggestedTools.length > 0 ? 'Other popular tools' : 'Popular tools'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {popularTools.map(tool => {
            const isSelected = selectedTools.includes(tool.id);
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => toggleTool(tool.id)}
                className={`relative p-4 border rounded-xl flex flex-col items-center justify-center gap-3 transition-all select-none min-h-[110px] ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-100'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                }`}
              >
                <div className="shrink-0">{getToolIcon(tool.id, "w-8 h-8")}</div>
                <div className="font-semibold text-xs text-gray-700 text-center">{tool.name}</div>
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 bg-blue-600 text-white rounded-full p-0.5 shadow-sm shrink-0">
                    <svg className="w-3 h-3 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expandable All Tools Section */}
      <div className="mb-8 border-t pt-6">
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2.5 px-4 bg-gray-50 border rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100/80 transition flex justify-between items-center"
        >
          <span>{showAll ? 'Hide other tools' : 'Show all tools'}</span>
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${showAll ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAll && (
          <div className="mt-6 space-y-4">
            {/* Search Input for All Tools */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search other tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredOtherTools.length > 0 ? (
                filteredOtherTools.map(tool => {
                  const isSelected = selectedTools.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => toggleTool(tool.id)}
                      className={`relative p-4 border rounded-xl flex flex-col items-center justify-center gap-3 transition-all select-none min-h-[110px] ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-100'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="shrink-0">{getToolIcon(tool.id, "w-8 h-8")}</div>
                      <div className="font-semibold text-xs text-gray-700 text-center">{tool.name}</div>
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 bg-blue-600 text-white rounded-full p-0.5 shadow-sm shrink-0">
                          <svg className="w-3 h-3 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="col-span-full py-6 text-center text-sm text-gray-400">
                  No other tools match your search
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Custom Tool Section */}
      <div className="mb-8 border-t pt-6">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Don't see a tool you use?</h4>
        <form onSubmit={handleAddCustomTool} className="flex gap-2 max-w-md">
          <input
            type="text"
            placeholder="Enter custom tool name..."
            value={newCustomTool}
            onChange={(e) => setNewCustomTool(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-gray-900 text-white font-medium text-sm py-2 px-4 rounded-lg hover:bg-gray-800 transition flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Tool
          </button>
        </form>

        {/* Selected Custom Badges */}
        {customTools.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {customTools.map(name => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
              >
                <span>{name}</span>
                <button
                  type="button"
                  onClick={() => removeCustomTool(name)}
                  className="hover:text-blue-900 text-blue-500 font-bold ml-1.5 focus:outline-none text-sm leading-none"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center border-t pt-6">
        <button
          type="button"
          onClick={() => onNext([])}
          className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={() => onNext(selectedTools)}
          className="bg-blue-600 text-white font-medium py-2.5 px-8 rounded-md hover:bg-blue-700 transition"
        >
          Continue {selectedTools.length > 0 ? `with ${selectedTools.length} tool${selectedTools.length === 1 ? '' : 's'}` : ''}
        </button>
      </div>
    </div>
  );
}
