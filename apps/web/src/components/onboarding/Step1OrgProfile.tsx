'use client';

import React, { useState } from 'react';

export function Step1OrgProfile({ onNext }: { onNext: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    countryCode: 'IE',
    industry: 'marketing_agency',
    companySize: '11-25',
    hasDpo: false,
    dpoName: '',
    dpoEmail: '',
    slug: ''
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    onNext(formData);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Organization profile</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md"
            placeholder="Acme Agency"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <select
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value="marketing_agency">Marketing / Digital Agency</option>
              <option value="design_agency">Design / Creative Agency</option>
              <option value="web_development">Web Development</option>
              <option value="ecommerce">E-commerce</option>
              <option value="saas">SaaS / Technology</option>
              <option value="recruitment">Recruitment / Staffing</option>
              <option value="healthcare">Healthcare / Medical</option>
              <option value="legal">Legal / Law Firm</option>
              <option value="consulting">Consulting / Professional Services</option>
              <option value="real_estate">Real Estate</option>
              <option value="education">Education / Training</option>
              <option value="accounting">Accounting / Finance</option>
              <option value="hospitality">Hospitality / Travel</option>
              <option value="construction">Construction / Engineering</option>
              <option value="nonprofit">Non-profit / NGO</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
            <select
              name="companySize"
              value={formData.companySize}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value="5-10">5-10</option>
              <option value="11-25">11-25</option>
              <option value="26-50">26-50</option>
              <option value="51-100">51-100</option>
              <option value="100+">100+</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <select
            name="countryCode"
            value={formData.countryCode}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md"
          >
            <option value="IE">Ireland</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="NL">Netherlands</option>
            <option value="UK">United Kingdom</option>
            <option value="US">United States</option>
          </select>
        </div>

        <div className="pt-4 border-t">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="hasDpo"
              checked={formData.hasDpo}
              onChange={handleChange}
              className="rounded text-blue-600 w-4 h-4 mr-2"
            />
            <span className="text-sm font-medium text-gray-700">We have a Data Protection Officer (DPO)</span>
          </label>
        </div>

        {formData.hasDpo && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DPO Name</label>
              <input
                type="text"
                name="dpoName"
                value={formData.dpoName}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DPO Email</label>
              <input
                type="email"
                name="dpoEmail"
                value={formData.dpoEmail}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md"
              />
            </div>
          </div>
        )}

        <div className="pt-6">
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-medium py-3 px-4 rounded-md hover:bg-blue-700 transition"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
