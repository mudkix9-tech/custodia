"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Save, Building2, MapPin, UserCheck, Shield, Palette, Upload } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import debounce from 'lodash.debounce';

export default function OrganizationSettingsPage() {
  const { data: session } = useSession();
  const t = useTranslations('settings.organization');
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
          <h1 className="text-2xl font-serif text-[#F4F5F6] mb-2">{t('title')}</h1>
          <p className="text-[#9BA1A6]">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && <span className="text-sm text-[#6E747A]">{t('saving')}</span>}
          {saveStatus === 'saved' && <span className="text-sm text-[#C9A227] font-medium">{t('saved')}</span>}
        </div>
      </div>

      <div className="space-y-8">
        {/* Basic Information */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <Building2 className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">{t('basic_information.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('basic_information.name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('basic_information.legal_name')}</label>
              <input
                type="text"
                value={formData.legalName}
                onChange={e => handleChange('legalName', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('basic_information.slug')}</label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => handleChange('slug', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
              <p className="text-xs text-[#6E747A] mt-1.5">{t('basic_information.slug_hint', { slug: formData.slug || 'slug' })}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('basic_information.registration_number')}</label>
              <input
                type="text"
                value={formData.registrationNumber}
                onChange={e => handleChange('registrationNumber', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Location & Jurisdiction */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <MapPin className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">{t('location.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('location.country')}</label>
              <select
                value={formData.countryCode}
                onChange={e => handleChange('countryCode', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50 max-w-sm"
              >
                <option value="">{t('location.select_country')}</option>
                <option value="DE">{t('location.countries.DE')}</option>
                <option value="FR">{t('location.countries.FR')}</option>
                <option value="NL">{t('location.countries.NL')}</option>
                <option value="IE">{t('location.countries.IE')}</option>
                <option value="GB">{t('location.countries.GB')}</option>
                <option value="US">{t('location.countries.US')}</option>
                {/* Expand later */}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('location.street')}</label>
              <input
                type="text"
                value={formData.address?.street}
                onChange={e => handleAddressChange('street', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('location.city')}</label>
              <input
                type="text"
                value={formData.address?.city}
                onChange={e => handleAddressChange('city', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('location.postal_code')}</label>
              <input
                type="text"
                value={formData.address?.postalCode}
                onChange={e => handleAddressChange('postalCode', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('location.lead_authority')}</label>
              <input
                type="text"
                value={formData.leadSupervisoryAuthority}
                onChange={e => handleChange('leadSupervisoryAuthority', e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                placeholder={t('location.lead_authority_placeholder')}
              />
            </div>
          </div>
        </div>

        {/* Data Protection Officer */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <UserCheck className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">{t('dpo.title')}</h2>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-[#F4F5F6]">
              <input
                type="checkbox"
                checked={formData.hasDpo}
                onChange={e => handleChange('hasDpo', e.target.checked)}
                disabled={!isEditable}
                className="rounded border-white/20 text-[#C9A227] focus:ring-sage-600"
              />
              {t('dpo.has_dpo')}
            </label>
            <p className="text-xs text-[#6E747A] mt-2 ml-6">
              {t('dpo.dpo_hint')}
            </p>
          </div>

          {formData.hasDpo && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6 border-l-2 border-white/10 ml-1">
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('dpo.name')}</label>
                <input
                  type="text"
                  value={formData.dpoName}
                  onChange={e => handleChange('dpoName', e.target.value)}
                  disabled={!isEditable}
                  className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('dpo.email')}</label>
                <input
                  type="email"
                  value={formData.dpoEmail}
                  onChange={e => handleChange('dpoEmail', e.target.value)}
                  disabled={!isEditable}
                  className="w-full bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[#F4F5F6]">
                  <input
                    type="checkbox"
                    checked={formData.dpoIsExternal}
                    onChange={e => handleChange('dpoIsExternal', e.target.checked)}
                    disabled={!isEditable}
                    className="rounded border-white/20 text-[#C9A227] focus:ring-sage-600"
                  />
                  {t('dpo.is_external')}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Branding */}
        <div className="bg-[#0D0F11] rounded-2xl border border-white/10 p-6 shadow-panel-elevated">
          <div className="flex items-center gap-2 mb-6 text-[#F4F5F6]">
            <Palette className="w-5 h-5 text-[#6E747A]" />
            <h2 className="text-lg font-medium">{t('branding.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('branding.logo')}</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-[#08090A] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {formData.branding.logoUrl ? (
                      <img src={formData.branding.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <Building2 className="w-6 h-6 text-white/20" />
                    )}
                  </div>
                  <div className="flex-1">
                    <button
                      disabled={!isEditable}
                      onClick={handleUploadLogo}
                      className="text-sm bg-[#0D0F11] border border-white/20 text-[#F4F5F6] px-3 py-1.5 rounded-lg font-medium hover:bg-[#08090A] transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" /> {t('branding.upload_logo')}
                    </button>
                    <p className="text-xs text-[#6E747A] mt-2">{t('branding.logo_hint')}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('branding.primary_color')}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.branding.primaryColor || '#2c3e38'}
                    onChange={e => handleBrandingChange('primaryColor', e.target.value)}
                    disabled={!isEditable}
                    className="w-10 h-10 p-1 bg-[#0D0F11] border border-white/10 rounded cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={formData.branding.primaryColor || '#2c3e38'}
                    onChange={e => handleBrandingChange('primaryColor', e.target.value)}
                    disabled={!isEditable}
                    className="w-24 bg-[#08090A] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#F4F5F6] mb-1.5">{t('branding.trust_portal_preview')}</label>
              <div className="border border-white/10 rounded-xl overflow-hidden h-32 bg-[#08090A] flex flex-col">
                {/* Mock Header */}
                <div
                  className="h-10 px-4 flex items-center shadow-panel-elevated"
                  style={{ backgroundColor: formData.branding.primaryColor || '#2c3e38' }}
                >
                  {formData.branding.logoUrl ? (
                    <img src={formData.branding.logoUrl} alt="Logo" className="h-5 brightness-0 invert" />
                  ) : (
                    <div className="text-white text-xs font-serif font-bold">{formData.name || t('branding.your_org')}</div>
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
