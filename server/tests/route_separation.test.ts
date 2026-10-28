/**
 * Route Separation & RBAC Verification Test Suite
 * Tests strict path resolution, Express direct navigation, and server API authorization.
 */

// Polyfill browser globals for App.tsx in Node environment
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
};

import http from 'http';
import app from '../../server.ts';
import { db } from '../db/store.ts';
import { createSession } from '../api/routes.ts';

const { getRouteFromPathname, resolveResellerSubdomain } = await import('../../src/App.tsx');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function makeRequest(
  server: http.Server,
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: any } = {}
): Promise<{ status: number; headers: any; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const port = addr.port;

    const postData = options.body ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- RUNNING STRICT ROUTE SEPARATION TEST SUITE ---');

  // Test 1: Frontend Route Resolution from Pathname
  try {
    assert(getRouteFromPathname('/') === 'home', "Path '/' must resolve to 'home'");
    assert(getRouteFromPathname('/admin') === 'admin', "Path '/admin' must resolve to 'admin'");
    assert(getRouteFromPathname('/admin/orders') === 'admin', "Path '/admin/orders' must resolve to 'admin'");
    assert(getRouteFromPathname('/reseller') === 'reseller', "Path '/reseller' must resolve to 'reseller'");
    assert(getRouteFromPathname('/reseller/wallet') === 'reseller', "Path '/reseller/wallet' must resolve to 'reseller'");
    assert(getRouteFromPathname('/customer') === 'customer', "Path '/customer' must resolve to 'customer'");
    assert(getRouteFromPathname('/customer/orders') === 'customer', "Path '/customer/orders' must resolve to 'customer'");
    assert(getRouteFromPathname('/unknown-path') === 'home', "Unrecognized path must safely fallback to 'home'");
    results.push({ name: 'ROUTE-01: Client path-to-route resolution covers all 4 portals', passed: true });
  } catch (err: any) {
    results.push({ name: 'ROUTE-01: Client path-to-route resolution', passed: false, error: err.message });
  }

  // Start ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    // Test 2: Express Direct Navigation & Refresh on /
    const homeRes = await makeRequest(server, '/');
    assert(homeRes.status === 200, `Expected 200 on '/', got ${homeRes.status}`);
    results.push({ name: 'SERVER-01: Direct navigation and refresh on "/" returns 200', passed: true });

    // Test 3: Express Direct Navigation & Refresh on /admin
    const adminRes = await makeRequest(server, '/admin');
    assert(adminRes.status === 200, `Expected 200 on '/admin', got ${adminRes.status}`);
    results.push({ name: 'SERVER-02: Direct navigation and refresh on "/admin" returns 200', passed: true });

    // Test 4: Express Direct Navigation & Refresh on /reseller
    const resellerRes = await makeRequest(server, '/reseller');
    assert(resellerRes.status === 200, `Expected 200 on '/reseller', got ${resellerRes.status}`);
    results.push({ name: 'SERVER-03: Direct navigation and refresh on "/reseller" returns 200', passed: true });

    // Test 5: Express Direct Navigation & Refresh on /customer
    const customerRes = await makeRequest(server, '/customer');
    assert(customerRes.status === 200, `Expected 200 on '/customer', got ${customerRes.status}`);
    results.push({ name: 'SERVER-04: Direct navigation and refresh on "/customer" returns 200', passed: true });

    // Test 6: API Isolation (Unrecognized API routes return 404 JSON)
    const api404Res = await makeRequest(server, '/api/nonexistent-endpoint-test');
    assert(api404Res.status === 404, `Expected 404 on invalid API route, got ${api404Res.status}`);
    assert(api404Res.body && api404Res.body.error === 'API endpoint not found.', 'API 404 must return structured JSON error');
    results.push({ name: 'SERVER-05: API routes are isolated and return structured 404 JSON', passed: true });

    // Test 7: Backend RBAC Protection on Admin Endpoints
    const unauthAdmin = await makeRequest(server, '/api/admin/orders');
    assert(unauthAdmin.status === 401, `Expected 401 for unauthenticated admin access, got ${unauthAdmin.status}`);

    const customerUser = db.users.find((u) => u.role === 'customer');
    assert(!!customerUser, 'Customer user must exist');
    const customerToken = createSession(customerUser!.id);

    const customerOnAdmin = await makeRequest(server, '/api/admin/orders', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(customerOnAdmin.status === 403, `Expected 403 Forbidden for customer on admin route, got ${customerOnAdmin.status}`);

    const adminUser = db.users.find((u) => u.role === 'admin');
    assert(!!adminUser, 'Admin user must exist');
    const adminToken = createSession(adminUser!.id);

    const adminOnAdmin = await makeRequest(server, '/api/admin/orders', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminOnAdmin.status === 200, `Expected 200 OK for admin on admin route, got ${adminOnAdmin.status}`);
    results.push({ name: 'RBAC-01: Admin API endpoints strictly reject unauthenticated and customer callers', passed: true });

    // Test 8: Backend RBAC Protection on Reseller Endpoints
    const unauthReseller = await makeRequest(server, '/api/reseller/wallet');
    assert(unauthReseller.status === 401, `Expected 401 for unauthenticated reseller access, got ${unauthReseller.status}`);

    const customerOnReseller = await makeRequest(server, '/api/reseller/wallet', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(customerOnReseller.status === 403, `Expected 403 Forbidden for customer on reseller route, got ${customerOnReseller.status}`);

    const resellerUser = db.users.find((u) => u.role === 'reseller');
    assert(!!resellerUser, 'Reseller user must exist');
    const resellerToken = createSession(resellerUser!.id);

    const resellerOnReseller = await makeRequest(server, '/api/reseller/wallet', {
      headers: { Authorization: `Bearer ${resellerToken}` },
    });
    assert(resellerOnReseller.status === 200, `Expected 200 OK for reseller on reseller route, got ${resellerOnReseller.status}`);
    results.push({ name: 'RBAC-02: Reseller API endpoints strictly reject unauthenticated and customer callers', passed: true });

  } finally {
    server.close();
  }

  // Print results
  console.log('\n--- TEST RESULTS ---');
  let passCount = 0;
  for (const r of results) {
    if (r.passed) {
      console.log(`[PASS] ${r.name}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${r.name} -> ${r.error}`);
    }
  }

  console.log(`\nTOTAL: ${passCount}/${results.length} PASSED.`);
  if (passCount !== results.length) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
