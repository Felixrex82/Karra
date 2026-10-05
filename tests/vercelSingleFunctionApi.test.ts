process.env.IS_TEST = 'true';
process.env.VERCEL = '1';

import handler from '../api/index';
import { app, createAdminSession } from '../server';
import { FOUNDER_EMAIL } from '../server/betaStore';
import http from 'http';

function makeMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, any>;
}): Promise<{ status: number; body: any; headers: Record<string, any> }> {
  return new Promise((resolve) => {
    const method = options.method || 'GET';
    const rawUrl = options.url || '/api/health';
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(options.headers || {}),
    };

    let bodyStr = '';
    if (options.body) {
      bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      headers['content-length'] = Buffer.byteLength(bodyStr).toString();
    }

    // Create an in-memory HTTP server attached to the handler for true network-level fidelity
    const server = http.createServer((req, res) => {
      if (options.query) {
        (req as any).query = options.query;
      }
      handler(req as any, res as any);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: rawUrl,
          method,
          headers,
        },
        (res) => {
          let chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const resText = Buffer.concat(chunks).toString('utf8');
            let parsedBody: any = resText;
            try {
              parsedBody = JSON.parse(resText);
            } catch {
              // keep as raw text
            }
            server.close();
            resolve({
              status: res.statusCode || 200,
              body: parsedBody,
              headers: res.headers,
            });
          });
        }
      );

      if (bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    });
  });
}

