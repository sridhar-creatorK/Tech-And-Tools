/**
 * WizOS AI Worker  (Cloudflare Workers)
 * One main AI + 3 backups. If one fails, times out or is out of quota, the next one answers.
 *
 *   Main      Cloudflare Workers AI (Llama 3.3 70B)      needs: AI binding          (free, no key)
 *   Backup 1  Groq (Llama)                               needs: GROQ_API_KEY secret (free key)
 *   Backup 2  Google Gemini (Flash-Lite)                 needs: GEMINI_API_KEY secret (free key)
 *   Backup 3  Cloudflare Workers AI (Gemma 3 12B)        needs: AI binding          (free, no key)
 * A backup whose key is missing is skipped, so the Worker works with just the AI binding.
 * Every service also has its own list of model names. If a model has been retired (they are, often),
 * the Worker quietly tries the next name in that list instead of failing.
 *
 * SETUP (Cloudflare dashboard → Workers & Pages → your worker):
 *  1. Edit code → paste this file → Deploy.
 *  2. Settings → Bindings → Add → "Workers AI" → variable name:  AI
 *  3. Settings → Variables and Secrets → add secrets (optional, recommended):
 *       GROQ_API_KEY    (console.groq.com → API Keys)
 *       GEMINI_API_KEY  (aistudio.google.com → Get API key)
 *  4. Optional daily limit per visitor: Bindings → add "KV namespace" → variable name: RATE
 *  5. Optional: change models WITHOUT editing code, add variables (text):
 *       MAIN_MODEL, BACKUP_MODEL, GROQ_MODEL, GEMINI_MODEL      (the value is tried first)
 *     To stretch the free daily allowance, set MAIN_MODEL to  @cf/meta/llama-3.1-8b-instruct-fp8-fast
 *
 * The website sends  POST { messages:[{role,content}], feature }  and gets  { reply, via }  or  { error }.
 *
 * SECURITY NOTES:
 *  - The Origin allow-list below stops ordinary browser traffic from other sites, but it is
 *    NOT authentication: a non-browser client can send any Origin header it likes. Treat the
 *    per-minute/per-day limits as the real defence, not the origin check.
 *  - `feature` only selects a server-side output-token budget (see FEATURE_TOKENS). It is
 *    validated against a fixed allow-list and is never used as a raw number from the client.
 *  - Any client-supplied message with role "system" is dropped before it reaches a model —
 *    the website never sends one (it folds its system prompt into the first user message), so
 *    a "system" role in a request body is always an attempt to override server-side behaviour.
 */

const ALLOWED_ORIGINS = [
  // Every canonical URL, the sitemap, robots.txt, Open Graph tags and the JSON-LD structured
  // data in this project all point at sridhar-creatork.github.io/Tech-And-Tools/, so that is
  // the domain this Worker treats as "the website" (origin check below, used as the default
  // response Origin, and first in this list).
  'https://sridhar-creatork.github.io', // your website (WizOS) — matches canonical/sitemap/robots.txt
  'https://techtoolwiz.github.io',      // kept for a possible move to this domain later; remove if unused
  // 'https://your-own-domain.com',    // add a custom domain here later
  'http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:5500', 'http://127.0.0.1:5500', // local testing
];

const LIMITS = {
  maxMessages: 12,        // only the latest messages are sent to the AI (saves quota)
  maxMessageChars: 6000,  // per message
  maxTotalChars: 26000,   // whole request
  maxOutputTokens: 900,   // default/fallback budget, and the hard cap for every feature below
  perMinute: 12,          // requests per visitor per minute (per server instance — see NOTE below)
  perDay: 150,            // requests per visitor per day (needs the RATE KV binding)
  providerTimeoutMs: 9000, // time one service gets (all its model names share this)
  totalBudgetMs: 24000,   // after this long, stop starting new services (the website gives up at 40 s)
  restSeconds: 60,        // a service that failed twice rests this long
};
// NOTE on perMinute: this is held in a plain in-memory Map, which is per *isolate*, not global.
// Cloudflare can run several isolates for the same Worker at once (and always starts fresh ones
// on redeploys/cold starts), so a visitor can in practice get a few times LIMITS.perMinute across
// isolates. It still blocks simple abuse and needs no setup. perDay (via the optional RATE KV
// binding) is the one real cross-instance limit — enable it if you need a dependable cap.

