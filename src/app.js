import { buildPlan } from './logic.js';

const $ = (id) => document.getElementById(id);
const API = { geo: 'https://geocoding-api.open-meteo.com/v1/search', air: 'https://air-quality-api.open-meteo.com/v1/air-quality' };
const TIMEOUT = 8000;

/** Safe DOM builder: text only, never innerHTML. */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(attrs.ns ?? 'http://www.w3.org/1999/xhtml', tag);
  for (const [k, v] of Object.entries(attrs)) if (k !== 'ns') el.setAttribute(k, v);
  el.append(...kids.filter((k) => k != null));
  return el;
}
const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error('Air quality service is unavailable. Try again shortly.');
  return r.json();
};

async function resolveLocation(city, coords) {
  if (coords) return { ...coords, name: 'your location' };
  const g = await getJson(`${API.geo}?name=${encodeURIComponent(city)}&count=1`);
  const hit = g.results?.[0];
  if (!hit) throw new Error(`We couldn’t find “${city}”. Check the spelling or use your location.`);
  return { latitude: hit.latitude, longitude: hit.longitude, name: hit.name };
}
const fetchAqi = async ({ latitude, longitude }) => {
  const d = await getJson(`${API.air}?latitude=${latitude}&longitude=${longitude}&current=us_aqi`);
  const aqi = d.current?.us_aqi;
  if (!Number.isFinite(aqi)) throw new Error('No air quality reading exists for this place yet.');
  return Math.round(aqi);
};

function gauge(aqi) {
  const C = 2 * Math.PI * 45, frac = Math.min(aqi, 300) / 300, ns = 'http://www.w3.org/2000/svg';
  const circle = (cls, extra = {}) => h('circle', { ns, class: cls, cx: 60, cy: 60, r: 45, fill: 'none', 'stroke-width': 10, ...extra });
  return h('svg', { ns, class: 'gauge', viewBox: '0 0 120 120', role: 'img', 'aria-label': `Air quality index ${aqi}` },
    circle('track'), circle('arc', { 'stroke-dasharray': `${frac * C} ${C}`, transform: 'rotate(-90 60 60)', 'stroke-linecap': 'round' }),
    h('text', { ns, x: 60, y: 69, 'text-anchor': 'middle' }, String(aqi)));
}

function render(place, plan) {
  const out = $('result');
  out.className = plan.band.id;
  const list = h('ol', { class: 'plan' }, ...plan.actions.map((a) => h('li', {},
    h('h3', {}, a.title), h('p', {}, h('b', {}, 'For you: '), a.you), a.air ? h('p', {}, h('b', {}, 'For the air: '), a.air) : null)));
  out.replaceChildren(
    h('div', { class: 'hero' }, h('div', {}, h('p', { class: 'band' }, `${plan.band.label} in ${place}`), h('h2', {}, plan.verdict)), gauge(plan.aqi)),
    h('div', { id: 'summary' }), h('h2', {}, 'What to do today'), list);
  out.setAttribute('aria-busy', 'false'); out.focus();
  return plan;
}

async function loadSummary(profile) {
  try {
    const r = await fetch('/api/advice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile), signal: AbortSignal.timeout(10000) });
    const { summary } = await r.json();
    if (summary) $('summary').replaceWith(h('p', { class: 'summary', id: 'summary' }, summary));
  } catch { /* the rule-based plan already answers the question */ }
}

async function run(coords) {
  const err = $('city-error'), btn = $('go'), out = $('result');
  err.hidden = true;
  const city = $('city').value.trim();
  if (!coords && city.length < 2) { err.textContent = 'Enter your city, or use your location.'; err.hidden = false; $('city').focus(); return; }
  const household = [...document.querySelectorAll('[name=household]:checked')].map((i) => i.value);
  const commute = $('commute').value;
  btn.disabled = true; out.setAttribute('aria-busy', 'true');
  out.replaceChildren(h('div', { class: 'skeleton', role: 'status' }, h('span', { class: 'skip' }, 'Loading air quality')));
  try {
    const loc = await resolveLocation(city, coords);
    const aqi = await fetchAqi(loc);
    const plan = render(loc.name, buildPlan({ household, commute }, aqi));
    if (/^[\p{L}\p{M}\s.'-]{2,60}$/u.test(loc.name) && loc.name !== 'your location') loadSummary({ city: loc.name, aqi: plan.aqi, household, commute });
  } catch (e) {
    out.replaceChildren(h('p', { class: 'error', role: 'alert' }, e.message || 'Something went wrong. Please try again.'));
  } finally { btn.disabled = false; out.setAttribute('aria-busy', 'false'); }
}

$('form').addEventListener('submit', (e) => { e.preventDefault(); run(); });
$('locate').addEventListener('click', () => {
  if (!navigator.geolocation) { $('city-error').textContent = 'Location is not available in this browser. Enter your city instead.'; $('city-error').hidden = false; return; }
  navigator.geolocation.getCurrentPosition((p) => run({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
    () => { $('city-error').textContent = 'Location permission was denied. Enter your city instead.'; $('city-error').hidden = false; });
});