async function runTests() {
  console.log('🧪 Starting Vercel Serverless Function & AI Route Verification Tests...');

  // 1. Health check via direct path
  console.log('\n▶ TEST 1: Direct /api/health endpoint execution');
  const res1 = await makeMockRequest({ method: 'GET', url: '/api/health' });
  if (res1.status !== 200 || res1.body?.status !== 'ok') {
    throw new Error(`TEST 1 FAILED: Expected status 200 and body.status 'ok', got ${res1.status}`);
  }
  console.log('✅ TEST 1 PASSED: /api/health responded 200 OK with status: "ok"');

  // 2. Vercel Rewrite with ?__path=beta/status&userId=tester_1
  console.log('\n▶ TEST 2: Vercel rewrite /api?__path=beta/status with query string');
  const res2 = await makeMockRequest({
    method: 'GET',
    url: '/api?__path=beta/status&userId=tester_1&userEmail=tester1@gmail.com',
  });
  if (res2.status !== 200 || typeof res2.body?.isBetaAuthorized !== 'boolean') {
    throw new Error(`TEST 2 FAILED: Expected status 200 with isBetaAuthorized field, got ${res2.status}: ${JSON.stringify(res2.body)}`);
  }
  console.log('✅ TEST 2 PASSED: Rewritten /api?__path=beta/status cleanly routed to GET /api/beta/status');

  // 3. Vercel Rewrite with ?__path=beta/validate-code (POST with JSON body)
  console.log('\n▶ TEST 3: Vercel rewrite /api?__path=beta/validate-code POST body');
  const res3 = await makeMockRequest({
    method: 'POST',
    url: '/api?__path=beta/validate-code',
    body: { code: 'INVALID_CODE_123' },
  });
  if (res3.status !== 200 || res3.body?.valid !== false) {
    throw new Error(`TEST 3 FAILED: Expected valid: false for dummy code, got: ${JSON.stringify(res3.body)}`);
  }
  console.log('✅ TEST 3 PASSED: POST /api?__path=beta/validate-code accurately validated code body');

  // 4. Header-based routing: x-now-route-matches
  console.log('\n▶ TEST 4: Vercel header routing via x-now-route-matches');
  const res4 = await makeMockRequest({
    method: 'GET',
    url: '/api',
    headers: {
      'x-now-route-matches': '1=health',
    },
  });
  if (res4.status !== 200 || res4.body?.status !== 'ok') {
    throw new Error(`TEST 4 FAILED: Expected 200 from x-now-route-matches, got: ${res4.status}`);
  }
  console.log('✅ TEST 4 PASSED: x-now-route-matches header properly routed to /api/health');

  // 5a. Admin login when ADMIN_PASSWORD is not set fails safely with 503 (NEVER fallback to hardcoded password)
  console.log('\n▶ TEST 5a: Admin login when ADMIN_PASSWORD missing fails safely with 503');
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SECRET;
  const resMissingPass = await makeMockRequest({
    method: 'POST',
    url: '/api?__path=admin/login',
    body: {
      email: FOUNDER_EMAIL,
      password: 'some_password',
    },
  });
  if (resMissingPass.status !== 503) {
    throw new Error(`TEST 5a FAILED: Expected 503 when ADMIN_PASSWORD missing, got ${resMissingPass.status}`);
  }
  console.log('✅ TEST 5a PASSED: Admin login safely rejected with 503 when ADMIN_PASSWORD not configured.');

  // 5b. Admin login with configured ADMIN_PASSWORD succeeds
  console.log('\n▶ TEST 5b: Admin login with configured ADMIN_PASSWORD succeeds');
  const TEST_PASSWORD = 'ProductionSafeAdminSecret2026!';
  process.env.ADMIN_PASSWORD = TEST_PASSWORD;
  const resLogin = await makeMockRequest({
    method: 'POST',
    url: '/api?__path=admin/login',
    body: {
      email: FOUNDER_EMAIL,
      password: TEST_PASSWORD,
    },
  });
  if (resLogin.status !== 200 || !resLogin.body?.token) {
    throw new Error(`TEST 5b FAILED: Expected 200 and token, got ${resLogin.status}: ${JSON.stringify(resLogin.body)}`);
  }
  console.log('✅ TEST 5b PASSED: Admin login succeeded with configured ADMIN_PASSWORD; token received.');

  // 6. Admin login with wrong password returns 401, NOT 500
  console.log('\n▶ TEST 6: Admin login with invalid password returns 401 (never 500)');
  const resWrong = await makeMockRequest({
    method: 'POST',
    url: '/api?__path=admin/login',
    body: {
      email: FOUNDER_EMAIL,
      password: 'wrong_password_test',
    },
  });
  if (resWrong.status !== 401) {
    throw new Error(`TEST 6 FAILED: Expected 401, got ${resWrong.status}: ${JSON.stringify(resWrong.body)}`);
  }
  console.log('✅ TEST 6 PASSED: Invalid password returned 401 Unauthorized.');

  // 7. Admin session creation & authorized /api/admin/invitations access
  console.log('\n▶ TEST 7: Authorized /api/admin/invitations access using generated session token');
  const adminToken = resLogin.body.token;
  const res7 = await makeMockRequest({
    method: 'GET',
    url: '/api?__path=admin/invitations',
    headers: {
      'authorization': `Bearer ${adminToken}`,
      'x-admin-email': FOUNDER_EMAIL,
    },
  });
  if (res7.status !== 200 || !Array.isArray(res7.body?.invitations)) {
    throw new Error(`TEST 7 FAILED: Expected status 200 and invitations array, got ${res7.status}: ${JSON.stringify(res7.body)}`);
  }
  console.log(`✅ TEST 7 PASSED: Admin invitations retrieved successfully (${res7.body.invitations.length} invitations listed)`);

  // 7b. Tampered/invalid token returns 401 Unauthorized
  console.log('\n▶ TEST 7b: Tampered admin token access rejected with 401');
  const res7b = await makeMockRequest({
    method: 'GET',
    url: '/api?__path=admin/invitations',
    headers: {
      'authorization': 'Bearer invalid_tampered_token_xyz',
      'x-admin-email': FOUNDER_EMAIL,
    },
  });
  if (res7b.status !== 401) {
    throw new Error(`TEST 7b FAILED: Expected status 401 for tampered token, got ${res7b.status}`);
  }
  console.log('✅ TEST 7b PASSED: Tampered admin token rejected with 401 Unauthorized.');

  // 8. Direct POST /api/gemini/interpret route execution with full body
  console.log('\n▶ TEST 8: Direct /api/gemini/interpret endpoint execution');
  const res8 = await makeMockRequest({
    method: 'POST',
    url: '/api/gemini/interpret',
    body: {
      userInput: 'Hello, what can you do?',
      memoryContext: { products: [], customers: [], unitRules: [] },
      recentEventsContext: [],
    },
  });
  if (res8.status !== 200) {
    throw new Error(`TEST 8 FAILED: Expected status 200, got ${res8.status}: ${JSON.stringify(res8.body)}`);
  }
  console.log('✅ TEST 8 PASSED: /api/gemini/interpret handled successfully (status 200)');

  // 9. Vercel Catch-All array query routing: query.path = ['gemini', 'ask']
  console.log('\n▶ TEST 9: Vercel catch-all route with array query { path: ["gemini", "ask"] }');
  const res9 = await makeMockRequest({
    method: 'POST',
    url: '/api/gemini/ask',
    query: { path: ['gemini', 'ask'] },
    body: {
      question: 'How much did I make today?',
      chatHistory: [],
      businessSummary: { todaySales: 50000, todayGrossProfit: 20000, todayExpenses: 5000 },
      products: [],
      customers: [],
      suppliers: [],
      rules: [],
      unitRelationships: [],
      recentEvents: [],
    },
  });
  if (res9.status !== 200) {
    throw new Error(`TEST 9 FAILED: Array-based path routing crashed with ${res9.status}: ${JSON.stringify(res9.body)}`);
  }
  console.log('✅ TEST 9 PASSED: Catch-all array query routed without TypeError crash');

  // 10. SPA Rewrite Regex Validation: Ensures /api and /api/* are NEVER intercepted by index.html rewrite
  console.log('\n▶ TEST 10: SPA rewrite regex isolation');
  const spaRegex = /^\/((?!api(?:$|\/)).*)$/;
  if (spaRegex.test('/api')) {
    throw new Error('TEST 10 FAILED: /api matched SPA rewrite regex and would return index.html!');
  }
  if (spaRegex.test('/api/')) {
    throw new Error('TEST 10 FAILED: /api/ matched SPA rewrite regex!');
  }
  if (spaRegex.test('/api/gemini/interpret')) {
    throw new Error('TEST 10 FAILED: /api/gemini/interpret matched SPA rewrite regex!');
  }
  if (spaRegex.test('/api/gemini/ask')) {
    throw new Error('TEST 10 FAILED: /api/gemini/ask matched SPA rewrite regex!');
  }
  if (!spaRegex.test('/dashboard')) {
    throw new Error('TEST 10 FAILED: /dashboard failed to match SPA rewrite regex!');
  }
  if (!spaRegex.test('/')) {
    throw new Error('TEST 10 FAILED: root / failed to match SPA rewrite regex!');
  }
  console.log('✅ TEST 10 PASSED: SPA regex cleanly isolates /api from client-side rewrite');

  console.log('\n🎉 ALL 10 VERCEL REWRITE & AI ROUTE TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
