import { router, protectedProcedure, requireRole } from '../trpc.js';
import { z } from 'zod';
import { db } from '../db.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  organizations,
  organizationVendors,
  vendors,
  processingActivities,
  processingDataCategories,
  processingRecipients,
  processingTransfers,
  privacyPolicies,
  policyVersions,
  users,
  auditLogs,
  consentDomains
} from 'db';
import { cmpJobsQueue } from '../workers/cmp.js';
import { isAdequateDestination } from '../constants/transferDestinations.js';

export const ROPA_TEMPLATES = {
  marketing_agency: [
    {
      id: 'website_analytics',
      name: 'Website Analytics Tracking',
      description: 'Tracking website visitor behavior for performance optimization',
      purpose: 'To analyze website traffic, measure marketing campaign effectiveness, and optimize user experience through behavioral analytics.',
      lawfulBasis: 'legitimate_interests',
      lawfulBasisDetail: 'Legitimate interest in understanding website performance and optimizing marketing spend.',
      dataSubjectCategories: ['website_visitors'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'ip_address', categoryGroup: 'technical', source: 'automated_collection' },
        { category: 'cookies', categoryGroup: 'technical', source: 'automated_collection' },
        { category: 'browsing_history', categoryGroup: 'behavioral', source: 'automated_collection' },
        { category: 'device_id', categoryGroup: 'technical', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['analytics'],
      retentionPeriod: '24 months',
      securityMeasures: ['encryption_in_transit', 'access_controls', 'pseudonymization'],
    },
    {
      id: 'email_marketing',
      name: 'Email Marketing Campaigns',
      description: 'Sending marketing emails and newsletters to subscribers',
      purpose: 'To send promotional emails, newsletters, and automated marketing sequences to subscribed contacts.',
      lawfulBasis: 'consent',
      lawfulBasisDetail: 'Consent obtained through email signup forms with explicit opt-in.',
      dataSubjectCategories: ['customers', 'website_visitors'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'analysis', 'sharing'],
      dataCategories: [
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email_engagement', categoryGroup: 'behavioral', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['email_marketing'],
      retentionPeriod: 'Until consent is withdrawn',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'access_controls'],
    },
    {
      id: 'crm_management',
      name: 'CRM Contact Management',
      description: 'Managing client and prospect relationships in a CRM system',
      purpose: 'To manage business relationships, track sales opportunities, and maintain client communication history.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary for the performance of contracts with clients and pre-contractual inquiries.',
      dataSubjectCategories: ['customers'],
      estimatedDataSubjects: '<1000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'phone', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'employer', categoryGroup: 'employment', source: 'direct_from_subject' },
        { category: 'job_title', categoryGroup: 'employment', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['crm'],
      retentionPeriod: 'Duration of contract + 6 months',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'access_controls', 'audit_logging'],
    },
    {
      id: 'social_advertising',
      name: 'Social Media Advertising',
      description: 'Running targeted advertising campaigns on social platforms',
      purpose: 'To deliver targeted advertisements to prospective customers on social media platforms using audience data and conversion tracking.',
      lawfulBasis: 'consent',
      lawfulBasisDetail: 'Consent obtained via cookie consent mechanism for tracking and targeting.',
      dataSubjectCategories: ['website_visitors'],
      estimatedDataSubjects: '10000-100000',
      processingType: ['collection', 'sharing', 'analysis'],
      dataCategories: [
        { category: 'cookies', categoryGroup: 'technical', source: 'automated_collection' },
        { category: 'ip_address', categoryGroup: 'technical', source: 'automated_collection' },
        { category: 'browsing_history', categoryGroup: 'behavioral', source: 'automated_collection' },
        { category: 'purchase_history', categoryGroup: 'behavioral', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['advertising'],
      retentionPeriod: '12 months',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    },
    {
      id: 'client_project_management',
      name: 'Client Project Management',
      description: 'Managing client projects, tasks, and deliverables',
      purpose: 'To coordinate project deliverables, track tasks, and manage client communications within project management tools.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary for the performance of client service agreements.',
      dataSubjectCategories: ['customers'],
      estimatedDataSubjects: '<1000',
      processingType: ['collection', 'storage'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'job_title', categoryGroup: 'employment', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['project_management'],
      retentionPeriod: 'Duration of contract + 12 months',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    },
  ],
  ecommerce: [
    {
      id: 'ecommerce_order_processing',
      name: 'Customer Order Processing',
      description: 'Processing online orders, payments, and shipping',
      purpose: 'To process customer orders, process payments, and fulfill deliveries.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary for the performance of a contract to deliver purchased goods.',
      dataSubjectCategories: ['customers'],
      estimatedDataSubjects: '1000-100000',
      processingType: ['collection', 'storage', 'sharing'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'shipping_address', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'phone', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'payment_details', categoryGroup: 'financial', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['ecommerce_platform', 'payment_gateway', 'shipping_provider'],
      retentionPeriod: '7 years for tax and accounting purposes',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'pci_compliance', 'access_controls'],
    },
    {
      id: 'ecommerce_marketing',
      name: 'Marketing Email Campaigns',
      description: 'Sending promotional offers and abandoned cart emails',
      purpose: 'To send marketing communications and abandoned cart reminders to customers and subscribers.',
      lawfulBasis: 'consent',
      lawfulBasisDetail: 'Consent obtained during checkout or via newsletter signup.',
      dataSubjectCategories: ['customers', 'website_visitors'],
      estimatedDataSubjects: '10000-100000',
      processingType: ['collection', 'storage', 'analysis', 'sharing'],
      dataCategories: [
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'purchase_history', categoryGroup: 'behavioral', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['email_marketing'],
      retentionPeriod: 'Until consent is withdrawn',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    },
    {
      id: 'ecommerce_support',
      name: 'Customer Support Tickets',
      description: 'Handling customer inquiries and returns',
      purpose: 'To provide customer support, handle returns, and resolve issues.',
      lawfulBasis: 'legitimate_interests',
      lawfulBasisDetail: 'Legitimate interest in providing customer service and resolving issues.',
      dataSubjectCategories: ['customers'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'order_details', categoryGroup: 'financial', source: 'direct_from_subject' },
        { category: 'support_history', categoryGroup: 'behavioral', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['helpdesk'],
      retentionPeriod: '3 years after last contact',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    }
  ],
  saas: [
    {
      id: 'saas_user_management',
      name: 'User Account Management',
      description: 'Managing user accounts, authentication, and profiles',
      purpose: 'To provide access to the SaaS platform and manage user profiles.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary to provide the software service as per the terms of service.',
      dataSubjectCategories: ['users'],
      estimatedDataSubjects: '1000-100000',
      processingType: ['collection', 'storage'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'password_hash', categoryGroup: 'security', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['identity_provider', 'cloud_hosting'],
      retentionPeriod: 'Duration of account + 30 days',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'access_controls', 'mfa'],
    },
    {
      id: 'saas_product_analytics',
      name: 'Product Usage Analytics',
      description: 'Tracking how users interact with the product',
      purpose: 'To analyze feature usage, identify bugs, and improve the product experience.',
      lawfulBasis: 'legitimate_interests',
      lawfulBasisDetail: 'Legitimate interest in improving the product and understanding user behavior.',
      dataSubjectCategories: ['users'],
      estimatedDataSubjects: '1000-100000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'user_id', categoryGroup: 'technical', source: 'automated_collection' },
        { category: 'feature_usage', categoryGroup: 'behavioral', source: 'automated_collection' },
        { category: 'ip_address', categoryGroup: 'technical', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['product_analytics'],
      retentionPeriod: '24 months',
      securityMeasures: ['encryption_in_transit', 'access_controls', 'pseudonymization'],
    },
    {
      id: 'saas_billing',
      name: 'Customer Billing',
      description: 'Processing subscription payments and invoices',
      purpose: 'To process recurring subscription payments and generate invoices.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary to bill for the service.',
      dataSubjectCategories: ['customers'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'sharing'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'billing_address', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'payment_details', categoryGroup: 'financial', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['payment_gateway', 'billing_software'],
      retentionPeriod: '7 years for tax and accounting purposes',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'pci_compliance', 'access_controls'],
    }
  ],
  recruitment: [
    {
      id: 'recruitment_candidate_processing',
      name: 'Candidate Application Processing',
      description: 'Collecting and reviewing candidate applications',
      purpose: 'To assess candidate suitability for open roles and manage the recruitment pipeline.',
      lawfulBasis: 'legitimate_interests',
      lawfulBasisDetail: 'Legitimate interest in finding suitable candidates for open positions.',
      dataSubjectCategories: ['candidates'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'phone', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'resume_cv', categoryGroup: 'employment', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['ats'],
      retentionPeriod: '6 months after position filled, unless consent given for longer',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    },
    {
      id: 'recruitment_interview_scheduling',
      name: 'Interview Scheduling',
      description: 'Coordinating interview times with candidates',
      purpose: 'To schedule and conduct interviews with candidates.',
      lawfulBasis: 'legitimate_interests',
      lawfulBasisDetail: 'Legitimate interest in facilitating the interview process.',
      dataSubjectCategories: ['candidates'],
      estimatedDataSubjects: '100-1000',
      processingType: ['collection', 'storage', 'sharing'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'calendar_availability', categoryGroup: 'behavioral', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['calendar_tool', 'video_conferencing'],
      retentionPeriod: '6 months after position filled',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    }
  ],
  healthcare: [
    {
      id: 'healthcare_patient_records',
      name: 'Patient Record Management',
      description: 'Managing electronic health records and patient history',
      purpose: 'To provide medical care, maintain patient history, and ensure continuity of care.',
      lawfulBasis: 'vital_interests',
      lawfulBasisDetail: 'Processing necessary for the provision of health or social care or treatment.',
      dataSubjectCategories: ['patients'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'dob', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'medical_history', categoryGroup: 'health', source: 'direct_from_subject' },
        { category: 'test_results', categoryGroup: 'health', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['emr', 'health_cloud'],
      retentionPeriod: '10 years after last treatment (varies by local law)',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'strict_access_controls', 'audit_logging'],
    },
    {
      id: 'healthcare_appointments',
      name: 'Appointment Scheduling',
      description: 'Managing patient appointments and reminders',
      purpose: 'To schedule patient visits and send appointment reminders.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary to fulfill the appointment booking.',
      dataSubjectCategories: ['patients'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'sharing'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'phone', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'appointment_time', categoryGroup: 'behavioral', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['scheduling_software', 'sms_provider'],
      retentionPeriod: '3 years after appointment',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    }
  ],
  legal: [
    {
      id: 'legal_matter_management',
      name: 'Client Matter Management',
      description: 'Managing case files, documents, and client communications',
      purpose: 'To provide legal representation and manage client matters.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary for the performance of a contract to provide legal services.',
      dataSubjectCategories: ['clients', 'third_parties'],
      estimatedDataSubjects: '100-1000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'contact_details', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'case_details', categoryGroup: 'legal', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['practice_management', 'document_management'],
      retentionPeriod: '7 years after matter closed (varies by jurisdiction)',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'strict_access_controls', 'audit_logging'],
    },
    {
      id: 'legal_conflict_checking',
      name: 'Conflict Checking',
      description: 'Checking for conflicts of interest before taking on a new client',
      purpose: 'To ensure compliance with professional conduct rules regarding conflicts of interest.',
      lawfulBasis: 'legal_obligation',
      lawfulBasisDetail: 'Processing necessary to comply with legal/professional obligations.',
      dataSubjectCategories: ['clients', 'prospective_clients'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'company_name', categoryGroup: 'employment', source: 'direct_from_subject' },
        { category: 'matter_description', categoryGroup: 'legal', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['practice_management'],
      retentionPeriod: 'Indefinitely (for conflict checking purposes)',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    }
  ],
  consulting: [
    {
      id: 'consulting_engagement_management',
      name: 'Client Engagement Management',
      description: 'Managing consulting projects, deliverables, and communications',
      purpose: 'To deliver consulting services as per client agreements.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary for the performance of a consulting contract.',
      dataSubjectCategories: ['clients'],
      estimatedDataSubjects: '100-1000',
      processingType: ['collection', 'storage', 'sharing'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'job_title', categoryGroup: 'employment', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['project_management', 'collaboration_tools'],
      retentionPeriod: 'Duration of contract + 6 years',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    }
  ],
  real_estate: [
    {
      id: 'real_estate_property_listings',
      name: 'Property Listing Management',
      description: 'Managing property listings and inquiries',
      purpose: 'To market properties and handle inquiries from potential buyers/tenants.',
      lawfulBasis: 'legitimate_interests',
      lawfulBasisDetail: 'Legitimate interest in marketing properties and matching buyers with sellers.',
      dataSubjectCategories: ['clients', 'prospects'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'sharing'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'contact_details', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'property_preferences', categoryGroup: 'behavioral', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['crm', 'property_management'],
      retentionPeriod: '3 years after last contact',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    },
    {
      id: 'real_estate_tenant_screening',
      name: 'Tenant Screening',
      description: 'Processing tenant applications and background checks',
      purpose: 'To assess the suitability of prospective tenants for rental properties.',
      lawfulBasis: 'legitimate_interests',
      lawfulBasisDetail: 'Legitimate interest in ensuring reliable tenants for landlords.',
      dataSubjectCategories: ['applicants'],
      estimatedDataSubjects: '100-1000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'financial_history', categoryGroup: 'financial', source: 'third_party' },
        { category: 'employment_details', categoryGroup: 'employment', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['background_check_provider'],
      retentionPeriod: '1 year after application decision',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'access_controls'],
    }
  ],
  education: [
    {
      id: 'education_student_enrollment',
      name: 'Student Enrollment',
      description: 'Processing student applications and enrollment data',
      purpose: 'To manage the admissions process and enroll students in courses.',
      lawfulBasis: 'public_task',
      lawfulBasisDetail: 'Processing necessary for the performance of a task carried out in the public interest (for public institutions) or contract (private).',
      dataSubjectCategories: ['students', 'parents'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'dob', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'academic_records', categoryGroup: 'education', source: 'direct_from_subject' },
        { category: 'contact_details', categoryGroup: 'contact', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['sis', 'lms'],
      retentionPeriod: 'Duration of enrollment + statutory retention period',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'access_controls'],
    }
  ],
  generic: [
    {
      id: 'generic_customer_management',
      name: 'Customer/Client Management',
      description: 'Managing customer records and communications',
      purpose: 'To manage business relationships and fulfill contracts.',
      lawfulBasis: 'contract',
      lawfulBasisDetail: 'Processing necessary for the performance of a contract.',
      dataSubjectCategories: ['customers'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'phone', categoryGroup: 'contact', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['crm'],
      retentionPeriod: 'Duration of relationship + 6 years',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    },
    {
      id: 'generic_employee_records',
      name: 'Employee Records',
      description: 'Managing HR data, payroll, and benefits',
      purpose: 'To manage employment relationships, run payroll, and provide benefits.',
      lawfulBasis: 'legal_obligation',
      lawfulBasisDetail: 'Processing necessary to comply with employment law obligations.',
      dataSubjectCategories: ['employees'],
      estimatedDataSubjects: '10-1000',
      processingType: ['collection', 'storage', 'sharing'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'ssn_tax_id', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'bank_details', categoryGroup: 'financial', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['hris', 'payroll_provider'],
      retentionPeriod: 'Duration of employment + 6 years (or statutory requirement)',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'strict_access_controls'],
    },
    {
      id: 'generic_email_marketing',
      name: 'Email Marketing',
      description: 'Sending newsletters and promotional emails',
      purpose: 'To market products/services to interested parties.',
      lawfulBasis: 'consent',
      lawfulBasisDetail: 'Consent obtained via opt-in forms.',
      dataSubjectCategories: ['prospects', 'customers'],
      estimatedDataSubjects: '1000-10000',
      processingType: ['collection', 'storage', 'sharing'],
      dataCategories: [
        { category: 'email', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['email_marketing'],
      retentionPeriod: 'Until consent is withdrawn',
      securityMeasures: ['encryption_in_transit', 'access_controls'],
    },
    {
      id: 'generic_website_analytics',
      name: 'Website Analytics',
      description: 'Tracking website visitor traffic and behavior',
      purpose: 'To understand website usage and improve the user experience.',
      lawfulBasis: 'legitimate_interests',
      lawfulBasisDetail: 'Legitimate interest in monitoring website performance.',
      dataSubjectCategories: ['website_visitors'],
      estimatedDataSubjects: '10000-100000',
      processingType: ['collection', 'storage', 'analysis'],
      dataCategories: [
        { category: 'ip_address', categoryGroup: 'technical', source: 'automated_collection' },
        { category: 'browsing_history', categoryGroup: 'behavioral', source: 'automated_collection' },
      ],
      suggestedVendorCategories: ['analytics'],
      retentionPeriod: '14-24 months',
      securityMeasures: ['encryption_in_transit', 'pseudonymization'],
    },
    {
      id: 'generic_accounting',
      name: 'Accounting and Invoicing',
      description: 'Managing financial records, invoices, and expenses',
      purpose: 'To maintain accurate financial records and comply with tax laws.',
      lawfulBasis: 'legal_obligation',
      lawfulBasisDetail: 'Processing necessary to comply with tax and accounting legal obligations.',
      dataSubjectCategories: ['customers', 'suppliers', 'employees'],
      estimatedDataSubjects: '100-1000',
      processingType: ['collection', 'storage', 'sharing'],
      dataCategories: [
        { category: 'full_name', categoryGroup: 'identity', source: 'direct_from_subject' },
        { category: 'billing_address', categoryGroup: 'contact', source: 'direct_from_subject' },
        { category: 'transaction_history', categoryGroup: 'financial', source: 'direct_from_subject' },
      ],
      suggestedVendorCategories: ['accounting_software'],
      retentionPeriod: '7 years for tax authorities',
      securityMeasures: ['encryption_in_transit', 'encryption_at_rest', 'access_controls'],
    }
  ]
};
export const onboardingRouter = router({
  getStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const [org] = await ctx.db.select({
        onboardingCompleted: organizations.onboardingCompleted,
        onboardingDismissed: organizations.onboardingDismissed,
        onboardingStep: organizations.onboardingStep,
        settings: organizations.settings,
      }).from(organizations).where(eq(organizations.id, ctx.user!.orgId));

      return org;
    }),

  saveOrgProfile: protectedProcedure
    .use(requireRole('owner'))
    .input(z.object({
      name: z.string().min(1),
      legalName: z.string().optional(),
      countryCode: z.string().length(2),
      industry: z.string().optional(),
      companySize: z.string().optional(),
      hasDpo: z.boolean().default(false),
      dpoName: z.string().optional(),
      dpoEmail: z.string().email().optional().or(z.literal('')),
      leadSupervisoryAuthority: z.string().optional(),
      slug: z.string().min(1),
      websiteUrl: z.string().optional().or(z.literal('')),
    }))
    .mutation(async ({ ctx, input }) => {
      const { industry, companySize, websiteUrl, ...orgData } = input;

      const [org] = await ctx.db.update(organizations)
        .set({
          ...orgData,
          settings: sql`jsonb_set(
            jsonb_set(
              jsonb_set(COALESCE(settings, '{}'::jsonb), '{industry}', ${JSON.stringify(industry)}::jsonb, true),
              '{companySize}', ${JSON.stringify(companySize)}::jsonb, true
            ),
            '{websiteUrl}', ${JSON.stringify(websiteUrl || '')}::jsonb, true
          )`,
          onboardingStep: 1,
        })
        .where(eq(organizations.id, ctx.user!.orgId))
        .returning();

      // Trigger cookie scan if websiteUrl is provided
      if (websiteUrl) {
        try {
          const getDomainName = (urlStr: string): string => {
            try {
              const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
              return url.hostname.replace(/^www\./, '');
            } catch (e) {
              return urlStr.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || '';
            }
          };

          const domainName = getDomainName(websiteUrl);

          // Check if domain already exists for this org
          const [existing] = await ctx.db.select()
            .from(consentDomains)
            .where(and(
              eq(consentDomains.organizationId, ctx.user!.orgId),
              eq(consentDomains.domain, domainName)
            ));

          if (!existing) {
            const scriptId = Math.random().toString(36).substring(2, 10);
            const [newDomain] = await ctx.db.insert(consentDomains).values({
              organizationId: ctx.user!.orgId,
              domain: domainName,
              scriptId,
            }).returning();

            // Trigger the cookie scanner background task
            await cmpJobsQueue.add('cookie-scanner', {
              domainId: newDomain.id,
              correlationId: (ctx.req as any).correlationId
            });
            console.log(`[Onboarding] Triggered cookie scan for domain: ${domainName}`);
          }
        } catch (scanErr: any) {
          console.error('[Onboarding] Failed to trigger cookie scan:', scanErr.message);
        }
      }

      return org;
    }),

  saveVendors: protectedProcedure
    .input(z.object({
      vendorIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const resolvedVendorIds: string[] = [];

      for (const id of input.vendorIds) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        if (isUuid) {
          resolvedVendorIds.push(id);
        } else {
          // Normalize the name/slug
          const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          
          // Try to find an existing global or local vendor
          const [found] = await ctx.db.select()
            .from(vendors)
            .where(eq(vendors.slug, slug));

          if (found) {
            resolvedVendorIds.push(found.id);
          } else {
            // Create a custom vendor for this organization
            const name = id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const [newVendor] = await ctx.db.insert(vendors).values({
              organizationId: ctx.user!.orgId,
              name,
              slug,
              isGlobal: false,
              description: 'Manually added during onboarding',
              category: 'Custom Tools',
            }).returning();
            resolvedVendorIds.push(newVendor.id);
          }
        }
      }

      if (resolvedVendorIds.length > 0) {
        // Find existing organization vendors to avoid duplication
        const existing = await ctx.db.select({ vendorId: organizationVendors.vendorId })
          .from(organizationVendors)
          .where(and(
            eq(organizationVendors.organizationId, ctx.user!.orgId),
            inArray(organizationVendors.vendorId, resolvedVendorIds)
          ));

        const existingIds = existing.map((e: any) => e.vendorId);
        const toAdd = resolvedVendorIds.filter((id: any) => !existingIds.includes(id));

        if (toAdd.length > 0) {
          await ctx.db.insert(organizationVendors).values(
            toAdd.map((id: any) => ({
              organizationId: ctx.user!.orgId,
              vendorId: id,
              dpaStatus: 'not_started',
            }))
          );
        }
      }

      await ctx.db.update(organizations)
        .set({ onboardingStep: 2 })
        .where(eq(organizations.id, ctx.user!.orgId));

      return { success: true };
    }),

  getTemplates: protectedProcedure
    .input(z.object({ industry: z.string().default('generic') }))
    .query(async ({ ctx, input }) => {
      const industry = input.industry as keyof typeof ROPA_TEMPLATES;
      return ROPA_TEMPLATES[industry] || ROPA_TEMPLATES.generic;
    }),

  createFromTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      industry: z.string().default('generic')
    }))
    .mutation(async ({ ctx, input }) => {
      const industry = input.industry as keyof typeof ROPA_TEMPLATES;
      const templates = ROPA_TEMPLATES[industry] || ROPA_TEMPLATES.generic;
      const template = templates.find(t => t.id === input.templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      // Create main processing activity
      const [activity] = await ctx.db.insert(processingActivities).values({
        organizationId: ctx.user!.orgId,
        name: template.name,
        description: template.description,
        purpose: template.purpose,
        lawfulBasis: template.lawfulBasis,
        lawfulBasisDetail: template.lawfulBasisDetail,
        dataSubjectCategories: template.dataSubjectCategories,
        estimatedDataSubjects: template.estimatedDataSubjects,
        processingType: template.processingType,
        retentionPeriod: template.retentionPeriod,
        securityMeasures: template.securityMeasures,

      }).returning();

      // Insert data categories
      if (template.dataCategories.length > 0) {
        await ctx.db.insert(processingDataCategories).values(
          template.dataCategories.map((cat: any) => ({
            processingActivityId: activity!.id,
            category: cat.category,
            categoryGroup: cat.categoryGroup,
            source: cat.source,
          }))
        );
      }

      // Link to existing organization vendors based on suggested categories
      if (template.suggestedVendorCategories.length > 0) {
        // Fetch org's vendors that match the suggested categories
        const matchingVendors = await ctx.db.select({
          id: vendors.id,
          name: vendors.name,
          category: vendors.category,
          headquartersCountry: vendors.headquartersCountry,
          orgVendorId: organizationVendors.id,
          usingEuHosting: organizationVendors.usingEuHosting,
        })
        .from(organizationVendors)
        .innerJoin(vendors, eq(organizationVendors.vendorId, vendors.id))
        .where(and(
          eq(organizationVendors.organizationId, ctx.user!.orgId),
          inArray(vendors.category, template.suggestedVendorCategories)
        ));

        for (const vendor of matchingVendors) {
          // Add as recipient
          await ctx.db.insert(processingRecipients).values({
            processingActivityId: activity!.id,
            recipientType: 'vendor',
            name: vendor.name,
            vendorId: vendor.id,
          });

          // Check if non-EU transfer needs to be created
          const hq = vendor.headquartersCountry;
          const isEuHq = hq && isAdequateDestination(hq);
          const hasEuHosting = vendor.usingEuHosting;

          if (!isEuHq && !hasEuHosting && hq) {
            await ctx.db.insert(processingTransfers).values({
              processingActivityId: activity!.id,
              destinationCountry: hq.substring(0, 2),
              destinationEntity: vendor.name,
              vendorId: vendor.id,
              transferMechanism: 'pending_assessment',
            });
          }
        }
      }

      await ctx.db.update(organizations)
        .set({ onboardingStep: 3 })
        .where(eq(organizations.id, ctx.user!.orgId));

      return activity;
    }),

  generatePolicy: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
      // Stub for policy generation - creates the draft record
      // In reality this might call the AI or template engine

      const [org] = await ctx.db.select({ slug: organizations.slug })
        .from(organizations)
        .where(eq(organizations.id, ctx.user!.orgId));

      const [policy] = await ctx.db.insert(privacyPolicies).values({
        organizationId: ctx.user!.orgId,
        name: 'Website Privacy Policy',

        type: 'privacy_policy',
        language: 'en',

      }).returning();

      await ctx.db.insert(policyVersions).values({
        policyId: policy!.id,
        versionNumber: 1,
        contentHtml: '# Privacy Policy\n\nThis policy is auto-generated based on your Processing Activities.', contentMarkdown: '# Privacy Policy\n\nThis policy is auto-generated based on your Processing Activities.',

        createdBy: ctx.user!.id,
      });

      await ctx.db.update(organizations)
        .set({ onboardingStep: 4 })
        .where(eq(organizations.id, ctx.user!.orgId));

      return { policyId: policy!.id, publicUrlPath: `/legal/${org?.slug}/privacy` };
    }),

  publishPolicy: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({ policyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(privacyPolicies)
        .set({ publishedAt: new Date() })
        .where(and(
          eq(privacyPolicies.id, input.policyId),
          eq(privacyPolicies.organizationId, ctx.user!.orgId)
        ));

      return { success: true };
    }),

  inviteTeam: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      invites: z.array(z.object({
        email: z.string().email(),
        role: z.string()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      // Just record they are invited (this would normally queue emails)
      for (const invite of input.invites) {
        // Check if user exists
        const [existingUser] = await ctx.db.select().from(users).where(eq(users.email, invite.email));
        if (!existingUser) {
          await ctx.db.insert(users).values({
            email: invite.email,
            role: invite.role,
            organizationId: ctx.user!.orgId,
            name: invite.email.split('@')[0],
            invitedAt: new Date(),
          } as any);
        }
      }

      await ctx.db.update(organizations)
        .set({ onboardingStep: 5 })
        .where(eq(organizations.id, ctx.user!.orgId));

      return { success: true };
    }),

  complete: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.update(organizations)
        .set({
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          onboardingStep: 6
        })
        .where(eq(organizations.id, ctx.user!.orgId));

      return { success: true };
    }),

  dismiss: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.update(organizations)
        .set({ onboardingDismissed: true })
        .where(eq(organizations.id, ctx.user!.orgId));

      return { success: true };
    }),

  resume: protectedProcedure
    .mutation(async ({ ctx }) => {
      const [org] = await ctx.db.select({ onboardingStep: organizations.onboardingStep })
        .from(organizations)
        .where(eq(organizations.id, ctx.user!.orgId));

      return { step: org?.onboardingStep || 0 };
    }),
});
