import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/rateLimiter.js';
import { createTtlCache } from '../src/ttlCache.js';
import { createAirApi } from '../src/airApi.js';
import { buildPlan, bandIndex, BANDS } from '../src/logic.js';
import { buildPrompt } from '../src/prompt.js';

test('rate limiter expires old hits and bounds tracked keys', () => {
  let t = 0;
  const limited = createRateLimiter({ limit: 2, windowMs: 100, maxKeys: 2, now: () => t });
  assert.deepEqual([limited('a'), limited('a'), limited('a')], [false, false, true]);
  t = 200; assert.equal(limited('a'), false);
  limited('b'); limited('c'); limited('d'); // 'a' evicted, memory stays bounded
  assert.equal(limited('a'), false);
});
test('ttl cache expires entries and evicts the oldest', () => {
  let t = 0;
  const c = createTtlCache({ ttlMs: 10, maxEntries: 2, now: () => t });
  c.set('a', 1); c.set('b', 2); c.set('c', 3);
  assert.equal(c.get('a'), undefined); assert.equal(c.get('c'), 3);
  t = 11; assert.equal(c.get('c'), undefined);
});
test('band boundaries follow the US AQI scale', () => {
  for (const [aqi, i] of [[50, 0], [51, 1], [100, 1], [101, 2], [150, 2], [151, 3], [200, 3], [201, 4], [300, 4], [301, 5]]) assert.equal(bandIndex(aqi), i);
  assert.equal(BANDS.length, 6);
});
test('every context-specific rule fires when it should', () => {
  const ids = (household, commute, aqi) => buildPlan({ household, commute }, aqi).actions.map((a) => a.id);
  assert.ok(ids(['older'], 'transit', 120).includes('older'));
  assert.ok(ids([], 'twowheeler', 220).includes('twowheeler'));
  assert.ok(ids([], 'car', 60).includes('car'));
  assert.ok(ids([], 'transit', 250).includes('mask'));
  assert.ok(!ids([], 'transit', 60).includes('mask'));
});
test('prompt contains only validated fields', () => {
  const profile = { city: 'Delhi', aqi: 220, household: [], commute: 'car' };
  assert.match(buildPrompt(profile, buildPlan(profile, 220)), /Delhi.*220.*adults only/s);
});
const json = (data, ok = true) => async () => ({ ok, json: async () => data });
test('air API caches geocoding and surfaces friendly errors', async () => {
  let calls = 0;
  const api = createAirApi(async () => { calls++; return { ok: true, json: async () => ({ results: [{ latitude: 1, longitude: 2, name: 'Delhi' }] }) }; });
  await api.resolveLocation('Delhi'); await api.resolveLocation('DELHI');
  assert.equal(calls, 1);
  await assert.rejects(createAirApi(json({ results: [] })).resolveLocation('Nowhere'), /couldn’t find/);
  await assert.rejects(createAirApi(json({}, false)).fetchAqi({ latitude: 1, longitude: 2 }), /unavailable/);
  await assert.rejects(createAirApi(json({ current: {} })).fetchAqi({ latitude: 1, longitude: 2 }), /No air quality/);
  assert.equal(await createAirApi(json({ current: { us_aqi: 87.6 } })).fetchAqi({ latitude: 1, longitude: 2 }), 88);
});
