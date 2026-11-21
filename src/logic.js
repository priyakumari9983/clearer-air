import { HOUSEHOLD } from './constants.js';

// Pure decision logic: no DOM, no network. Fully unit-tested.
export const BANDS = [
  { max: 50, id: 'good', label: 'Good' },
  { max: 100, id: 'moderate', label: 'Moderate' },
  { max: 150, id: 'sensitive', label: 'Unhealthy for sensitive groups' },
  { max: 200, id: 'unhealthy', label: 'Unhealthy' },
  { max: 300, id: 'very-unhealthy', label: 'Very unhealthy' },
  { max: Infinity, id: 'hazardous', label: 'Hazardous' },
];
const CAR_KG_CO2_PER_KM = 0.17; // average petrol car, rough estimate

export const bandIndex = (aqi) => BANDS.findIndex((b) => aqi <= b.max);

/** Sensitive households are advised as if air were one band worse (above AQI 50). */
export function effectiveLevel(aqi, household = []) {
  const vulnerable = household.some((h) => HOUSEHOLD.includes(h));
  return Math.min(BANDS.length - 1, bandIndex(aqi) + (vulnerable && aqi > 50 ? 1 : 0));
}

const has = (p, k) => p.household.includes(k);
const RULES = [
  { id: 'ventilate', min: 0, max: 1, priority: 5, title: 'Open windows for 10 minutes',
    you: 'Fresh air clears cooking fumes and CO₂ that build up indoors.', air: null },
  { id: 'windows', min: 2, priority: 10, title: 'Keep windows shut; air out only at the cleanest hour',
    you: 'A closed home usually holds fine particles well below street levels.', air: null },
  { id: 'purifier', min: 2, priority: 9, title: 'Run a HEPA purifier where you sleep',
    you: 'A right-sized HEPA unit can remove most fine particles from one room. A box fan with a filter is a low-cost version.', air: null },
  { id: 'mask', min: 3, priority: 8, title: 'Wear an N95 or FFP2 mask for essential trips outside',
    you: 'A snug-fitting respirator blocks most fine particles; loose cloth masks do not.', air: null },
  { id: 'kids', min: 2, when: (p) => has(p, 'children'), priority: 9, title: 'Move children’s play and PE indoors',
    you: 'Children breathe faster and their lungs are still developing, so outdoor exertion raises their dose.', air: null },
  { id: 'older', min: 2, when: (p) => has(p, 'older'), priority: 7, title: 'Plan errands for midday and keep them short',
    you: 'Older adults are more at risk of heart and lung strain on smoggy days.', air: null },
  { id: 'respiratory', min: 2, when: (p) => has(p, 'respiratory'), priority: 10, title: 'Keep quick-relief medicine within reach and follow your care plan',
    you: 'Smog can trigger flare-ups; talk to your doctor about a smog-day plan.', air: null },
  { id: 'car', min: 1, when: (p) => p.commute === 'car', priority: 6, title: 'Combine errands, carpool, or switch one trip to transit',
    you: 'Less traffic near your home means fewer fumes at your door.',
    air: `A 10 km car trip skipped avoids about ${(10 * CAR_KG_CO2_PER_KM).toFixed(1)} kg CO₂ plus tailpipe particles and NOx (estimate).` },
  { id: 'twowheeler', min: 3, when: (p) => ['twowheeler', 'walk-bike'].includes(p.commute), priority: 8, title: 'Take transit or a low-traffic route, and ease off the effort',
    you: 'Hard breathing near traffic multiplies how much smog you inhale.', air: null },
  { id: 'cooking', min: 1, priority: 4, title: 'Use the extractor fan and avoid high-heat frying',
    you: 'Cooking is the biggest indoor source of fine particles.', air: null },
  { id: 'burning', min: 1, priority: 7, title: 'Do not burn waste, leaves or wood; use electric heating if you can',
    you: 'Smoke from your own fire also enters your home.',
    air: 'Open burning is a major winter source of PM2.5, so every fire avoided lowers your whole neighbourhood’s air.' },
  { id: 'workout', min: 3, priority: 6, title: 'Exercise indoors today',
    you: 'Light indoor movement avoids deep breaths of polluted air.', air: null },
];
const VERDICTS = [
  'Good air today. Open the windows.', 'Fine for most; sensitive lungs should watch for symptoms.',
  'Limit time outside and clean your indoor air.', 'Stay in where you can and mask up outside.',
  'Stay indoors with windows shut.', 'Hazardous: stay indoors and seek clean air.',
];

export function buildPlan(profile, aqi) {
  const level = effectiveLevel(aqi, profile.household);
  const actions = RULES.filter((r) => level >= r.min && level <= (r.max ?? 5) && (!r.when || r.when(profile)))
    .sort((a, b) => b.priority - a.priority).slice(0, 6)
    .map(({ id, title, you, air }) => ({ id, title, you, air }));
  return { aqi, level, band: BANDS[bandIndex(aqi)], actions, verdict: VERDICTS[level] };
}
