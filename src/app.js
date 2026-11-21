import { buildPlan } from './logic.js';
import { createAirApi } from './airApi.js';
import { CITY_PATTERN } from './constants.js';

const $ = (id) => document.getElementById(id);
const air = createAirApi((...args) => fetch(...args));
let inFlight; // cancels a stale request when the form is resubmitted

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
  inFlight?.abort();
  inFlight = new AbortController();
  const { signal } = inFlight;
  err.hidden = true;
  const city = $('city').value.trim();
  if (!coords && city.length < 2) { err.textContent = 'Enter your city, or use your location.'; err.hidden = false; $('city').focus(); return; }
  const household = [...document.querySelectorAll('[name=household]:checked')].map((i) => i.value);
  const commute = $('commute').value;
  btn.disabled = true; out.setAttribute('aria-busy', 'true');
  out.replaceChildren(h('div', { class: 'skeleton', role: 'status' }, h('span', { class: 'skip' }, 'Loading air quality')));
  try {
    const loc = await air.resolveLocation(city, coords, signal);
    const aqi = await air.fetchAqi(loc, signal);
    const plan = render(loc.name, buildPlan({ household, commute }, aqi));
    if (CITY_PATTERN.test(loc.name) && loc.name !== 'your location') loadSummary({ city: loc.name, aqi: plan.aqi, household, commute });
  } catch (e) {
    if (signal.aborted) return; // superseded by a newer request
    out.replaceChildren(h('p', { class: 'error', role: 'alert' }, e.message || 'Something went wrong. Please try again.'));
  } finally { if (!signal.aborted) { btn.disabled = false; out.setAttribute('aria-busy', 'false'); } }
}

$('form').addEventListener('submit', (e) => { e.preventDefault(); run(); });
$('locate').addEventListener('click', () => {
  if (!navigator.geolocation) { $('city-error').textContent = 'Location is not available in this browser. Enter your city instead.'; $('city-error').hidden = false; return; }
  navigator.geolocation.getCurrentPosition((p) => run({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
    () => { $('city-error').textContent = 'Location permission was denied. Enter your city instead.'; $('city-error').hidden = false; });
});