// Per-feature output-token budgets. Web Tricks ("writer") returns a JSON payload with a coach
// reply plus a practice page's HTML/CSS, which is far bigger than a short chat answer — the old
// fixed 900-token cap routinely cut that JSON off mid-string, which is why the app would fall
// back to a generic placeholder even though the model's answer was fine. Unknown/missing
// features fall back to maxOutputTokens. Every value here is still capped at maxOutputTokens's
// successor below (MAX_FEATURE_TOKENS) regardless of what a client sends.
const FEATURE_TOKENS = {
  assistant: 1300,
  writer: 2600, // Letter/Form Writer + Web Tricks coach (coachReply + practiceHTML + practiceCSS)
  grammar: 900,
  translate: 900,
};
const MAX_FEATURE_TOKENS = 3000; // hard ceiling, independent of FEATURE_TOKENS values above
function tokensForFeature(feature) {
  const n = FEATURE_TOKENS[feature] ?? LIMITS.maxOutputTokens;
  return Math.min(n, MAX_FEATURE_TOKENS);
}

/* Model names, best first. Edit freely; the variables above are tried before these. */
const MODELS = {
  main: ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct-fp8-fast'],
  backup: ['@cf/meta/llama-3.1-8b-instruct-fast', '@cf/meta/llama-3.2-3b-instruct'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  gemini: ['gemini-3.1-flash-lite', 'gemini-3.5-flash'],
};
const modelList = (env, key, varName) => [...new Set([env[varName], ...MODELS[key]].filter(Boolean))];

/* ---------- providers: each returns the reply text or throws ---------- */
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/* Tries each model name in turn until one answers, inside one shared time limit. */
async function tryModels(models, attempt) {
  const until = Date.now() + LIMITS.providerTimeoutMs; let last = new Error('no model');
  for (const m of models) {
    const left = until - Date.now(); if (left < 800) break;
    try { return await attempt(m, left); } catch (e) { last = e; if (e.stop) throw e; }
  }
  throw last;
}

const workersAI = (name, key, varName) => ({
  name,
  ready: (env) => !!env.AI,
  run: (env, messages, maxTokens) => tryModels(modelList(env, key, varName), async (model, ms) => {
    const out = await withTimeout(env.AI.run(model, { messages, max_tokens: maxTokens }), ms);
    const text = typeof out === 'string' ? out : out?.response || out?.result?.response || out?.choices?.[0]?.message?.content || '';
    if (!text.trim()) throw new Error('empty');
    return text;
  }),
});

const groq = {
  name: 'Groq',
  ready: (env) => !!env.GROQ_API_KEY,
  run: (env, messages, maxTokens) => tryModels(modelList(env, 'groq', 'GROQ_MODEL'), async (model, ms) => {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.6 }),
      signal: AbortSignal.timeout(ms),
    });
    if (!r.ok) { const e = new Error(`groq ${r.status}`); e.stop = [401, 403, 429].includes(r.status); throw e; } // bad key or out of quota: another model name will not help
    return (await r.json()).choices?.[0]?.message?.content || '';
  }),
};

const gemini = {
  name: 'Gemini',
  ready: (env) => !!env.GEMINI_API_KEY,
  run: (env, messages, maxTokens) => tryModels(modelList(env, 'gemini', 'GEMINI_MODEL'), async (model, ms) => {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const contents = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const body = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.6 } };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    });
    if (!r.ok) { const e = new Error(`gemini ${r.status}`); e.stop = [401, 403, 429].includes(r.status); throw e; }
    return (await r.json()).candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  }),
};

// Order = Main, Backup 1, Backup 2, Backup 3
const CHAIN = [workersAI('Cloudflare AI', 'main', 'MAIN_MODEL'), groq, gemini, workersAI('Cloudflare AI (backup model)', 'backup', 'BACKUP_MODEL')];

