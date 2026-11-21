import { CITY_PATTERN } from './constants.js';

const ENDPOINTS = { geo: 'https://geocoding-api.open-meteo.com/v1/search', air: 'https://air-quality-api.open-meteo.com/v1/air-quality' };
const TIMEOUT_MS = 8000;

/** Open-Meteo client with injectable fetch (testable) and a per-session geocode cache. */
export function createAirApi(fetchImpl) {
  const geoCache = new Map();

  async function getJson(url, signal) {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const res = await fetchImpl(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if (!res.ok) throw new Error('Air quality service is unavailable. Try again shortly.');
    return res.json();
  }

  async function resolveLocation(city, coords, signal) {
    if (coords) return { ...coords, name: 'your location' };
    const key = city.toLowerCase();
    if (!geoCache.has(key)) {
      const data = await getJson(`${ENDPOINTS.geo}?name=${encodeURIComponent(city)}&count=1`, signal);
      const hit = data.results?.[0];
      if (!hit) throw new Error(`We couldn’t find “${city}”. Check the spelling or use your location.`);
      geoCache.set(key, { latitude: hit.latitude, longitude: hit.longitude, name: CITY_PATTERN.test(hit.name) ? hit.name : city });
    }
    return geoCache.get(key);
  }

  async function fetchAqi({ latitude, longitude }, signal) {
    const data = await getJson(`${ENDPOINTS.air}?latitude=${latitude}&longitude=${longitude}&current=us_aqi`, signal);
    const aqi = data.current?.us_aqi;
    if (!Number.isFinite(aqi)) throw new Error('No air quality reading exists for this place yet.');
    return Math.round(aqi);
  }

  return { resolveLocation, fetchAqi };
}
