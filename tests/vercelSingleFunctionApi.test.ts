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
  query?: Record<string, string>;
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

    // Create an in-memory HTTP server attached to the app for true network-level fidelity
    const server = http.createServer((req, res) => {
      // Test handler function export from api/index.ts
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
  console.log('🧪 Starting Vercel Single Serverless Function Verification Tests...');

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

  // 5. Admin authentication and router access
  console.log('\n▶ TEST 5: Admin session creation & authorized /api/admin/invitations access');
  const adminToken = createAdminSession(FOUNDER_EMAIL);
  const res5 = await makeMockRequest({
    method: 'GET',
    url: '/api?__path=admin/invitations',
    headers: {
      'authorization': `Bearer ${adminToken}`,
      'x-admin-email': FOUNDER_EMAIL,
    },
  });
  if (res5.status !== 200 || !Array.isArray(res5.body?.invitations)) {
    throw new Error(`TEST 5 FAILED: Expected status 200 and invitations array, got ${res5.status}: ${JSON.stringify(res5.body)}`);
  }
  console.log(`✅ TEST 5 PASSED: Admin invitations retrieved successfully (${res5.body.invitations.length} invitations listed)`);

  // 6. Verification of single serverless function in api/
  console.log('\n▶ TEST 6: Exact single-function directory inspection in /api');
  const fs = await import('fs');
  const path = await import('path');
  const apiFiles = fs.readdirSync(path.resolve('api'));
  if (apiFiles.length !== 1 || apiFiles[0] !== 'index.ts') {
    throw new Error(`TEST 6 FAILED: Expected exactly ['index.ts'] in api/, got: ${JSON.stringify(apiFiles)}`);
  }
  console.log('✅ TEST 6 PASSED: Exactly 1 serverless function entrypoint (api/index.ts) discovered!');

  console.log('\n🎉 ALL 6 VERCEL SINGLE-FUNCTION REWRITE TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
