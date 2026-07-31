"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Save, Building2, MapPin, UserCheck, Shield, Palette, Upload } from 'lucide-react';
import { useSession } from 'next-auth/react';
import debounce from 'lodash.debounce';

export default function OrganizationSettingsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isEditable = userRole === 'admin' || userRole === 'owner';

  const { data: org, isLoading } = trpc.settings.getOrgSettings.useQuery();
  const updateOrg = trpc.settings.updateOrgSettings.useMutation();

  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    slug: '',
    registrationNumber: '',
    countryCode: '',
    address: { street: '', city: '', postalCode: '' },
    hasDpo: false,
    dpoName: '',
    dpoEmail: '',
    dpoIsExternal: false,
    leadSupervisoryAuthority: '',
    branding: { logoUrl: '', primaryColor: '#2c3e38' }
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (org) {
      setFormData({
        name: org.name || '',
        legalName: org.legalName || '',
        slug: org.slug || '',
        registrationNumber: org.registrationNumber || '',
        countryCode: org.countryCode || '',
        address: (org.address as any) || { street: '', city: '', postalCode: '' },
        hasDpo: org.hasDpo || false,
        dpoName: org.dpoName || '',
        dpoEmail: org.dpoEmail || '',
        dpoIsExternal: org.dpoIsExternal || false,
        leadSupervisoryAuthority: org.leadSupervisoryAuthority || '',
        branding: (org.branding as any) || { logoUrl: '', primaryColor: '#2c3e38' },
      });
    }
  }, [org]);

  const debouncedSave = useCallback(
    debounce(async (dataToSave) => {
      setSaveStatus('saving');
      try {
        await updateOrg.mutateAsync(dataToSave);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) {
        console.error("Failed to save org settings", e);
        setSaveStatus('idle');
      }
    }, 500),
    []
  );

  const handleChange = (field: string, value: any) => {
    if (!isEditable) return;
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    debouncedSave(newData);
  };

  const handleAddressChange = (field: string, value: string) => {
    if (!isEditable) return;
    const newAddress = { ...formData.address, [field]: value };
    const newData = { ...formData, address: newAddress };
    setFormData(newData);
    debouncedSave(newData);
  };

  const handleBrandingChange = (field: string, value: string) => {
    if (!isEditable) return;
    const newBranding = { ...formData.branding, [field]: value };
    const newData = { ...formData, branding: newBranding };
    setFormData(newData);
    debouncedSave(newData);
  };

  const handleUploadLogo = async () => {
     // In a real app this would trigger an S3 upload flow and return a URL.
     // Implementing a mock update since no actual S3 client/bucket is wired up here
     const mockUrl = "https://via.placeholder.com/150";
     handleBrandingChange('logoUrl', mockUrl);
  };

  if (isLoading) return <GenericWorkspaceSkeleton />;

  return (
    <div className="max-w-4xl mx-auto p-8 fade-up">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-serif text-ink-900 mb-2">Organization Profile</h1>
          <p className="text-ink-600">Manage your company details, data protection officer, and branding.</p>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && <span className="text-sm text-ink-500">Saving...</span>}
          {saveStatus === 'saved' && <span className="text-sm text-sage-600 font-medium">Saved</span>}
        </div>
      </div>

      <div className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <Building2 className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">Basic Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Organization Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Legal Name</label>
              <input
                type="text"
                value={formData.legalName}
                onChange={e => handleChange('legalName', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Public Slug</label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => handleChange('slug', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
              <p className="text-xs text-ink-500 mt-1.5">custodia.io/legal/{formData.slug || 'slug'}/privacy</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Registration Number</label>
              <input
                type="text"
                value={formData.registrationNumber}
                onChange={e => handleChange('registrationNumber', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Location & Jurisdiction */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <MapPin className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">Location & Jurisdiction</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Country</label>
              <select
                value={formData.countryCode}
                onChange={e => handleChange('countryCode', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50 max-w-sm"
              >
                <option value="">Select a country...</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="NL">Netherlands</option>
                <option value="IE">Ireland</option>
                <option value="GB">United Kingdom</option>
                <option value="US">United States</option>
                {/* Expand later */}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Street Address</label>
              <input
                type="text"
                value={formData.address?.street}
                onChange={e => handleAddressChange('street', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">City</label>
              <input
                type="text"
                value={formData.address?.city}
                onChange={e => handleAddressChange('city', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Postal Code</label>
              <input
                type="text"
                value={formData.address?.postalCode}
                onChange={e => handleAddressChange('postalCode', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Lead Supervisory Authority</label>
              <input
                type="text"
                value={formData.leadSupervisoryAuthority}
                onChange={e => handleChange('leadSupervisoryAuthority', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                placeholder="e.g. BfDI (Germany) or CNIL (France)"
              />
            </div>
          </div>
        </div>

        {/* Data Protection Officer */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <UserCheck className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">Data Protection Officer</h2>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-ink-900">
              <input
                type="checkbox"
                checked={formData.hasDpo}
                onChange={e => handleChange('hasDpo', e.target.checked)}
                disabled={!isEditable}
                className="rounded border-ink-900/20 text-sage-600 focus:ring-sage-600"
              />
              Do you have a DPO?
            </label>
            <p className="text-xs text-ink-500 mt-2 ml-6">
              Under GDPR, a DPO is required if you regularly process personal data on a large scale or process special category data.
            </p>
          </div>

          {formData.hasDpo && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6 border-l-2 border-ink-900/10 ml-1">
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-1.5">DPO Name</label>
                <input
                  type="text"
                  value={formData.dpoName}
                  onChange={e => handleChange('dpoName', e.target.value)}
                  disabled={!isEditable}
                  className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-1.5">DPO Email</label>
                <input
                  type="email"
                  value={formData.dpoEmail}
                  onChange={e => handleChange('dpoEmail', e.target.value)}
                  disabled={!isEditable}
                  className="w-full bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-ink-900">
                  <input
                    type="checkbox"
                    checked={formData.dpoIsExternal}
                    onChange={e => handleChange('dpoIsExternal', e.target.checked)}
                    disabled={!isEditable}
                    className="rounded border-ink-900/20 text-sage-600 focus:ring-sage-600"
                  />
                  Is the DPO external?
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Branding */}
        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-ink-900">
            <Palette className="w-5 h-5 text-ink-400" />
            <h2 className="text-lg font-medium">Branding</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-900 mb-1.5">Organization Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-bone-50 border border-ink-900/10 flex items-center justify-center overflow-hidden shrink-0">
                    {formData.branding.logoUrl ? (
                      <img src={formData.branding.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <Building2 className="w-6 h-6 text-ink-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <button
                      disabled={!isEditable}
                      onClick={handleUploadLogo}
                      className="text-sm bg-white border border-ink-900/20 text-ink-900 px-3 py-1.5 rounded-lg font-medium hover:bg-bone-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" /> Upload Logo
                    </button>
                    <p className="text-xs text-ink-500 mt-2">Recommended: 400x100px PNG or SVG</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-900 mb-1.5">Primary Brand Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.branding.primaryColor || '#2c3e38'}
                    onChange={e => handleBrandingChange('primaryColor', e.target.value)}
                    disabled={!isEditable}
                    className="w-10 h-10 p-1 bg-white border border-ink-900/10 rounded cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={formData.branding.primaryColor || '#2c3e38'}
                    onChange={e => handleBrandingChange('primaryColor', e.target.value)}
                    disabled={!isEditable}
                    className="w-24 bg-bone-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm font-mono disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Trust Portal Preview</label>
              <div className="border border-ink-900/10 rounded-xl overflow-hidden h-32 bg-bone-50 flex flex-col">
                {/* Mock Header */}
                <div
                  className="h-10 px-4 flex items-center shadow-sm"
                  style={{ backgroundColor: formData.branding.primaryColor || '#2c3e38' }}
                >
                  {formData.branding.logoUrl ? (
                    <img src={formData.branding.logoUrl} alt="Logo" className="h-5 brightness-0 invert" />
                  ) : (
                    <div className="text-white text-xs font-serif font-bold">{formData.name || 'Your Org'}</div>
                  )}
                </div>
                <div className="p-4 flex-1">
                  <div className="w-1/3 h-2 bg-ink-900/10 rounded mb-2"></div>
                  <div className="w-1/2 h-2 bg-ink-900/10 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
