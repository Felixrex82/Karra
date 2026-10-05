import dotenv from 'dotenv';
import crypto from 'crypto';

// Ensure .env is loaded in development or when available
dotenv.config();

/**
 * Sanitizes an environment variable value by:
 * - Trimming whitespace, newlines, and carriage returns
 * - Stripping wrapping double or single quotes (common in Vercel UI copy-paste)
 */
function sanitizeEnv(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/^["']+|["']+$/g, '').trim();
}

/**
 * Validates and retrieves the canonical server-side GEMINI_API_KEY.
 * Strictly server-side: never exposed to browser or client bundles.
 */
export function getGeminiApiKey(): string | null {
  const rawKey = process.env.GEMINI_API_KEY;
  const key = sanitizeEnv(rawKey);

  // Reject empty string or placeholder values
  if (!key || key.length < 5 || key === 'MY_GEMINI_API_KEY' || key === 'YOUR_GEMINI_API_KEY') {
    return null;
  }

  return key;
}

/**
 * Checks if GEMINI_API_KEY is configured.
 */
export function isGeminiConfigured(): boolean {
  return getGeminiApiKey() !== null;
}

/**
 * Validates and retrieves the canonical server-side ADMIN_PASSWORD.
 * Strictly server-side: never exposed to browser or client bundles.
 * NO hard-coded fallback credentials.
 */
export function getAdminPassword(): string | null {
  const rawPass = process.env.ADMIN_PASSWORD;
  const pass = sanitizeEnv(rawPass);

  // Reject empty or placeholder values
  if (!pass || pass === 'YOUR_ADMIN_PASSWORD') {
    return null;
  }

  return pass;
}

/**
 * Checks if ADMIN_PASSWORD is configured.
 */
export function isAdminPasswordConfigured(): boolean {
  return getAdminPassword() !== null;
}

/**
 * Retrieves the secret used for HMAC signing admin session tokens.
 * Falls back to ADMIN_PASSWORD, or generates an ephemeral runtime salt.
 * Never exposes hard-coded credentials.
 */
let ephemeralRuntimeSecret: string | null = null;
export function getAdminSecret(): string {
  const explicitSecret = sanitizeEnv(process.env.ADMIN_SECRET);
  if (explicitSecret && explicitSecret !== 'YOUR_ADMIN_SECRET_TOKEN') {
    return explicitSecret;
  }

  const adminPass = getAdminPassword();
  if (adminPass) {
    return adminPass;
  }

  if (!ephemeralRuntimeSecret) {
    ephemeralRuntimeSecret = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralRuntimeSecret;
}

/**
 * Returns safe environment diagnostic status.
 * NEVER returns secrets, partial keys, lengths, or hashes.
 */
export function getEnvDiagnostics(): {
  geminiConfigured: boolean;
  adminPasswordConfigured: boolean;
  adminSecretConfigured: boolean;
  isProduction: boolean;
} {
  return {
    geminiConfigured: isGeminiConfigured(),
    adminPasswordConfigured: isAdminPasswordConfigured(),
    adminSecretConfigured: Boolean(sanitizeEnv(process.env.ADMIN_SECRET)),
    isProduction: process.env.NODE_ENV === 'production' && !process.env.IS_TEST,
  };
}

/**
 * Production environment integrity check.
 * Warns clearly in server logs without exposing secret values.
 */
export function validateProductionConfig(): void {
  const isProd = process.env.NODE_ENV === 'production' && !process.env.IS_TEST && !process.env.CI;
  if (!isProd) return;

  if (!isGeminiConfigured()) {
    console.error('[SECURITY/CONFIG CRITICAL] GEMINI_API_KEY is not configured in production environment.');
  }

  if (!isAdminPasswordConfigured()) {
    console.error('[SECURITY/CONFIG CRITICAL] ADMIN_PASSWORD is not configured in production environment.');
  }
}
