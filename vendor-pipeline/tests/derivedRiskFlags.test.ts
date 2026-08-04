import { getDerivedRiskFlags, VendorProfile } from '../src/utils/derivedRiskFlags';

describe('getDerivedRiskFlags', () => {
  test('correctly identifies dpf_only and no_sccs', () => {
    const profile: VendorProfile = {
      name: 'Test Vendor',
      headquartersCountry: 'US',
      parentCompanyCountry: 'US',
      dpaUrl: 'https://test.com/dpa',
      isDpfCertified: true,
      sccsInDpa: false,
      subProcessorNotificationType: 'email',
      dataResidencyOptions: ['eu'],
      breachNotificationTerms: '72 hours',
      dataDeletionOnTermination: '30 days',
      subProcessorObjectionWindow: '14 days'
    };

    const flags = getDerivedRiskFlags(profile);
    expect(flags).toContain('dpf_only');
    expect(flags).toContain('no_sccs');
    expect(flags).toContain('us_parent_company');
  });

  test('correctly flags passive subprocessor notification and no_eu_residency', () => {
    const profile: VendorProfile = {
      name: 'Test Vendor 2',
      headquartersCountry: 'US',
      parentCompanyCountry: null,
      dpaUrl: 'https://test.com/dpa',
      isDpfCertified: false,
      sccsInDpa: true,
      subProcessorNotificationType: 'webpage',
      dataResidencyOptions: ['us'],
      breachNotificationTerms: '72 hours',
      dataDeletionOnTermination: '30 days',
      subProcessorObjectionWindow: '14 days'
    };

    const flags = getDerivedRiskFlags(profile);
    expect(flags).toContain('passive_subprocessor_notification');
    expect(flags).toContain('no_eu_residency');
    expect(flags).not.toContain('no_sccs');
  });

  test('correctly flags undue_delay_breach_terms without numeric cap', () => {
    const profile: VendorProfile = {
      name: 'Test Vendor 3',
      headquartersCountry: 'DE',
      parentCompanyCountry: null,
      dpaUrl: 'https://test.com/dpa',
      isDpfCertified: false,
      sccsInDpa: true,
      subProcessorNotificationType: 'email',
      dataResidencyOptions: ['eu'],
      breachNotificationTerms: 'undue delay without delay',
      dataDeletionOnTermination: '30 days',
      subProcessorObjectionWindow: '14 days'
    };

    const flags = getDerivedRiskFlags(profile);
    expect(flags).toContain('undue_delay_breach_terms');
  });

  test('does not flag undue_delay_breach_terms if numeric cap exists', () => {
    const profile: VendorProfile = {
      name: 'Test Vendor 4',
      headquartersCountry: 'DE',
      parentCompanyCountry: null,
      dpaUrl: 'https://test.com/dpa',
      isDpfCertified: false,
      sccsInDpa: true,
      subProcessorNotificationType: 'email',
      dataResidencyOptions: ['eu'],
      breachNotificationTerms: 'without undue delay and in any event within 72 hours',
      dataDeletionOnTermination: '30 days',
      subProcessorObjectionWindow: '14 days'
    };

    const flags = getDerivedRiskFlags(profile);
    expect(flags).not.toContain('undue_delay_breach_terms');
  });

  test('flags vague deletion timeline and missing objection window', () => {
    const profile: VendorProfile = {
      name: 'Test Vendor 5',
      headquartersCountry: 'FR',
      parentCompanyCountry: null,
      dpaUrl: 'https://test.com/dpa',
      isDpfCertified: false,
      sccsInDpa: true,
      subProcessorNotificationType: 'email',
      dataResidencyOptions: ['eu'],
      breachNotificationTerms: '72 hours',
      dataDeletionOnTermination: 'vague timeline',
      subProcessorObjectionWindow: null
    };

    const flags = getDerivedRiskFlags(profile);
    expect(flags).toContain('no_deletion_timeline');
    expect(flags).toContain('no_objection_window');
  });
});
