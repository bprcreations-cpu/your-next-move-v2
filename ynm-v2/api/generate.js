// api/generate.js — Vercel Serverless Function (Node.js runtime)
// Runs server-side only. API key never exposed to browser.
// maxDuration: 60 set in vercel.json

export default async function handler(req, res) {
  // CORS headers for safety
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API key exists
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[generate] ANTHROPIC_API_KEY not set in environment');
    return res.status(500).json({ 
      error: 'API key not configured',
      code: 'MISSING_API_KEY'
    });
  }

  // Parse body — Vercel should auto-parse JSON but handle edge cases
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {
      return res.status(400).json({ error: 'Invalid JSON in request body', code: 'INVALID_JSON' });
    }
  }

  const { prompt } = body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt field', code: 'MISSING_PROMPT' });
  }
  if (prompt.length > 30000) {
    return res.status(400).json({ error: 'Prompt exceeds maximum length', code: 'PROMPT_TOO_LONG' });
  }
  if (prompt.trim().length < 50) {
    return res.status(400).json({ error: 'Prompt too short', code: 'PROMPT_TOO_SHORT' });
  }

  console.log('[generate] Request received. Prompt length:', prompt.length);

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
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const elapsed = Date.now() - startTime;
    console.log('[generate] Anthropic response status:', response.status, 'elapsed:', elapsed+'ms');

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error('[generate] Anthropic API error:', response.status, errBody);
      return res.status(response.status).json({ 
        error: `Anthropic API returned ${response.status}`,
        code: 'ANTHROPIC_ERROR',
        status: response.status
      });
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.content || !Array.isArray(data.content)) {
      console.error('[generate] Unexpected response structure:', JSON.stringify(data).substring(0, 200));
      return res.status(500).json({ 
        error: 'Unexpected response structure from API',
        code: 'INVALID_RESPONSE'
      });
    }

    const text = data.content.map(b => b.text || '').join('');
    
    if (!text || text.trim().length === 0) {
      console.error('[generate] Empty text in response. Stop reason:', data.stop_reason);
      return res.status(500).json({ 
        error: 'Empty response from API. Stop reason: ' + (data.stop_reason || 'unknown'),
        code: 'EMPTY_RESPONSE'
      });
    }

    console.log('[generate] Success. Response length:', text.length, 'stop_reason:', data.stop_reason);
    return res.status(200).json({ text });

  } catch (e) {
    console.error('[generate] Unhandled error:', e.message, e.stack);
    return res.status(500).json({ 
      error: e.message || 'Generation failed',
      code: 'INTERNAL_ERROR'
    });
  }
}
