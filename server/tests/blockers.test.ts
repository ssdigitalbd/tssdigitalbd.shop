/**
 * SSDigitalBD.shop Production Blocker Verification Test Suite
 * Tests authentication hardening, backdoor elimination, credential redaction,
 * wallet balance non-overwriting, and health-check endpoints without mutating production data.
 */

import { db } from '../db/store.ts';
import { getOptionalUser } from '../api/routes.ts';
import app from '../../server.ts';
import http from 'http';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// Helper to make local HTTP requests to Express app
function makeRequest(
  server: http.Server,
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: any } = {}
): Promise<{ status: number; body: any }> {
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
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runBlockerTests() {
  console.log('--- RUNNING PRODUCTION BLOCKER TEST SUITE ---\n');

  // Start test HTTP server on random free port
  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => testServer.listen(0, '127.0.0.1', resolve));

  try {
    // -------------------------------------------------------------
    // 1. Health check endpoints
    // -------------------------------------------------------------
    try {
      const res1 = await makeRequest(testServer, '/health');
      assert(res1.status === 200, `/health returned ${res1.status}`);
      assert(res1.body.status === 'ok', `Expected status ok, got ${res1.body.status}`);

      const res2 = await makeRequest(testServer, '/api/health');
      assert(res2.status === 200, `/api/health returned ${res2.status}`);
      assert(res2.body.status === 'ok', `Expected status ok, got ${res2.body.status}`);

      results.push({ id: 'HEALTH-01', name: 'Production /health and /api/health endpoints active', passed: true });
    } catch (err: any) {
      results.push({ id: 'HEALTH-01', name: 'Production /health and /api/health endpoints active', passed: false, message: err.message });
    }

    // -------------------------------------------------------------
    // 2. Authentication Backdoor Elimination
    // -------------------------------------------------------------
    try {
      // Direct raw user ID token must return 401
      const resRaw = await makeRequest(testServer, '/api/admin/metrics', {
        headers: { Authorization: 'Bearer usr_admin_01' },
      });
      assert(resRaw.status === 401, `Expected 401 for Bearer usr_admin_01, got ${resRaw.status}`);

      // token_usr_admin_01 must return 401
      const resPrefixed = await makeRequest(testServer, '/api/admin/metrics', {
        headers: { Authorization: 'Bearer token_usr_admin_01' },
      });
      assert(resPrefixed.status === 401, `Expected 401 for Bearer token_usr_admin_01, got ${resPrefixed.status}`);

      // Unauthenticated request must return 401
      const resNoAuth = await makeRequest(testServer, '/api/admin/metrics');
      assert(resNoAuth.status === 401, `Expected 401 for unauthenticated request, got ${resNoAuth.status}`);

      results.push({ id: 'AUTH-01', name: 'Backdoor tokens (raw user ID & token_ prefix) strictly rejected with 401', passed: true });
    } catch (err: any) {
      results.push({ id: 'AUTH-01', name: 'Backdoor tokens (raw user ID & token_ prefix) strictly rejected with 401', passed: false, message: err.message });
    }

    // -------------------------------------------------------------
    // 3. Legitimate Admin Login & Session Validation
    // -------------------------------------------------------------
    let adminToken = '';
    try {
      const loginRes = await makeRequest(testServer, '/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@digimarket.com', password: 'admin123456' },
      });
      assert(loginRes.status === 200, `Login failed with ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
      assert(!!loginRes.body.token, 'Session token must be returned');
      assert(loginRes.body.user.role === 'admin', 'User role must be admin');
      assert(!loginRes.body.user.passwordHash, 'Password hash must NOT be exposed in login response');
      adminToken = loginRes.body.token;

      // Access protected admin metrics with genuine token
      const metricsRes = await makeRequest(testServer, '/api/admin/metrics', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(metricsRes.status === 200, `Admin metrics returned ${metricsRes.status}`);
      assert(metricsRes.body.totalOrders !== undefined, 'Metrics payload valid');

      results.push({ id: 'AUTH-02', name: 'Valid Super Admin login creates cryptographic session and authorizes admin endpoints', passed: true });
    } catch (err: any) {
      results.push({ id: 'AUTH-02', name: 'Valid Super Admin login creates cryptographic session and authorizes admin endpoints', passed: false, message: err.message });
    }

    // -------------------------------------------------------------
    // 4. Role Authorization & Cross-Role Isolation
    // -------------------------------------------------------------
    try {
      // Customer login
      const custLogin = await makeRequest(testServer, '/api/auth/login', {
        method: 'POST',
        body: { email: 'customer@gmail.com', password: 'customer123456' },
      });
      assert(custLogin.status === 200, 'Customer login succeeded');
      const custToken = custLogin.body.token;

      // Customer trying to access Admin metrics must return 403 Forbidden
      const forbidRes = await makeRequest(testServer, '/api/admin/metrics', {
        headers: { Authorization: `Bearer ${custToken}` },
      });
      assert(forbidRes.status === 403, `Expected 403 Forbidden for customer accessing admin API, got ${forbidRes.status}`);

      results.push({ id: 'AUTH-03', name: 'Customer access to Admin endpoints blocked with 403 Forbidden', passed: true });
    } catch (err: any) {
      results.push({ id: 'AUTH-03', name: 'Customer access to Admin endpoints blocked with 403 Forbidden', passed: false, message: err.message });
    }

    // -------------------------------------------------------------
    // 5. Order & Delivery Credential Protection
    // -------------------------------------------------------------
    try {
      const existingOrder = db.orders[0];
      if (existingOrder) {
        // Public/unauthenticated order lookup
        const pubOrderRes = await makeRequest(testServer, `/api/orders/${existingOrder.orderNumber}`);
        assert(pubOrderRes.status === 200, `Order lookup returned ${pubOrderRes.status}`);
        assert(!pubOrderRes.body.order.customerEmail, 'Customer email must be redacted on public lookup');
        assert(!pubOrderRes.body.order.customerPhone, 'Customer phone must be redacted on public lookup');
        assert(pubOrderRes.body.submissions.length === 0, 'Payment submissions must be empty on public lookup');
        if (pubOrderRes.body.delivery?.fulfillmentPayload) {
          assert(
            pubOrderRes.body.delivery.fulfillmentPayload.includes('[Protected credentials'),
            'Delivery credentials must be redacted on public lookup'
          );
        }
      }

      results.push({ id: 'CRED-01', name: 'Private customer data and fulfillment payload redacted on public order lookup', passed: true });
    } catch (err: any) {
      results.push({ id: 'CRED-01', name: 'Private customer data and fulfillment payload redacted on public order lookup', passed: false, message: err.message });
    }

    // -------------------------------------------------------------
    // 6. Wallet Balance Non-Overwrite Safeguard
    // -------------------------------------------------------------
    try {
      const resellerWallet = db.resellerWallets.find((w) => w.resellerId === 'usr_reseller_01');
      assert(!!resellerWallet, 'Reseller wallet exists');
      const currentStoredBalance = resellerWallet!.availableBalanceBdt;

      // Assert that stored balance is 5850 and was NOT silently overwritten to 11040
      assert(currentStoredBalance === 5850, `Expected preserved stored balance 5850, got ${currentStoredBalance}`);

      results.push({ id: 'WALLET-01', name: 'Wallet balance is preserved at ৳5,850.00 without silent reconciliation overwrite', passed: true });
    } catch (err: any) {
      results.push({ id: 'WALLET-01', name: 'Wallet balance is preserved at ৳5,850.00 without silent reconciliation overwrite', passed: false, message: err.message });
    }

    // -------------------------------------------------------------
    // 7. Logout & Session Invalidation
    // -------------------------------------------------------------
    try {
      if (adminToken) {
        const logoutRes = await makeRequest(testServer, '/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert(logoutRes.status === 200, 'Logout returned 200');

        // Subsequent call with revoked token must return 401
        const afterLogoutRes = await makeRequest(testServer, '/api/auth/me', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert(afterLogoutRes.status === 401, `Expected 401 after logout, got ${afterLogoutRes.status}`);
      }

      results.push({ id: 'AUTH-04', name: 'Session token invalidated on logout; revoked session rejected', passed: true });
    } catch (err: any) {
      results.push({ id: 'AUTH-04', name: 'Session token invalidated on logout; revoked session rejected', passed: false, message: err.message });
    }
  } finally {
    testServer.close();
  }

  // Summary
  console.log('--- TEST RESULTS ---');
  let passCount = 0;
  for (const r of results) {
    if (r.passed) {
      passCount++;
      console.log(`[PASS] ${r.id}: ${r.name}`);
    } else {
      console.error(`[FAIL] ${r.id}: ${r.name} - ${r.message}`);
    }
  }
  console.log(`\nTOTAL: ${passCount}/${results.length} PASSED.`);
}

runBlockerTests().catch(console.error);
