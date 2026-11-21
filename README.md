# Clearer Air — Urban Air Quality Assistant (Challenge 6)

**Vertical:** families and communities facing severe winter smog.

[Watch the 30-second demo](demo.mp4)

## Approach and logic
1. Live US AQI comes from Open-Meteo (no key, free) for the chosen city or device location.
2. `src/logic.js` (pure, unit-tested) turns AQI + household (children, older adults, lung conditions) + commute into a ranked plan. Sensitive households are advised one band worse.
3. Every action explains **For you** (health effect) and **For the air** (what it avoids, e.g. ~1.7 kg CO₂ per 10 km car trip skipped, an estimate).
4. `api/advice.js` optionally asks Gemini for a 60-word plain-language summary. Without a key, or on any failure, the rule-based plan still works.

## Quality notes
- **Security:** strict CSP + security headers (`vercel.json`), allow-list validation (`src/validate.js`), no `innerHTML`, API key server-side only, rate limit, timeouts. Health details are never stored.
- **Accessibility:** semantic form, labels, skip link, `aria-live` results, focus management, 44 px targets, colour never the only signal, dark mode, reduced motion.
- **Efficiency:** zero dependencies and no build step (~25 KB of app code). Geocoding is cached per session, stale requests are aborted, identical Gemini requests are served from a 30-minute bounded cache, and static assets are cacheable. The demo video is never loaded by the app.
- **Testing:** `npm test` / `npm run coverage` (Node built-in runner, no dependencies). Covers band boundaries, every rule, validation, rate limiter, cache, Open-Meteo client and every API branch (405/400/429, no key, success, cache hit, Gemini failure) with injected fakes. GitHub Actions runs it on Node 20 and 22.
- **Structure:** `src/constants.js` (shared rules), `logic.js` (pure decisions), `validate.js`, `airApi.js`, `prompt.js`, `rateLimiter.js`, `ttlCache.js`, `app.js` (UI only), `api/advice.js` (injected dependencies).

## Run and deploy
`npm test` · `npx vercel dev` · push to GitHub and import into Vercel. Optional env: `GEMINI_API_KEY`, `GEMINI_MODEL`.

## Assumptions
US AQI scale; AQI is a model estimate, not a medical diagnosis; advice is general guidance.
