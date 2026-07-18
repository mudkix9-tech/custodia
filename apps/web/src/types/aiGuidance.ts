export interface RopaFormData {
  name: string;
  purpose: string;
  description?: string;
  lawfulBasis: string;
  retentionPeriod?: string;
  selectedTools?: string[];
}

export interface VendorFormData {
  name: string;
  headquartersCountry?: string;
  euHostingAvailable?: boolean;
  securityCertifications?: string[];
  transferMechanisms?: string[];
  dpaStatus?: string;
}

export interface BreachFormData {
  title?: string;
  discoveredAt?: string;
  description?: string;
  dataCategoriesAffected?: string[];
  estimatedRecordsAffected?: number;
}

export interface DsarFormData {
  referenceNumber?: string;
  requestType?: string;
  originalMessage?: string;
  receivedAt?: string;
}

export interface ConsentFormData {
  domain: string;
  cookies?: { cookieName: string; cookieDomain?: string; category: string; provider?: string }[];
}

export interface ComplianceScoringFormData {
  title?: string;
  description?: string;
  severity?: string;
  gdprArticles?: string[];
}

export type GuidanceContext =
  | { module: 'ropa'; entityId?: string | null; formData?: RopaFormData }
  | { module: 'vendors'; entityId: string; formData?: VendorFormData }
  | { module: 'breaches'; entityId: string; formData?: BreachFormData }
  | { module: 'dsar'; entityId: string; formData?: DsarFormData }
  | { module: 'consent'; entityId: string; formData?: ConsentFormData }
  | { module: 'compliance_scoring'; entityId: string; formData?: ComplianceScoringFormData }
  | null;
