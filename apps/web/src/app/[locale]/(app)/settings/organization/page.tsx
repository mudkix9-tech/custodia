"use client";
import { GenericWorkspaceSkeleton } from '@/components/skeletons/PageSkeleton';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { trpc } from '@/utils/trpc';
import { Save, Building2, MapPin, UserCheck, Shield, Palette, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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

  const debouncedSave = useMemo(
    () =>
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
      }, 1000),
    [updateOrg]
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
    <div className="mx-auto max-w-[1040px] px-8 pt-10 pb-24 rise-in">
      <div className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <h1 className="mb-2.5 font-serif text-[34px] leading-[1.05] tracking-[-0.015em] text-set-fg md:text-[44px]">{t('title')}</h1>
          <p className="max-w-[52ch] text-sm leading-[1.55] text-set-fg-muted text-pretty">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && <span className="text-sm text-set-fg-subtle">{t('saving')}</span>}
          {saveStatus === 'saved' && <span className="text-sm text-set-gold font-medium">{t('saved')}</span>}
        </div>
      </div>

      <div className="space-y-8">
        {/* Basic Information */}
        <div className="rounded-[14px] border border-set-line bg-set-panel p-[22px]">
          <div className="flex items-center gap-2 mb-6 text-set-fg">
            <Building2 className="w-4 h-4 text-set-gold" />
            <h2 className="text-[14.5px] font-semibold tracking-[-0.005em]">{t('basic_information.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('basic_information.name')}</Label>
              <Input
                type="text"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div>
              <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('basic_information.legal_name')}</Label>
              <Input
                type="text"
                value={formData.legalName}
                onChange={e => handleChange('legalName', e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div>
              <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('basic_information.slug')}</Label>
              <Input
                type="text"
                value={formData.slug}
                onChange={e => handleChange('slug', e.target.value)}
                disabled={!isEditable}
              />
              <p className="text-xs text-set-fg-subtle mt-1.5">{t('basic_information.slug_hint', { slug: formData.slug || 'slug' })}</p>
            </div>
            <div>
              <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('basic_information.registration_number')}</Label>
              <Input
                type="text"
                value={formData.registrationNumber}
                onChange={e => handleChange('registrationNumber', e.target.value)}
                disabled={!isEditable}
              />
            </div>
          </div>
        </div>

        {/* Location & Jurisdiction */}
        <div className="rounded-[14px] border border-set-line bg-set-panel p-[22px]">
          <div className="flex items-center gap-2 mb-6 text-set-fg">
            <MapPin className="w-4 h-4 text-set-gold" />
            <h2 className="text-[14.5px] font-semibold tracking-[-0.005em]">{t('location.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('location.country')}</Label>
              <Select
                value={formData.countryCode}
                onValueChange={v => handleChange('countryCode', v)}
                disabled={!isEditable}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue placeholder={t('location.select_country')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DE">{t('location.countries.DE')}</SelectItem>
                  <SelectItem value="FR">{t('location.countries.FR')}</SelectItem>
                  <SelectItem value="NL">{t('location.countries.NL')}</SelectItem>
                  <SelectItem value="IE">{t('location.countries.IE')}</SelectItem>
                  <SelectItem value="GB">{t('location.countries.GB')}</SelectItem>
                  <SelectItem value="US">{t('location.countries.US')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('location.street')}</Label>
              <Input
                type="text"
                value={formData.address?.street}
                onChange={e => handleAddressChange('street', e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div>
              <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('location.city')}</Label>
              <Input
                type="text"
                value={formData.address?.city}
                onChange={e => handleAddressChange('city', e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div>
              <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('location.postal_code')}</Label>
              <Input
                type="text"
                value={formData.address?.postalCode}
                onChange={e => handleAddressChange('postalCode', e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('location.lead_authority')}</Label>
              <Input
                type="text"
                value={formData.leadSupervisoryAuthority}
                onChange={e => handleChange('leadSupervisoryAuthority', e.target.value)}
                disabled={!isEditable}
                placeholder={t('location.lead_authority_placeholder')}
              />
            </div>
          </div>
        </div>

        {/* Data Protection Officer */}
        <div className="rounded-[14px] border border-set-line bg-set-panel p-[22px]">
          <div className="flex items-center gap-2 mb-6 text-set-fg">
            <UserCheck className="w-4 h-4 text-set-gold" />
            <h2 className="text-[14.5px] font-semibold tracking-[-0.005em]">{t('dpo.title')}</h2>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-3 text-sm font-medium text-set-fg">
              <Switch
                checked={formData.hasDpo}
                onCheckedChange={checked => handleChange('hasDpo', checked)}
                disabled={!isEditable}
              />
              {t('dpo.has_dpo')}
            </label>
            <p className="text-xs text-set-fg-subtle mt-2 ml-12">
              {t('dpo.dpo_hint')}
            </p>
          </div>

          {formData.hasDpo && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6 border-l-2 border-set-line ml-2">
              <div>
                <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('dpo.name')}</Label>
                <Input
                  type="text"
                  value={formData.dpoName}
                  onChange={e => handleChange('dpoName', e.target.value)}
                  disabled={!isEditable}
                />
              </div>
              <div>
                <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('dpo.email')}</Label>
                <Input
                  type="email"
                  value={formData.dpoEmail}
                  onChange={e => handleChange('dpoEmail', e.target.value)}
                  disabled={!isEditable}
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 text-sm font-medium text-set-fg">
                  <Switch
                    checked={formData.dpoIsExternal}
                    onCheckedChange={checked => handleChange('dpoIsExternal', checked)}
                    disabled={!isEditable}
                  />
                  {t('dpo.is_external')}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Branding */}
        <div className="rounded-[14px] border border-set-line bg-set-panel p-[22px]">
          <div className="flex items-center gap-2 mb-6 text-set-fg">
            <Palette className="w-4 h-4 text-set-gold" />
            <h2 className="text-[14.5px] font-semibold tracking-[-0.005em]">{t('branding.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('branding.logo')}</Label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-set-sunken border border-set-line flex items-center justify-center overflow-hidden shrink-0">
                    {formData.branding.logoUrl ? (
                      <img src={formData.branding.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <Building2 className="w-6 h-6 text-set-fg-subtle/50" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isEditable}
                      onClick={handleUploadLogo}
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> {t('branding.upload_logo')}
                    </Button>
                    <p className="text-xs text-set-fg-subtle mt-2">{t('branding.logo_hint')}</p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('branding.primary_color')}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.branding.primaryColor || '#2c3e38'}
                    onChange={e => handleBrandingChange('primaryColor', e.target.value)}
                    disabled={!isEditable}
                    className="w-10 h-10 p-1 bg-set-panel border border-set-line rounded cursor-pointer disabled:opacity-50"
                  />
                  <Input
                    type="text"
                    value={formData.branding.primaryColor || '#2c3e38'}
                    onChange={e => handleBrandingChange('primaryColor', e.target.value)}
                    disabled={!isEditable}
                    className="w-28 font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-[7px] block text-[11.5px] font-medium text-set-fg-muted">{t('branding.trust_portal_preview')}</label>
              <div className="border border-set-line rounded-xl overflow-hidden h-32 bg-set-sunken flex flex-col">
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
                  <div className="w-1/3 h-2 bg-set-line rounded mb-2"></div>
                  <div className="w-1/2 h-2 bg-set-line rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
