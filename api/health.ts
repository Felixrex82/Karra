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

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const apiKey = getCleanApiKey();
  const configured = Boolean(apiKey);

  const payload = {
    status: 'ok',
    geminiConfigured: configured,
    apiKeyConfigured: configured,
    keyPreview: configured && apiKey ? `${apiKey.substring(0, 6)}...` : null,
    timestamp: new Date().toISOString(),
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = 200;
  return res.end(JSON.stringify(payload));
}
