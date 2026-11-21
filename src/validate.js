import { HOUSEHOLD, COMMUTE, CITY_PATTERN, MAX_AQI } from './constants.js';

/**
 * @typedef {{ city: string, aqi: number, household: string[], commute: string }} Profile
 * @param {unknown} body Untrusted request body.
 * @returns {{ ok: true, value: Profile } | { ok: false, error: string }}
 * Allow-lists every field so nothing free-form can reach the model prompt.
 */
export function validateProfile(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object.' };
  const { city, aqi, household, commute } = body;
  if (typeof city !== 'string' || !CITY_PATTERN.test(city)) return { ok: false, error: 'Invalid city.' };
  if (!Number.isFinite(aqi) || aqi < 0 || aqi > MAX_AQI) return { ok: false, error: 'Invalid AQI.' };
  if (!Array.isArray(household) || household.length > HOUSEHOLD.length || !household.every((h) => HOUSEHOLD.includes(h))) {
    return { ok: false, error: 'Invalid household.' };
  }
  if (!COMMUTE.includes(commute)) return { ok: false, error: 'Invalid commute.' };
  return { ok: true, value: { city: city.trim(), aqi: Math.round(aqi), household: [...new Set(household)], commute } };
}
