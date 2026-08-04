'use client';

import React, { useState } from 'react';
import { getToolIcon } from './toolIcons';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
    <div className="bg-[#0D0F11] p-8 rounded-xl shadow-panel-elevated border border-white/10 max-w-4xl mx-auto w-full">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-serif text-[#F4F5F6] mb-2">What tools do you use?</h2>
        <p className="text-[#6E747A] max-w-lg mx-auto">Select the tools you use to process data. We'll use this to build your data map.</p>
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
                      ? 'border-[#C9A227] bg-[#C9A227]/10 ring-1 ring-[#C9A227]'
                      : 'border-white/10 hover:border-white/20 hover:bg-[#08090A]'
                  }`}
                >
                  <div className="shrink-0">{getToolIcon(tool.id, "w-8 h-8")}</div>
                  <div className="font-semibold text-xs text-[#E6E8EA] text-center">{tool.name}</div>
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 bg-[#C9A227] text-[#08090A] rounded-full p-0.5 shadow-panel-elevated shrink-0">
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
                    ? 'border-[#C9A227] bg-[#C9A227]/10 ring-1 ring-[#C9A227]'
                    : 'border-white/10 hover:border-white/20 hover:bg-[#08090A]'
                }`}
              >
                <div className="shrink-0">{getToolIcon(tool.id, "w-8 h-8")}</div>
                <div className="font-semibold text-xs text-[#E6E8EA] text-center">{tool.name}</div>
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 bg-[#C9A227] text-[#08090A] rounded-full p-0.5 shadow-panel-elevated shrink-0">
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
      <div className="mb-8 border-t border-white/10 pt-6">
        <Button
          variant="outline"
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2.5 px-4 flex justify-between items-center"
        >
          <span>{showAll ? 'Hide other tools' : 'Show all tools'}</span>
          <svg className={`w-4 h-4 text-[#6E747A] transition-transform ${showAll ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </Button>

        {showAll && (
          <div className="mt-6 space-y-4">
            {/* Search Input for All Tools */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6E747A] w-4 h-4" />
              <Input
                type="text"
                placeholder="Search other tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
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
                          ? 'border-[#C9A227] bg-[#C9A227]/10 ring-1 ring-[#C9A227]'
                          : 'border-white/10 hover:border-white/20 hover:bg-[#08090A]'
                      }`}
                    >
                      <div className="shrink-0">{getToolIcon(tool.id, "w-8 h-8")}</div>
                      <div className="font-semibold text-xs text-[#E6E8EA] text-center">{tool.name}</div>
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 bg-[#C9A227] text-[#08090A] rounded-full p-0.5 shadow-panel-elevated shrink-0">
                          <svg className="w-3 h-3 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="col-span-full py-6 text-center text-sm text-[#6E747A]">
                  No other tools match your search
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Custom Tool Section */}
      <div className="mb-8 border-t border-white/10 pt-6">
        <h4 className="text-sm font-semibold text-[#F4F5F6] mb-3">Don't see a tool you use?</h4>
        <form onSubmit={handleAddCustomTool} className="flex gap-2 max-w-md">
          <Input
            type="text"
            placeholder="Enter custom tool name..."
            value={newCustomTool}
            onChange={(e) => setNewCustomTool(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            className="flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Tool
          </Button>
        </form>

        {/* Selected Custom Badges */}
        {customTools.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {customTools.map(name => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sage-100/20 text-[#C9A227] border border-[#C9A227]/30"
              >
                <span>{name}</span>
                <button
                  type="button"
                  onClick={() => removeCustomTool(name)}
                  className="hover:text-white text-[#C9A227] font-bold ml-1.5 focus:outline-none text-sm leading-none"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
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
          type="button"
          onClick={() => onNext(selectedTools)}
        >
          Continue {selectedTools.length > 0 ? `with ${selectedTools.length} tool${selectedTools.length === 1 ? '' : 's'}` : ''}
        </Button>
      </div>
    </div>
  );
}
