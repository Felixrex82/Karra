import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  getGeminiApiKey,
  isGeminiConfigured,
  getAdminPassword,
  isAdminPasswordConfigured,
  getEnvDiagnostics,
} from '../server/config/env';
import { getGeminiClient } from '../server/geminiClient';
import { createAdminSession, isValidAdminSession, dispatchApiRequest } from '../server/apiDispatcher';
import { FOUNDER_EMAIL } from '../server/betaStore';

console.log('🔒 Starting Security, Environment Contract & Authentication Test Suite...\n');

// Mock response helper for dispatchApiRequest
function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    setHeader: (k: string, v: string) => {
      res.headers[k.toLowerCase()] = v;
    },
    status: (code: number) => {
      res.statusCode = code;
      return res;
    },
    json: (data: any) => {
      res.body = data;
      return res;
    },
    end: (str?: string) => {
      if (str && !res.body) {
        try {
          res.body = JSON.parse(str);
        } catch {
          res.body = str;
        }
      }
      return res;
    },
  };
  return res;
}

async function runTestSuite() {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalAdminPassword = process.env.ADMIN_PASSWORD;

  try {
    // =========================================================================
    // SECTION 1: GEMINI API CONFIGURATION & INITIALIZATION
    // =========================================================================

    // 1. GEMINI_API_KEY present -> Gemini client can initialize
    console.log('▶ GEMINI TEST 1: GEMINI_API_KEY present -> Gemini client can initialize');
    process.env.GEMINI_API_KEY = 'test_ai_key_alpha_beta_12345';
    assert.strictEqual(isGeminiConfigured(), true, 'isGeminiConfigured should be true');
    assert.strictEqual(getGeminiApiKey(), 'test_ai_key_alpha_beta_12345');
    const client = getGeminiClient();
    assert.notStrictEqual(client, null, 'getGeminiClient should return initialized client');
    console.log('✅ GEMINI TEST 1 PASSED: Gemini client initialized successfully with valid GEMINI_API_KEY.');

    // 2. GEMINI_API_KEY missing -> configuration is detected (null client)
    console.log('\n▶ GEMINI TEST 2: GEMINI_API_KEY missing -> configuration missing detected');
    delete process.env.GEMINI_API_KEY;
    assert.strictEqual(isGeminiConfigured(), false, 'isGeminiConfigured should be false');
    assert.strictEqual(getGeminiApiKey(), null, 'getGeminiApiKey should be null');
    const nullClient = getGeminiClient();
    assert.strictEqual(nullClient, null, 'getGeminiClient must return null when key missing');

    // Also verify endpoint returns 503 GEMINI_NOT_CONFIGURED rather than silent fallback
    const mockReqMissing = {
      method: 'POST',
      url: '/api/gemini/ask',
      body: { question: 'How much did I sell?' },
    };
    const mockResMissing = createMockRes();
    await dispatchApiRequest(mockReqMissing, mockResMissing);
    assert.strictEqual(mockResMissing.statusCode, 503, 'Must return 503 when GEMINI_API_KEY is not configured');
    assert.strictEqual(mockResMissing.body?.code, 'GEMINI_NOT_CONFIGURED');
    assert.strictEqual(mockResMissing.body?.answer, 'I’m temporarily unable to process that request. Please try again.');
    console.log('✅ GEMINI TEST 2 PASSED: Missing GEMINI_API_KEY safely detected and returns 503 without fallback.');

    // 3. Gemini key is never exposed to frontend code
    console.log('\n▶ GEMINI TEST 3: Gemini key is never exposed to frontend code or client bundles');
    const srcDir = path.resolve(process.cwd(), 'src');
    const scanDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.html')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert.strictEqual(
            content.includes('VITE_GEMINI_API_KEY'),
            false,
            `Forbidden VITE_GEMINI_API_KEY found in frontend file: ${fullPath}`
          );
        }
      }
    };
    scanDir(srcDir);
    console.log('✅ GEMINI TEST 3 PASSED: Verified no frontend file references VITE_GEMINI_API_KEY.');

    // 4. Gemini request failure does not generate a fabricated business answer
    console.log('\n▶ GEMINI TEST 4: Gemini failure returns truthful failure message, never a fabricated answer');
    delete process.env.GEMINI_API_KEY;
    const mockReqInterpret = {
      method: 'POST',
      url: '/api/gemini/interpret',
      body: { userInput: 'Sold 5 bags of rice' },
    };
    const mockResInterpret = createMockRes();
    await dispatchApiRequest(mockReqInterpret, mockResInterpret);
    assert.strictEqual(mockResInterpret.statusCode, 503, 'Must return 503 for interpret when unconfigured');
    assert.strictEqual(mockResInterpret.body?.message, 'I’m temporarily unable to process that request. Please try again.');
    console.log('✅ GEMINI TEST 4 PASSED: Truthful failure returned; zero hallucinated data generated.');

    // 5. Safe diagnostics & health check do not leak API key
    console.log('\n▶ GEMINI TEST 5: Diagnostics & Health check do not leak secrets or partial keys');
    process.env.GEMINI_API_KEY = 'AIzaSySecretTestingKey998877';
    process.env.ADMIN_PASSWORD = 'TestPassword123';
    const diag = getEnvDiagnostics();
    assert.strictEqual(diag.geminiConfigured, true);
    assert.strictEqual(diag.adminPasswordConfigured, true);
    assert.strictEqual((diag as any).apiKey, undefined);
    assert.strictEqual((diag as any).password, undefined);
    assert.strictEqual((diag as any).keyPreview, undefined);

    const mockHealthReq = { method: 'GET', url: '/api/health' };
    const mockHealthRes = createMockRes();
    await dispatchApiRequest(mockHealthReq, mockHealthRes);
    assert.strictEqual(mockHealthRes.statusCode, 200);
    assert.strictEqual(mockHealthRes.body?.geminiConfigured, true);
    assert.strictEqual(mockHealthRes.body?.keyPreview, undefined, 'Must NEVER return keyPreview');
    assert.strictEqual(JSON.stringify(mockHealthRes.body).includes('AIzaSySecretTestingKey998877'), false);
    console.log('✅ GEMINI TEST 5 PASSED: Safe boolean diagnostics verified; zero secret leakage.');

    // =========================================================================
    // SECTION 2: ADMIN AUTHENTICATION
    // =========================================================================

    // 6. ADMIN_PASSWORD present -> correct password logs in
    console.log('\n▶ ADMIN TEST 6: ADMIN_PASSWORD present -> correct password logs in');
    const VALID_ADMIN_PASS = 'SecureEnterprisePassword#2026!';
    process.env.ADMIN_PASSWORD = VALID_ADMIN_PASS;
    assert.strictEqual(isAdminPasswordConfigured(), true);
    assert.strictEqual(getAdminPassword(), VALID_ADMIN_PASS);

    const mockReqLoginSuccess = {
      method: 'POST',
      url: '/api/admin/login',
      body: {
        email: FOUNDER_EMAIL,
        password: VALID_ADMIN_PASS,
      },
    };
    const mockResLoginSuccess = createMockRes();
    await dispatchApiRequest(mockReqLoginSuccess, mockResLoginSuccess);
    assert.strictEqual(mockResLoginSuccess.statusCode, 200);
    assert.strictEqual(mockResLoginSuccess.body?.success, true);
    assert.ok(mockResLoginSuccess.body?.token, 'Must return session token');
    const validSessionToken = mockResLoginSuccess.body.token;
    console.log('✅ ADMIN TEST 6 PASSED: Correct password logged in successfully and received token.');

    // 7. ADMIN_PASSWORD present -> wrong password rejected
    console.log('\n▶ ADMIN TEST 7: ADMIN_PASSWORD present -> wrong password rejected');
    const mockReqLoginWrong = {
      method: 'POST',
      url: '/api/admin/login',
      body: {
        email: FOUNDER_EMAIL,
        password: 'incorrect_password_attempt',
      },
    };
    const mockResLoginWrong = createMockRes();
    await dispatchApiRequest(mockReqLoginWrong, mockResLoginWrong);
    assert.strictEqual(mockResLoginWrong.statusCode, 401);
    assert.strictEqual(mockResLoginWrong.body?.success, false);
    assert.strictEqual(mockResLoginWrong.body?.token, undefined);
    console.log('✅ ADMIN TEST 7 PASSED: Wrong password rejected with 401.');

    // 8. ADMIN_PASSWORD missing -> login fails safely with 503 configuration error
    console.log('\n▶ ADMIN TEST 8: ADMIN_PASSWORD missing -> fails safely with 503, NEVER fallback');
    delete process.env.ADMIN_PASSWORD;
    assert.strictEqual(isAdminPasswordConfigured(), false);
    assert.strictEqual(getAdminPassword(), null);

    const mockReqLoginNoConfig = {
      method: 'POST',
      url: '/api/admin/login',
      body: {
        email: FOUNDER_EMAIL,
        password: VALID_ADMIN_PASS,
      },
    };
    const mockResLoginNoConfig = createMockRes();
    await dispatchApiRequest(mockReqLoginNoConfig, mockResLoginNoConfig);
    assert.strictEqual(mockResLoginNoConfig.statusCode, 503, 'Must return 503 when ADMIN_PASSWORD missing');
    assert.strictEqual(mockResLoginNoConfig.body?.code, 'ADMIN_PASSWORD_NOT_CONFIGURED');
    console.log('✅ ADMIN TEST 8 PASSED: Login safely rejected with 503 when ADMIN_PASSWORD is missing.');

    // 9. Admin session token validation succeeds for valid session
    console.log('\n▶ ADMIN TEST 9: Admin session token validation succeeds for valid session');
    assert.strictEqual(isValidAdminSession(validSessionToken, FOUNDER_EMAIL), true);
    console.log('✅ ADMIN TEST 9 PASSED: Valid session token accepted.');

    // 10. Admin session token validation fails for invalid session
    console.log('\n▶ ADMIN TEST 10: Admin session token validation fails for invalid session');
    assert.strictEqual(isValidAdminSession('invalid_fake_token', FOUNDER_EMAIL), false);
    assert.strictEqual(isValidAdminSession('karra_tok_fake_payload.fake_sig', FOUNDER_EMAIL), false);
    console.log('✅ ADMIN TEST 10 PASSED: Fake and tampered session tokens rejected.');

    // 11. No fallback password allows admin access
    console.log('\n▶ ADMIN TEST 11: No fallback password allows admin access');
    process.env.ADMIN_PASSWORD = 'LegitimateNewSecret2026';
    const forbiddenFallbacks = [
      '@Felixrex1',
      '@felixrex1',
      'founder_active_admin',
      'founder',
      'admin',
      'password',
    ];
    for (const fallback of forbiddenFallbacks) {
      assert.strictEqual(
        isValidAdminSession(fallback, FOUNDER_EMAIL),
        false,
        `Forbidden fallback token "${fallback}" must not be accepted by isValidAdminSession!`
      );

      const resFb = createMockRes();
      await dispatchApiRequest(
        {
          method: 'POST',
          url: '/api/admin/login',
          body: { email: FOUNDER_EMAIL, password: fallback },
        },
        resFb
      );
      assert.strictEqual(
        resFb.statusCode,
        401,
        `Forbidden fallback password "${fallback}" must be rejected with 401!`
      );
    }
    console.log('✅ ADMIN TEST 11 PASSED: All forbidden legacy fallback passwords firmly rejected.');

    console.log('\n🎉 ALL 11 SECURITY, ENVIRONMENT & AUTHENTICATION TESTS PASSED!\n');
  } finally {
    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    if (originalAdminPassword !== undefined) {
      process.env.ADMIN_PASSWORD = originalAdminPassword;
    } else {
      delete process.env.ADMIN_PASSWORD;
    }
  }
}

runTestSuite().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
