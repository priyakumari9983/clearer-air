import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/advice.js';
import { createRateLimiter } from '../src/rateLimiter.js';
import { createTtlCache } from '../src/ttlCache.js';

const body = { city: 'Delhi', aqi: 220, household: ['children'], commute: 'car' };
const makeRes = () => ({ code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const call = async (handler, req) => { const res = makeRes(); await handler({ method: 'POST', headers: {}, body, ...req }, res); return res; };
const gemini = (text, ok = true) => async () => ({ ok, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const setup = (over = {}) => createHandler({ env: { GEMINI_API_KEY: 'k' }, limiter: () => false, ...over });

test('rejects non-POST and sets no-store', async () => {
  const res = await call(setup(), { method: 'GET' });
  assert.equal(res.code, 405); assert.equal(res.headers['Cache-Control'], 'no-store');
});
test('rejects invalid input with 400', async () => {
  assert.equal((await call(setup(), { body: { ...body, city: '<script>' } })).code, 400);
});
test('rate limits with 429', async () => {
  const handler = setup({ limiter: createRateLimiter({ limit: 1, windowMs: 1000 }) });
  assert.equal((await call(handler)).code, 200);
  assert.equal((await call(handler)).code, 429);
});
test('falls back to rules without an API key', async () => {
  assert.deepEqual((await call(setup({ env: {} }))).body, { summary: null, source: 'rules' });
});
test('returns a Gemini summary and sends the key in a header, not the URL', async () => {
  let seen;
  const res = await call(setup({ fetchImpl: async (url, init) => { seen = { url, init }; return gemini('Stay in.')(); } }));
  assert.equal(res.body.source, 'gemini');
  assert.ok(!seen.url.includes('key')); assert.equal(seen.init.headers['x-goog-api-key'], 'k');
});
test('falls back when Gemini errors, returns non-OK or empty text', async () => {
  for (const fetchImpl of [async () => { throw new Error('down'); }, gemini('x', false), gemini('  ')]) {
    assert.equal((await call(setup({ fetchImpl }))).body.source, 'rules');
  }
});
test('caches identical requests so Gemini is called once', async () => {
  let calls = 0;
  const handler = setup({ fetchImpl: async () => { calls++; return gemini('Stay in.')(); }, cache: createTtlCache({ ttlMs: 1000, maxEntries: 5 }) });
  await call(handler); const second = await call(handler);
  assert.equal(calls, 1); assert.equal(second.body.source, 'cache');
});
