import { GoogleGenAI } from '@google/genai';
import {
  generateContentWithRetryAndFallback,
  buildAskSystemPrompt,
} from '../_geminiEngine';

function getCleanApiKey(req?: any): string | null {
  const headerKey = req?.headers?.['x-gemini-api-key'] || req?.headers?.['x-api-key'];
  const bodyKey = req?.body && typeof req.body === 'object' ? req.body.apiKey : null;

  const candidateKeys = [
    headerKey,
    bodyKey,
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

function getGenAI(req?: any): GoogleGenAI | null {
  const apiKey = getCleanApiKey(req);
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
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

    const {
      question,
      chatHistory,
      businessSummary,
      products,
      customers,
      suppliers,
      rules,
      unitRelationships,
      recentEvents,
    } = body || {};

    if (!question) {
      return sendJson(res, 400, { error: 'question is required' });
    }

    const ai = getGenAI(req);
    if (!ai) {
      return sendJson(res, 200, {
        success: false,
        fallback: true,
        reason: 'GEMINI_API_KEY is not configured on Vercel; using deterministic answer generator',
      });
    }

    const recentChatText = (Array.isArray(chatHistory) ? chatHistory.slice(-8) : [])
      .map((m: any) => `${m.sender === 'user' ? 'Owner' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const systemPrompt = buildAskSystemPrompt({
      businessSummary,
      products,
      customers,
      suppliers,
      rules,
      unitRelationships,
      recentEvents,
      recentChatText,
    });

    const response = await generateContentWithRetryAndFallback(ai, {
      contents: [{ text: systemPrompt }, { text: `Owner's message: "${question}"` }],
      config: { responseMimeType: 'application/json', temperature: 0.1 },
    });

    let answerText = '';
    let extractedMemories: any[] = [];
    let recordedEvent: any = null;
    let correctedEvent: any = null;
    let deletedEventId: string | null = null;
    let targetDescription: string | null = null;
    let structuredAction: any = null;
    let calendarDate: string | null = null;
    let calendarAction: string | null = null;

    try {
      const parsed = JSON.parse(response.text || '{}');
      answerText = parsed.answer || response.text || 'I have noted that down for your business.';
      extractedMemories = Array.isArray(parsed.memories) ? parsed.memories : [];
      recordedEvent = parsed.recordedEvent || null;
      correctedEvent = parsed.correctedEvent || null;
      deletedEventId = parsed.deletedEventId || null;
      targetDescription = parsed.targetDescription || null;
      structuredAction = parsed.structuredAction || null;
      calendarDate = parsed.calendarDate || null;
      calendarAction = parsed.calendarAction || null;
    } catch {
      answerText = response.text || 'I have noted that down for your business.';
    }

    return sendJson(res, 200, {
      success: true,
      answer: answerText,
      data: {
        answer: answerText,
        memories: extractedMemories,
        recordedEvent,
        correctedEvent,
        deletedEventId,
        targetDescription,
        structuredAction,
        calendarDate,
        calendarAction,
      },
      memories: extractedMemories,
      recordedEvent,
      correctedEvent,
      deletedEventId,
      targetDescription,
      structuredAction,
      calendarDate,
      calendarAction,
    });
  } catch (err: any) {
    console.error('[Gemini Ask Error]:', err?.message || err);
    return sendJson(res, 200, {
      success: false,
      fallback: true,
      reason: err?.message || 'AI service experiencing temporary demand spike; using deterministic calculation',
    });
  }
}