/* ---------- small helpers ---------- */
const failures = new Map(); // provider name -> { n, until }  (kept per server instance)
const hits = new Map();     // visitor -> [timestamps]          (kept per server instance)

const json = (data, status, origin) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin || ALLOWED_ORIGINS[0],
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  },
});

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    // "system" is intentionally excluded: the website never sends one (it folds the system
    // prompt into the first user message client-side), so a client-supplied system role is
    // always either a bug or an attempt to override server-side behaviour. Drop it rather
    // than forward it to a model.
    .filter((m) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role) && m.content.trim())
    .slice(-LIMITS.maxMessages)
    .map((m) => ({ role: m.role, content: m.content.slice(0, LIMITS.maxMessageChars) }));
  if (!msgs.length || !msgs.some((m) => m.role === 'user')) return null;
  return msgs;
}

async function overLimit(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= LIMITS.perMinute) return 'Too many requests. Please wait a minute and try again.';
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // never let memory grow
  if (env.RATE) { // optional daily cap shared across all servers
    try {
      const key = `d:${new Date().toISOString().slice(0, 10)}:${ip}`;
      const used = +(await env.RATE.get(key)) || 0;
      if (used >= LIMITS.perDay) return 'Daily limit reached for this connection. Please come back tomorrow.';
      await env.RATE.put(key, String(used + 1), { expirationTtl: 90000 });
    } catch (e) {
      // A KV outage must never take the whole AI feature down with it — fall back to the
      // in-memory per-minute limit above and let the request through. Logged without the key.
      console.error('RATE KV error (continuing without daily cap):', e?.message || e);
    }
  }
  return '';
}

async function ask(env, messages, maxTokens) {
  const started = Date.now(); let attempted = 0;
  for (const [i, p] of CHAIN.entries()) {
    if (!p.ready(env)) continue;
    if (Date.now() - started > LIMITS.totalBudgetMs) break; // the website is about to give up; do not start another service
    const f = failures.get(p.name);
    if (f && f.until > Date.now()) continue; // resting after repeated failures
    attempted += 1;
    try {
      const reply = (await p.run(env, messages, maxTokens)).trim();
      if (!reply) throw new Error('empty');
      failures.delete(p.name);
      return { reply, via: i === 0 ? `Main AI · ${p.name}` : `Backup ${i} · ${p.name}` };
    } catch (e) {
      // Log enough to debug a provider outage without ever logging message content or secrets.
      console.error(`AI provider failed: ${p.name} — ${e?.message || e}`);
      const n = (f?.n || 0) + 1;
      failures.set(p.name, n >= 2 ? { n: 0, until: Date.now() + LIMITS.restSeconds * 1000 } : { n, until: 0 });
    }
  }
  if (!attempted) failures.clear(); // everything was resting: next request gets a clean try
  return null;
}

/* ---------- entry point ---------- */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, allowed ? origin : '');
    if (!allowed) return json({ error: 'This AI only works from the WizOS website.' }, 403, '');

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400, origin); }
    if (!body || typeof body !== 'object') return json({ error: 'Invalid request.' }, 400, origin);
    const messages = cleanMessages(body.messages);
    if (!messages) return json({ error: 'Send at least one message.' }, 400, origin);
    if (messages.reduce((n, m) => n + m.content.length, 0) > LIMITS.maxTotalChars) return json({ error: 'That message is too long.' }, 413, origin);
    // `feature` only ever selects a fixed, server-defined token budget — never a raw number.
    const feature = typeof body.feature === 'string' && Object.prototype.hasOwnProperty.call(FEATURE_TOKENS, body.feature) ? body.feature : null;
    const maxTokens = tokensForFeature(feature);

    const blocked = await overLimit(request, env);
    if (blocked) return json({ error: blocked }, 429, origin);

    const result = await ask(env, messages, maxTokens);
    if (!result) return json({ error: 'All AI services are busy right now. Please try again in a minute.' }, 503, origin);
    return json(result, 200, origin);
  },
};
