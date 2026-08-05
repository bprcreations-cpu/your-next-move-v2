// api/qa-generate.js — Vercel Serverless Function (Node.js runtime)
// Dedicated QA endpoint, separate from api/generate.js, so QA traffic can be
// rate-limited, disabled, and audited independently of real user traffic.
// Follows the exact conventions of the existing api/generate.js.
//
// AUTH MODEL: two-step.
//   1. POST { authCheck: true } + header x-qa-secret: <passphrase>
//      -> verifies against process.env.QA_ACCESS_SECRET, issues a short-lived
//         signed session token. Does NOT call Anthropic — costs nothing.
//   2. Every subsequent request sends the session token (x-qa-session header)
//      instead of the master secret. The master secret is used exactly once
//      per login, never repeated on every generation call.
//
// REQUIRED ENV VARS (set in your Vercel project settings, never in code):
//   QA_ACCESS_SECRET   — the passphrase a human enters to unlock the runner
//   QA_SESSION_SECRET  — a separate random string used only to sign session
//                         tokens (so a leaked QA_ACCESS_SECRET and a leaked
//                         session token are two different failure modes)
//   QA_RUNNER_ENABLED  — set to "false" to kill the endpoint instantly
//                         without a redeploy
//
// Generate both secrets locally, once:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

import crypto from 'crypto';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_PROMPT_LENGTH = 30000; // matches api/generate.js
const MAX_OUTPUT_TOKENS = 4096;  // matches api/generate.js
const MAX_REQUESTS_PER_RUN = 60; // generous ceiling above the current 8/50-case suites
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_PER_WINDOW = 20;
const AUTH_FAIL_LOCKOUT_THRESHOLD = 5;
const AUTH_FAIL_LOCKOUT_MS = 15 * 60 * 1000;

// NOTE on in-memory state: Vercel serverless functions are not guaranteed to
// stay warm or share memory across invocations/regions. This in-memory
// rate-limit/lockout state is a real, working best-effort protection for a
// low-traffic internal tool, but is NOT a substitute for the env-var kill
// switch or session expiry, which work regardless of instance state. For a
// stronger guarantee, back this with Redis/Vercel KV — noted as a known
// limitation, not implemented here since it requires infrastructure I don't
// have visibility into.
const rateLimitState = new Map(); // ip -> [timestamps]
const authFailState = new Map();  // ip -> { count, lockedUntil }

function signSession(payload) {
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', process.env.QA_SESSION_SECRET || '').update(data).digest('hex');
  return Buffer.from(data).toString('base64url') + '.' + sig;
}

