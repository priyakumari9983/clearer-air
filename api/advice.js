import { validateProfile } from '../src/validate.js';
import { buildPlan } from '../src/logic.js';
import { buildPrompt } from '../src/prompt.js';
import { createRateLimiter } from '../src/rateLimiter.js';
import { createTtlCache } from '../src/ttlCache.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const RULES_ONLY = { summary: null, source: 'rules' };

/** Handler factory: dependencies are injected so every branch is unit-testable. */
export function createHandler({
  fetchImpl = fetch,
  env = process.env,
  limiter = createRateLimiter({ limit: 10, windowMs: 60_000 }),
  cache = createTtlCache({ ttlMs: 30 * 60_000, maxEntries: 200 }),
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
    const ip = req.headers['x-real-ip'] ?? req.headers['x-forwarded-for']?.split(',')[0] ?? 'unknown';
    if (limiter(ip)) return res.status(429).json({ error: 'Too many requests.' });

    const parsed = validateProfile(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    if (!env.GEMINI_API_KEY) return res.status(200).json(RULES_ONLY);

    const profile = parsed.value;
    const cacheKey = [profile.city.toLowerCase(), profile.aqi, [...profile.household].sort(), profile.commute].join('|');
    const cached = cache.get(cacheKey);
    if (cached) return res.status(200).json({ summary: cached, source: 'cache' });

    try {
      const response = await fetchImpl(`${GEMINI_URL}/${env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(profile, buildPlan(profile, profile.aqi)) }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.4 },
        }),
      });
      if (!response.ok) return res.status(200).json(RULES_ONLY);
      const text = (await response.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string' || !text.trim()) return res.status(200).json(RULES_ONLY);
      const summary = text.slice(0, 600);
      cache.set(cacheKey, summary);
      return res.status(200).json({ summary, source: 'gemini' });
    } catch {
      return res.status(200).json(RULES_ONLY); // graceful degradation
    }
  };
}

export default createHandler();
