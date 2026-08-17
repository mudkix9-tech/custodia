'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { EU_EEA_COUNTRIES, REST_OF_WORLD } from '@/utils/countries';

export function Step1OrgProfile({ onNext }: { onNext: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    websiteUrl: '',
    countryCode: 'IE',
    industry: 'marketing_agency',
    companySize: '11-25',
    hasDpo: false,
    dpoName: '',
    dpoEmail: '',
    slug: ''
  });

  const [errors, setErrors] = useState<{ name?: string }>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => {
      const newData = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'name' && !prev.slug) {
        newData.slug = generateSlug(value);
      }
      return newData;
    });
  };

  const selectCountry = (code: string) => {
    setFormData(prev => ({ ...prev, countryCode: code }));
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrors({ name: 'Organization name is required' });
      return;
    }
    setErrors({});
    onNext(formData);
  };

  const allCountries = [...EU_EEA_COUNTRIES, ...REST_OF_WORLD];
  const selectedCountry = allCountries.find(c => c.code === formData.countryCode);
  const selectedCountryName = selectedCountry ? selectedCountry.name : 'Select a country...';

  // Filter country lists
  const filteredEU = EU_EEA_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredROW = REST_OF_WORLD.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-[#0D0F11] p-8 rounded-xl shadow-panel-elevated border border-white/10 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-serif text-[#F4F5F6] mb-6">Organization profile</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">Organization Name *</Label>
          <Input
            type="text"
            name="name"
            value={formData.name}
            onChange={(e) => {
              handleChange(e);
              if (errors.name) {
                setErrors(prev => ({ ...prev, name: undefined }));
              }
            }}
            className={`${errors.name ? 'border-red-500' : ''}`}
            placeholder="Acme Agency"
          />
          {errors.name && (
            <p className="text-sm text-red-400 mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <Label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">Website URL (Optional)</Label>
          <Input
            type="url"
            name="websiteUrl"
            value={formData.websiteUrl}
            onChange={handleChange}
            placeholder="https://example.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">Industry</Label>
            <Select
              value={formData.industry}
              onValueChange={(v) => setFormData(prev => ({ ...prev, industry: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="marketing_agency">Marketing / Digital Agency</SelectItem>
                <SelectItem value="design_agency">Design / Creative Agency</SelectItem>
                <SelectItem value="web_development">Web Development</SelectItem>
                <SelectItem value="ecommerce">E-commerce</SelectItem>
                <SelectItem value="saas">SaaS / Technology</SelectItem>
                <SelectItem value="recruitment">Recruitment / Staffing</SelectItem>
                <SelectItem value="healthcare">Healthcare / Medical</SelectItem>
                <SelectItem value="legal">Legal / Law Firm</SelectItem>
                <SelectItem value="consulting">Consulting / Professional Services</SelectItem>
                <SelectItem value="real_estate">Real Estate</SelectItem>
                <SelectItem value="education">Education / Training</SelectItem>
                <SelectItem value="accounting">Accounting / Finance</SelectItem>
                <SelectItem value="hospitality">Hospitality / Travel</SelectItem>
                <SelectItem value="construction">Construction / Engineering</SelectItem>
                <SelectItem value="nonprofit">Non-profit / NGO</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">Company Size</Label>
            <Select
              value={formData.companySize}
              onValueChange={(v) => setFormData(prev => ({ ...prev, companySize: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-4">1-4</SelectItem>
                <SelectItem value="5-10">5-10</SelectItem>
                <SelectItem value="11-25">11-25</SelectItem>
                <SelectItem value="26-50">26-50</SelectItem>
                <SelectItem value="51-100">51-100</SelectItem>
                <SelectItem value="100+">100+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative" ref={dropdownRef}>
          <Label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">Country</Label>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full px-3 py-2 border border-white/10 rounded-lg text-left flex justify-between items-center bg-[#08090A] shadow-sm hover:border-[#C9A227]/50 focus:outline-none focus:ring-1 focus:ring-[#C9A227] focus:border-[#C9A227] transition-all"
          >
            <span className="text-[#F4F5F6] text-sm font-normal">{selectedCountryName}</span>
            <ChevronDown className="w-4 h-4 text-[#6E747A]" />
          </button>

          {isDropdownOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-[#08090A] border border-white/10 rounded-lg shadow-panel-elevated max-h-64 flex flex-col overflow-hidden">
              <div className="p-2 border-b border-white/10 flex items-center bg-[#0D0F11]">
                <Search className="w-4 h-4 text-[#6E747A] mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-sm text-[#F4F5F6] bg-transparent outline-none border-none py-1 focus:ring-0 placeholder:text-[#6E747A]"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto flex-1">
                {searchQuery ? (
                  <div>
                    {[...filteredEU, ...filteredROW].length > 0 ? (
                      [...filteredEU, ...filteredROW].map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => selectCountry(c.code)}
                          className="w-full text-left px-4 py-2 text-sm text-[#E6E8EA] hover:bg-[#C9A227]/20 hover:text-[#C9A227] flex justify-between items-center"
                        >
                          <span>{c.name}</span>
                          {formData.countryCode === c.code && (
                            <Check className="w-4 h-4 text-[#C9A227] shrink-0" />
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-[#6E747A] text-center">
                        No matches found
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {filteredEU.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-[#0D0F11] text-[11px] font-semibold text-[#6E747A] uppercase tracking-wider sticky top-0 border-b border-white/10">
                          EU / EEA Countries
                        </div>
                        {filteredEU.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => selectCountry(c.code)}
                            className="w-full text-left px-4 py-2 text-sm text-[#E6E8EA] hover:bg-[#C9A227]/20 hover:text-[#C9A227] flex justify-between items-center"
                          >
                            <span>{c.name}</span>
                            {formData.countryCode === c.code && (
                              <Check className="w-4 h-4 text-[#C9A227] shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {filteredROW.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-[#0D0F11] text-[11px] font-semibold text-[#6E747A] uppercase tracking-wider sticky top-0 border-b border-white/10 mt-1">
                          Rest of the World
                        </div>
                        {filteredROW.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => selectCountry(c.code)}
                            className="w-full text-left px-4 py-2 text-sm text-[#E6E8EA] hover:bg-[#C9A227]/20 hover:text-[#C9A227] flex justify-between items-center"
                          >
                            <span>{c.name}</span>
                            {formData.countryCode === c.code && (
                              <Check className="w-4 h-4 text-[#C9A227] shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 flex items-start gap-3">
          <Switch
            checked={formData.hasDpo}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasDpo: checked }))}
          />
          <div className="flex flex-col">
            <Label className="text-sm font-medium text-[#F4F5F6] leading-none">We have a Data Protection Officer (DPO)</Label>
            <span className="text-xs text-[#6E747A] mt-1.5 leading-relaxed">
              Required under GDPR Article 37 for certain core activities, regular monitoring, or public bodies.
            </span>
          </div>
        </div>

        {formData.hasDpo && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">DPO Name</Label>
              <Input
                type="text"
                name="dpoName"
                value={formData.dpoName}
                onChange={handleChange}
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">DPO Email</Label>
              <Input
                type="email"
                name="dpoEmail"
                value={formData.dpoEmail}
                onChange={handleChange}
              />
            </div>
          </div>
        )}

        <div className="pt-6">
          <Button
            type="submit"
            className="w-full"
          >
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
