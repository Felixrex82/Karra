import { GoogleGenAI } from '@google/genai';
import {
  generateContentWithRetryAndFallback,
  buildInterpretPrompt,
} from '../_geminiEngine';

function getCleanApiKey(): string | null {
  const candidateKeys = [
    process.env.GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GEMINI_KEY,
    process.env.API_KEY,
  ];

  for (const raw of candidateKeys) {
    if (typeof raw === 'string') {
      const clean = raw.trim().replace(/^["']|["']$/g, '').trim();
      if (clean && clean.length > 5 && !clean.includes('MY_GEMINI_API_KEY')) {
        return clean;
      }
    }
  }
  return null;
}

let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = getCleanApiKey();
  if (!apiKey) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });
  }
  return genAIClient;
}

function sendJson(res: any, statusCode: number, data: any) {
  if (typeof res.status === 'function') {
    res.status(statusCode);
    if (typeof res.json === 'function') {
      return res.json(data);
    }
  } else {
    res.statusCode = statusCode;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(data));
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (body === undefined || body === null) {
      if (typeof req.on === 'function' && req.readable) {
        body = await new Promise((resolve) => {
          let chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            try {
              resolve(JSON.parse(raw));
            } catch {
              resolve(raw);
            }
          });
          req.on('error', () => resolve({}));
        });
      }
    } else if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // Keep string
      }
    }

    const { userInput, memoryContext, recentEventsContext, conversationState } = body || {};
    if (!userInput || typeof userInput !== 'string') {
      return sendJson(res, 400, { error: 'userInput is required' });
    }

    const ai = getGenAI();
    if (!ai) {
      return sendJson(res, 200, {
        success: false,
        fallback: true,
        reason: 'GEMINI_API_KEY is not configured on Vercel; using deterministic calculation engine',
      });
    }

    const prompt = buildInterpretPrompt(
      userInput,
      memoryContext,
      recentEventsContext,
      conversationState
    );

    const response = await generateContentWithRetryAndFallback(ai, {
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.1 },
    });

    const parsed = JSON.parse(response.text || '{}');
    return sendJson(res, 200, { success: true, data: parsed });
  } catch (err: any) {
    console.error('[Gemini Interpret Error]:', err?.message || err);
    return sendJson(res, 200, {
      success: false,
      fallback: true,
      reason: err?.message || 'AI service experiencing temporary demand spike; fallback to deterministic rules',
    });
  }
}
