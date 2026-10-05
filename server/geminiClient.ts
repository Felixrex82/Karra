import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from './config/env';

let cachedClient: GoogleGenAI | null = null;
let lastUsedKey: string | null = null;

/**
 * Returns the lazily-initialized GoogleGenAI client initialized
 * exclusively with the canonical server-side GEMINI_API_KEY.
 * Returns null if GEMINI_API_KEY is not configured.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const currentKey = getGeminiApiKey();
  if (!currentKey) {
    cachedClient = null;
    lastUsedKey = null;
    return null;
  }

  if (!cachedClient || lastUsedKey !== currentKey) {
    cachedClient = new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    lastUsedKey = currentKey;
  }

  return cachedClient;
}
