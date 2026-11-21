// Server-side input allow-listing. Nothing free-form reaches the model prompt.
export const HOUSEHOLD = ['children', 'older', 'respiratory'];
export const COMMUTE = ['car', 'twowheeler', 'transit', 'walk-bike'];

export function validateProfile(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object.' };
  const { city, aqi, household, commute } = body;
  if (typeof city !== 'string' || !/^[\p{L}\p{M}\s.'-]{2,60}$/u.test(city)) return { ok: false, error: 'Invalid city.' };
  if (!Number.isFinite(aqi) || aqi < 0 || aqi > 1000) return { ok: false, error: 'Invalid AQI.' };
  if (!Array.isArray(household) || household.length > 3 || !household.every((h) => HOUSEHOLD.includes(h))) return { ok: false, error: 'Invalid household.' };
  if (!COMMUTE.includes(commute)) return { ok: false, error: 'Invalid commute.' };
  return { ok: true, value: { city: city.trim(), aqi: Math.round(aqi), household: [...new Set(household)], commute } };
}
