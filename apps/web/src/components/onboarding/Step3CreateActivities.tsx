'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Template {
  id: string;
  name: string;
  description: string;
  lawfulBasis: string;
  dataCategories: any[];
}

interface Step3Props {
  templates: Template[];
  onNext: (templateIds: string[], customActivities: string[]) => void;
}

function formatLawfulBasis(basis: string): string {
  const map: Record<string, string> = {
    consent: 'Consent',
    contract: 'Contractual Necessity',
    legal_obligation: 'Legal Obligation',
    legitimate_interests: 'Legitimate Interests',
    public_task: 'Public Task',
    vital_interests: 'Vital Interests'
  };
  return map[basis.toLowerCase()] || basis.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function Step3CreateActivities({ templates, onNext }: Step3Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [customActivities, setCustomActivities] = useState<string[]>([]);
  const [selectedCustom, setSelectedCustom] = useState<string[]>([]);
  const [newActivityName, setNewActivityName] = useState('');

  // Pre-select the most common templates on initial load
  useEffect(() => {
    if (templates && templates.length > 0 && selected.length === 0) {
      const defaultPreselected = ['website_analytics', 'email_marketing', 'hr_management', 'payroll_processing'];
      const preselected = templates
        .map(t => t.id)
        .filter(id => defaultPreselected.includes(id));
      setSelected(preselected);
    }
  }, [templates]);

  const toggleTemplate = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleAddCustomActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName.trim()) return;
    const name = newActivityName.trim();
    if (!customActivities.includes(name)) {
      setCustomActivities(prev => [...prev, name]);
      setSelectedCustom(prev => [...prev, name]);
    }
    setNewActivityName('');
  };

  const toggleCustom = (name: string) => {
    setSelectedCustom(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const removeCustom = (name: string) => {
    setCustomActivities(prev => prev.filter(t => t !== name));
    setSelectedCustom(prev => prev.filter(t => t !== name));
  };

  const totalCount = selected.length + selectedCustom.length;

  return (
    <div className="bg-[#0D0F11] p-8 rounded-xl shadow-panel-elevated border border-white/10 max-w-4xl mx-auto w-full">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-serif text-[#F4F5F6] mb-2">Let's document your first data processing activities</h2>
        <p className="text-[#6E747A] max-w-lg mx-auto">Based on your industry, we've prepared standard processing activities. Review and select the ones you do.</p>
      </div>

      {/* Grid of Templates (Deduplicated, Sorted, Compact) */}
      <div className="space-y-3 mb-8">
        {templates.map(template => {
          const isSelected = selected.includes(template.id);
          return (
            <div
              key={template.id}
              onClick={() => toggleTemplate(template.id)}
              className={`p-3.5 border rounded-xl cursor-pointer transition-all flex items-start justify-between select-none ${
                isSelected
                  ? 'border-[#C9A227] bg-[#C9A227]/10 ring-1 ring-[#C9A227]'
                  : 'border-white/10 hover:border-white/20 hover:bg-[#08090A]'
              }`}
            >
              <div className="pr-4">
                <h3 className="font-semibold text-base text-[#F4F5F6] mb-0.5">{template.name}</h3>
                <p className="text-xs text-[#9BA1A6] mb-2">{template.description}</p>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className="bg-[#08090A] border border-white/10 px-2 py-0.5 rounded text-[#E6E8EA] font-medium">
                    <span className="text-[#6E747A]">Basis:</span> {formatLawfulBasis(template.lawfulBasis)}
                  </span>
                  <span className="bg-[#08090A] border border-white/10 px-2 py-0.5 rounded text-[#E6E8EA] font-medium">
                    <span className="text-[#6E747A]">Data Categories:</span> {template.dataCategories.length}
                  </span>
                </div>
              </div>
              <div className="ml-4 shrink-0">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-[#C9A227] border-[#C9A227]' : 'border-white/20'
                }`}>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Custom Activities */}
        {customActivities.map(name => {
          const isSelected = selectedCustom.includes(name);
          return (
            <div
              key={name}
              onClick={() => toggleCustom(name)}
              className={`p-3.5 border rounded-xl cursor-pointer transition-all flex items-start justify-between select-none ${
                isSelected
                  ? 'border-[#C9A227] bg-[#C9A227]/10 ring-1 ring-[#C9A227]'
                  : 'border-white/10 hover:border-white/20 hover:bg-[#08090A]'
              }`}
            >
              <div>
                <h3 className="font-semibold text-base text-[#F4F5F6] mb-0.5">{name}</h3>
                <p className="text-xs text-[#6E747A] mb-2">Custom Activity</p>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className="bg-[#08090A] border border-white/10 px-2 py-0.5 rounded text-[#E6E8EA] font-medium">
                    Source: Manually added
                  </span>
                  <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Needs Review
                  </span>
                </div>
              </div>
              <div className="ml-4 shrink-0 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCustom(name);
                  }}
                  className="text-[#6E747A] hover:text-red-400 font-medium text-xs focus:outline-none"
                >
                  Remove
                </button>
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-[#C9A227] border-[#C9A227]' : 'border-white/20'
                }`}>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom Activity Section */}
      <div className="mb-8 border-t border-white/10 pt-6">
        <h4 className="text-sm font-semibold text-[#F4F5F6] mb-3">Add a custom processing activity</h4>
        <form onSubmit={handleAddCustomActivity} className="flex gap-2 max-w-md">
          <Input
            type="text"
            placeholder="e.g., CCTV monitoring, Employee payroll processing..."
            value={newActivityName}
            onChange={(e) => setNewActivityName(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            className="flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Activity
          </Button>
        </form>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center border-t border-white/10 pt-6">
        <Button
          variant="ghost"
          type="button"
          onClick={() => onNext([], [])}
          className="text-[#9BA1A6] hover:text-[#F4F5F6]"
        >
          Skip for now
        </Button>
        <Button
          type="button"
          onClick={() => onNext(selected, selectedCustom)}
          disabled={totalCount === 0}
        >
          Create {totalCount > 0 ? `${totalCount} activit${totalCount === 1 ? 'y' : 'ies'}` : 'Activities'}
        </Button>
      </div>
    </div>
  );
}
