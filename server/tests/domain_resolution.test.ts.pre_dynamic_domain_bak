/**
 * Domain & Subdomain Resolution Test Suite
 * Tests preview container, Render service URLs, production apex/www,
 * reserved system subdomains, and genuine reseller subdomains.
 */

// Node.js test environment polyfill for browser globals before module import
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
};

const { resolveResellerSubdomain } = await import('../../src/App.tsx');

interface TestCase {
  name: string;
  host: string;
  search?: string;
  expected: string | null;
}

const testCases: TestCase[] = [
  {
    name: 'AI Studio Dev Cloud Preview URL (fixes "Domain Not Configured" error in preview)',
    host: 'ais-dev-mftwiggt5sq4z6qkhzzpxm-3983610250.asia-east1.run.app',
    expected: null,
  },
  {
    name: 'AI Studio Shared Pre Cloud Preview URL',
    host: 'ais-pre-mftwiggt5sq4z6qkhzzpxm-3983610250.asia-east1.run.app',
    expected: null,
  },
  {
    name: 'Render Default Web Service Hostname',
    host: 'tssdigitalbd-shop-5cwr.onrender.com',
    expected: null,
  },
  {
    name: 'Render Custom Service Subdomain',
    host: 'tssdigitalbd-shop-5cwr.ssdigitalbd.shop',
    expected: null,
  },
  {
    name: 'Production Apex Domain (ssdigitalbd.shop)',
    host: 'ssdigitalbd.shop',
    expected: null,
  },
  {
    name: 'Production WWW Domain (www.ssdigitalbd.shop)',
    host: 'www.ssdigitalbd.shop',
    expected: null,
  },
  {
    name: 'Localhost development',
    host: 'localhost',
    expected: null,
  },
  {
    name: '127.0.0.1 IP development',
    host: '127.0.0.1',
    expected: null,
  },
  {
    name: 'Genuine Reseller Subdomain (rahim.ssdigitalbd.shop)',
    host: 'rahim.ssdigitalbd.shop',
    expected: 'rahim',
  },
  {
    name: 'Reserved Subdomain: admin.ssdigitalbd.shop',
    host: 'admin.ssdigitalbd.shop',
    expected: null,
  },
  {
    name: 'Reserved Subdomain: cpanel.ssdigitalbd.shop',
    host: 'cpanel.ssdigitalbd.shop',
    expected: null,
  },
  {
    name: 'Reserved Subdomain: api.ssdigitalbd.shop',
    host: 'api.ssdigitalbd.shop',
    expected: null,
  },
  {
    name: 'Testing Query Param Override (?domain=rahim)',
    host: 'ssdigitalbd.shop',
    search: '?domain=rahim',
    expected: 'rahim',
  },
  {
    name: 'Testing Query Param Override (?store=techzone)',
    host: 'www.ssdigitalbd.shop',
    search: '?store=techzone',
    expected: 'techzone',
  },
];

console.log('--- RUNNING DOMAIN & SUBDOMAIN RESOLUTION TESTS ---');
let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = resolveResellerSubdomain(tc.host, tc.search || '');
  if (result === tc.expected) {
    console.log(`[PASS] ${tc.name} -> ${JSON.stringify(result)}`);
    passed++;
  } else {
    console.error(`[FAIL] ${tc.name} -> Expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(result)}`);
    failed++;
  }
}

console.log(`\nTOTAL: ${passed}/${testCases.length} PASSED.`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
