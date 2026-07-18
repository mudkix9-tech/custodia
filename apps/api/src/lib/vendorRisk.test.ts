import { calculateVendorRisk } from './vendorRisk.js';

function runTests() {
  console.log('Starting calculateVendorRisk unit tests...');

  // Test Case 1: Low Risk Vendor (EU-based, signed DPA, standard data, low volume, certs, etc.)
  const result1 = calculateVendorRisk(
    {
      headquartersCountry: 'DE', // EU
      securityCertifications: ['soc2_type2', 'iso27001'],
      transferMechanisms: [],
      knownIncidents: []
    },
    {
      dpaStatus: 'signed',
      dpaExpiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days out
      dataCategoriesShared: ['name', 'email'],
      dataSubjectVolume: '<1K',
      certifications: [],
      transferMechanisms: []
    },
    0 // 0 sub-processors
  );

  console.log('Test Case 1 (Low Risk) score:', result1.score);
  if (result1.score !== 0) {
    throw new Error(`Expected score 0, got ${result1.score}`);
  }
  if (result1.level !== 'low') {
    throw new Error(`Expected level low, got ${result1.level}`);
  }

  // Test Case 2: High Risk Vendor (US-based, missing DPA, special category data, 100K+ subjects, no certs, etc.)
  const result2 = calculateVendorRisk(
    {
      headquartersCountry: 'US', // Non-adequate third country
      securityCertifications: [],
      transferMechanisms: [],
      knownIncidents: [
        { date: new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000) } // breach 3 months ago
      ]
    },
    {
      dpaStatus: 'not_signed',
      dataCategoriesShared: ['health_records', 'biometric_data'],
      dataSubjectVolume: '100K+',
      certifications: [],
      transferMechanisms: []
    },
    5 // 5 sub-processors
  );

  console.log('Test Case 2 (Critical Risk) score:', result2.score);
  // Expected breakdown:
  // Location: US (non-adequate) = 20 pts
  // DPA: Missing = 20 pts
  // Categories: Special (biometric/health) = 15 pts
  // Volume: 100K+ = 10 pts
  // Sub-processors: 5 (4+) = 10 pts
  // Certifications: None = 10 pts
  // Safeguards: US (non-adequate) + no safeguards = 10 pts
  // Breach: <6 months = 5 pts
  // Total = 20 + 20 + 15 + 10 + 10 + 10 + 10 + 5 = 100 pts!
  if (result2.score !== 100) {
    console.log("Factors breakdown:", JSON.stringify(result2.factors, null, 2));
    throw new Error(`Expected score 100, got ${result2.score}`);
  }
  if (result2.level !== 'critical') {
    throw new Error(`Expected level critical, got ${result2.level}`);
  }

  // Test Case 3: Medium Risk Vendor (US-based but with SCCs, signed DPA expiring in 30 days, ISO 27001 cert, etc.)
  const result3 = calculateVendorRisk(
    {
      headquartersCountry: 'US',
      securityCertifications: ['iso27001'],
      transferMechanisms: ['standard_contractual_clauses'],
      knownIncidents: []
    },
    {
      dpaStatus: 'signed',
      dpaExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // expiring in 30 days
      dataCategoriesShared: ['name', 'email'],
      dataSubjectVolume: '1K-10K',
      certifications: [],
      transferMechanisms: []
    },
    2 // 2 sub-processors
  );

  console.log('Test Case 3 (Medium Risk) score:', result3.score);
  // Expected breakdown:
  // Location: US = 20 pts
  // DPA: Expiring in 30 days = 10 pts
  // Categories: Standard = 0 pts
  // Volume: 1K-10K = 3 pts
  // Sub-processors: 2 = 5 pts
  // Certifications: 1 cert = 5 pts
  // Safeguards: US + SCCs = 0 pts
  // Breach: None = 0 pts
  // Total = 20 + 10 + 0 + 3 + 5 + 5 + 0 + 0 = 43 pts
  if (result3.score !== 43) {
    throw new Error(`Expected score 43, got ${result3.score}`);
  }
  if (result3.level !== 'medium') {
    throw new Error(`Expected level medium, got ${result3.level}`);
  }

  console.log('All calculateVendorRisk unit tests passed successfully!');
}

runTests();
