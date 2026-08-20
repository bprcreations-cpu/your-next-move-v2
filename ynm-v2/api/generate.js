// api/generate.js — Vercel Serverless Function (Node.js runtime)
// This is the endpoint App.jsx calls for Strategy generation, Ask Your
// Advisor, and Industry Hub search — all three POST { prompt } here.

const MAX_PROMPT_LENGTH = 30000;
const MAX_OUTPUT_TOKENS = 4096;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON', code: 'INVALID_JSON' });
    }
  }
  body = body || {};

  const { prompt } = body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt', code: 'MISSING_PROMPT' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: 'Prompt exceeds maximum length', code: 'PROMPT_TOO_LONG' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[generate] ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'API key not configured', code: 'MISSING_API_KEY' });
  }

  try {
    const startTime = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5', // corrected — the old string ('claude-sonnet-4-6') is not a valid model
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const elapsed = Date.now() - startTime;
    console.log('[generate] status:', response.status, 'elapsed_ms:', elapsed);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error('[generate] Anthropic error:', response.status, errBody.slice(0, 300));
      return res.status(response.status).json({
        error: `Anthropic API returned ${response.status}`,
        code: 'ANTHROPIC_ERROR',
        status: response.status,
      });
    }

    const data = await response.json();
    if (!data.content || !Array.isArray(data.content)) {
      return res.status(500).json({ error: 'Unexpected response structure', code: 'INVALID_RESPONSE' });
    }

    const text = data.content.map(b => b.text || '').join('');
    if (!text.trim()) {
      return res.status(500).json({
        error: 'Empty response. Stop reason: ' + (data.stop_reason || 'unknown'),
        code: 'EMPTY_RESPONSE',
      });
    }

    return res.status(200).json({
      text,
      elapsedMs: elapsed,
      model: 'claude-sonnet-5',
      usage: data.usage || null,
    });
  } catch (e) {
    console.error('[generate] Unhandled error:', e.message);
    return res.status(500).json({ error: e.message || 'Generation failed', code: 'INTERNAL_ERROR' });
  }
}
