import { validateProfile } from '../src/validate.js';
import { buildPlan } from '../src/logic.js';

const hits = new Map(); // best-effort per-instance rate limit
const limited = (ip) => {
  const now = Date.now(), recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now); hits.set(ip, recent);
  return recent.length > 10;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (limited(req.headers['x-forwarded-for']?.split(',')[0] ?? 'unknown')) return res.status(429).json({ error: 'Too many requests.' });
  const parsed = validateProfile(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(200).json({ summary: null, source: 'rules' });

  const { city, aqi, household, commute } = parsed.value;
  const plan = buildPlan(parsed.value, aqi);
  const prompt = `You are a calm public-health assistant. In at most 60 words of plain language, tell a family in ${city} what today's US AQI of ${aqi} (${plan.band.label}) means. Household: ${household.join(', ') || 'adults only'}. Commute: ${commute}. Mention these steps: ${plan.actions.map((a) => a.title).join('; ')}. No medical diagnosis.`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 200, temperature: 0.4 } }),
    });
    const text = (await r.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.status(200).json({ summary: typeof text === 'string' ? text.slice(0, 600) : null, source: text ? 'gemini' : 'rules' });
  } catch {
    return res.status(200).json({ summary: null, source: 'rules' }); // graceful degradation
  }
}