function verifySession(token) {
  try {
    const [dataB64, sig] = String(token || '').split('.');
    if (!dataB64 || !sig) return null;
    const data = Buffer.from(dataB64, 'base64url').toString('utf8');
    const expectedSig = crypto.createHmac('sha256', process.env.QA_SESSION_SECRET || '').update(data).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(data);
    if (Date.now() > payload.exp) return null; // expired
    return payload;
  } catch (e) {
    return null;
  }
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const hits = (rateLimitState.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateLimitState.set(ip, hits);
  return hits.length <= RATE_LIMIT_MAX_PER_WINDOW;
}

function checkAuthLockout(ip) {
  const state = authFailState.get(ip);
  if (state && state.lockedUntil && Date.now() < state.lockedUntil) {
    return { locked: true, retryAfterMs: state.lockedUntil - Date.now() };
  }
  return { locked: false };
}

function recordAuthFailure(ip) {
  const state = authFailState.get(ip) || { count: 0, lockedUntil: 0 };
  state.count += 1;
  if (state.count >= AUTH_FAIL_LOCKOUT_THRESHOLD) {
    state.lockedUntil = Date.now() + AUTH_FAIL_LOCKOUT_MS;
    state.count = 0; // reset counter once locked
  }
  authFailState.set(ip, state);
}

function recordAuthSuccess(ip) {
  authFailState.delete(ip);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-qa-secret, x-qa-session');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Kill switch — fails closed, checked before anything else ──
  if (process.env.QA_RUNNER_ENABLED === 'false') {
    console.log('[qa-generate] Rejected: QA_RUNNER_ENABLED=false');
    return res.status(503).json({ error: 'QA runner is disabled', code: 'QA_DISABLED' });
  }
  if (!process.env.QA_ACCESS_SECRET || !process.env.QA_SESSION_SECRET) {
    console.error('[qa-generate] Missing QA_ACCESS_SECRET or QA_SESSION_SECRET env var');
    return res.status(503).json({ error: 'QA runner not configured', code: 'QA_NOT_CONFIGURED' });
  }

  const ip = getClientIp(req);
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON', code: 'INVALID_JSON' }); }
  }
  body = body || {};

  // ── Step 1: authentication (spends no AI credits) ──
  if (body.authCheck === true) {
    const lockout = checkAuthLockout(ip);
    if (lockout.locked) {
      console.log('[qa-generate] Auth attempt blocked by lockout. ip:', ip);
      return res.status(429).json({ error: 'Too many failed attempts. Try again later.', code: 'AUTH_LOCKED', retryAfterMs: lockout.retryAfterMs });
    }
    const supplied = req.headers['x-qa-secret'];
    // Never log the secret itself — only whether it matched.
    const valid = supplied && crypto.timingSafeEqual(
      Buffer.from(String(supplied).padEnd(128, '0')),
      Buffer.from(String(process.env.QA_ACCESS_SECRET).padEnd(128, '0'))
    ) && supplied === process.env.QA_ACCESS_SECRET;
    if (!valid) {
      recordAuthFailure(ip);
      console.log('[qa-generate] Auth failed. ip:', ip, 'result: invalid_secret');
      return res.status(401).json({ error: 'Unauthorized', code: 'INVALID_SECRET' });
    }
    recordAuthSuccess(ip);
    const exp = Date.now() + SESSION_TTL_MS;
    const token = signSession({ exp, ip, iat: Date.now() });
    console.log('[qa-generate] Auth succeeded. ip:', ip, 'session_exp:', new Date(exp).toISOString());
    return res.status(200).json({ ok: true, session: token, expiresAt: exp });
  }

  // ── Step 2: every generation request requires a valid, unexpired session ──
  const sessionToken = req.headers['x-qa-session'];
  const session = verifySession(sessionToken);
  if (!session) {
    console.log('[qa-generate] Rejected: missing/invalid/expired session. ip:', ip);
    return res.status(401).json({ error: 'Session invalid or expired — please log in again', code: 'SESSION_INVALID' });
  }

  if (!checkRateLimit(ip)) {
    console.log('[qa-generate] Rate limit exceeded. ip:', ip);
    return res.status(429).json({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' });
  }

  const { prompt, runRequestCount } = body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt', code: 'MISSING_PROMPT' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: 'Prompt exceeds maximum length', code: 'PROMPT_TOO_LONG' });
  }
  if (typeof runRequestCount === 'number' && runRequestCount > MAX_REQUESTS_PER_RUN) {
    console.log('[qa-generate] Rejected: run exceeded max requests. ip:', ip, 'count:', runRequestCount);
    return res.status(400).json({ error: 'Test run exceeded maximum request count', code: 'RUN_TOO_LARGE' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[qa-generate] ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'API key not configured', code: 'MISSING_API_KEY' });
  }

  try {
    const startTime = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', // matches api/generate.js — keep in sync manually, or import a shared constant
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const elapsed = Date.now() - startTime;
    console.log('[qa-generate] ip:', ip, 'status:', response.status, 'elapsed_ms:', elapsed);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error('[qa-generate] Anthropic error:', response.status, errBody.slice(0, 300));
      return res.status(response.status).json({ error: `Anthropic API returned ${response.status}`, code: 'ANTHROPIC_ERROR', status: response.status });
    }

    const data = await response.json();
    if (!data.content || !Array.isArray(data.content)) {
      return res.status(500).json({ error: 'Unexpected response structure', code: 'INVALID_RESPONSE' });
    }
    const text = data.content.map(b => b.text || '').join('');
    if (!text.trim()) {
      return res.status(500).json({ error: 'Empty response. Stop reason: ' + (data.stop_reason || 'unknown'), code: 'EMPTY_RESPONSE' });
    }

    return res.status(200).json({
      text,
      elapsedMs: elapsed,
      model: 'claude-sonnet-4-6',
      usage: data.usage || null, // token counts, if the API returns them
    });
  } catch (e) {
    console.error('[qa-generate] Unhandled error:', e.message);
    return res.status(500).json({ error: e.message || 'Generation failed', code: 'INTERNAL_ERROR' });
  }
}
