'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const EU_EEA_COUNTRIES = [
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'UK', name: 'United Kingdom' }
];

const REST_OF_WORLD = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AU', name: 'Australia' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CV', name: 'Cape Verde' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: 'Ivory Coast' },
  { code: 'CU', name: 'Cuba' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IL', name: 'Israel' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KP', name: 'Korea, North' },
  { code: 'KR', name: 'Korea, South' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' }
];

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
                          className="w-full text-left px-4 py-2 text-sm text-[#E6E8EA] hover:bg-sage-100 hover:text-[#C9A227] flex justify-between items-center"
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
                            className="w-full text-left px-4 py-2 text-sm text-[#E6E8EA] hover:bg-sage-100 hover:text-[#C9A227] flex justify-between items-center"
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
                            className="w-full text-left px-4 py-2 text-sm text-[#E6E8EA] hover:bg-sage-100 hover:text-[#C9A227] flex justify-between items-center"
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
