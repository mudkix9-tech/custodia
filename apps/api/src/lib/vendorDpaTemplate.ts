/**
 * Standard GDPR Article 28(3) Data Processing Addendum (DPA) Generator.
 *
 * Generates a complete, statutory Data Processing Addendum covering all 8
 * mandatory Article 28(3) requirements when an organization needs to issue
 * an agreement to a processor that lacks its own acceptable terms.
 */

export interface DpaTemplateParams {
  controllerName: string;
  controllerAddress?: string;
  controllerContactEmail?: string;
  processorName: string;
  processorAddress?: string;
  processorContactEmail?: string;
  effectiveDate?: string;
  purposeOfProcessing?: string;
  dataCategories?: string[];
  dataSubjectTypes?: string[];
  securityMeasuresOverview?: string;
  authorizedSubProcessors?: Array<{ name: string; country?: string; service?: string }>;
}

export function generateStandardArticle28Dpa(params: DpaTemplateParams): string {
  const date = params.effectiveDate || new Date().toISOString().split('T')[0];
  const categories = params.dataCategories?.length
    ? params.dataCategories.join(', ')
    : 'Standard commercial and account identification data';
  const subjects = params.dataSubjectTypes?.length
    ? params.dataSubjectTypes.join(', ')
    : 'Employees, customers, and business contacts of Controller';

  return `# DATA PROCESSING ADDENDUM (GDPR ARTICLE 28)

**Effective Date:** ${date}

This Data Processing Addendum ("**DPA**") supplements the principal service agreement entered into between:

1. **${params.controllerName}** ("**Controller**"), with contact at ${params.controllerContactEmail || 'the registered office'}, and
2. **${params.processorName}** ("**Processor**"), with contact at ${params.processorContactEmail || 'the registered office'}.

---

## 1. Scope, Role and Subject Matter
1.1 The parties acknowledge that for the purposes of Regulation (EU) 2016/679 ("**GDPR**"), ${params.controllerName} acts as **Data Controller** and ${params.processorName} acts as **Data Processor**.
1.2 **Subject Matter & Purpose:** ${params.purposeOfProcessing || 'Provision of software and IT processing services as specified in the principal agreement.'}
1.3 **Categories of Personal Data:** ${categories}.
1.4 **Categories of Data Subjects:** ${subjects}.

---

## 2. Mandatory Article 28(3) Obligations

### 2.1 Documented Instructions (Art. 28(3)(a))
Processor shall process Personal Data exclusively on documented instructions from Controller, including with regard to transfers of personal data to a third country or an international organisation, unless required to do so by Union or Member State law to which Processor is subject.

### 2.2 Personnel Confidentiality (Art. 28(3)(b))
Processor ensures that persons authorised to process the personal data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality.

### 2.3 Security of Processing (Art. 28(3)(c) / Art. 32)
Processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including encryption, ongoing confidentiality, integrity, availability and resilience of processing systems.

### 2.4 Sub-Processors (Art. 28(3)(d))
Processor shall not engage another processor without prior specific or general written authorisation of Controller. Processor shall inform Controller of any intended changes concerning the addition or replacement of sub-processors, giving Controller the right to object. Processor imposes equivalent data protection obligations on every sub-processor.

### 2.5 Assistance with Data Subject Rights (Art. 28(3)(e))
Taking into account the nature of the processing, Processor shall assist Controller by appropriate technical and organisational measures, insofar as this is possible, for the fulfilment of Controller’s obligation to respond to requests for exercising data subjects' rights under Chapter III GDPR.

### 2.6 Assistance with Breaches & DPIAs (Art. 28(3)(f))
Processor shall assist Controller in ensuring compliance with obligations pursuant to Articles 32 to 36 GDPR. Processor shall notify Controller without undue delay (and in any event within 48 hours) upon becoming aware of a personal data breach.

### 2.7 Deletion or Return of Data (Art. 28(3)(g))
At the choice of Controller, Processor shall delete or return all personal data to Controller after the end of the provision of services, and delete existing copies unless Union or Member State law requires storage.

### 2.8 Audits and Inspections (Art. 28(3)(h))
Processor shall make available to Controller all information necessary to demonstrate compliance with Article 28 GDPR and allow for and contribute to audits, including inspections, conducted by Controller or an auditor mandated by Controller.

---

## Schedule 1: Security Measures & Sub-Processors
- **Security Baseline:** ${params.securityMeasuresOverview || 'ISO 27001 / SOC 2 aligned encryption at rest and in transit, multi-factor authentication, and automated backup.'}
- **Approved Sub-Processors:** ${
    params.authorizedSubProcessors?.length
      ? params.authorizedSubProcessors.map((s) => `${s.name} (${s.country || 'EU'}, ${s.service || 'Hosting'})`).join('; ')
      : 'As published on Processor’s verified sub-processor directory.'
  }

---
*Generated by Custodia GDPR Compliance Platform*
`;
}
