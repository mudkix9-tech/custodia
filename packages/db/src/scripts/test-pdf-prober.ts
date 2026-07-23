import { verifyComplianceUrl } from './gather-vendors.js';

const TESTS = [
  {
    name: '1. Valid PDF DPA (Salesforce)',
    url: 'https://www.salesforce.com/content/dam/web/en_us/www/documents/legal/Agreements/data-processing-addendum.pdf',
    type: 'dpa' as const,
    website: 'https://www.salesforce.com',
    expected: 'verified_probed_success'
  },
  {
    name: '2. Oversized PDF (Adobe PDF Reference ~30MB)',
    url: 'https://www.adobe.com/content/dam/Adobe/en/devnet/acrobat/pdfs/pdf_reference_1-7.pdf',
    type: 'dpa' as const,
    website: 'https://www.adobe.com',
    expected: 'partially_probed'
  },
  {
    name: '3. Scanned/Empty PDF (W3C Dummy - very short text)',
    url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    type: 'dpa' as const,
    website: 'https://www.w3.org',
    expected: 'partially_probed'
  },
  {
    name: '4. Legitimate PDF but NOT a DPA (Salesforce Add-ons Pricing)',
    url: 'https://www.salesforce.com/content/dam/web/en_us/www/documents/pricing/all-add-ons.pdf',
    type: 'dpa' as const,
    website: 'https://www.salesforce.com',
    expected: 'partially_probed'
  }
];

async function runTests() {
  console.log('\n🧪 Starting PDF Prober Tests...');
  const { verifyComplianceUrl } = await import('./gather-vendors.js');

  for (const test of TESTS) {
    console.log(`\n▶️ Running: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    
    const result = await verifyComplianceUrl(test.url, test.type, test.website);
    
    console.log(`   Result: ${result.status}`);
    if (result.status === test.expected) {
      console.log(`   ✅ PASS (Expected: ${test.expected})`);
    } else {
      console.log(`   ❌ FAIL (Expected: ${test.expected}, Got: ${result.status})`);
    }
  }
}

runTests().catch(console.error);
