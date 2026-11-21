/** Pure prompt builder. Inputs are already allow-list validated. */
export function buildPrompt({ city, aqi, household, commute }, plan) {
  return `You are a calm public-health assistant. In at most 60 words of plain language, tell a family in ${city} what today's US AQI of ${aqi} (${plan.band.label}) means. Household: ${household.join(', ') || 'adults only'}. Commute: ${commute}. Mention these steps: ${plan.actions.map((a) => a.title).join('; ')}. No medical diagnosis.`;
}
