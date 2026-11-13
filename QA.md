# Tranchi Land Preview · QA Report

## Verified deployments

- Local: `http://127.0.0.1:3210/`
- Live: `https://tranchi-land-preview.onrender.com/`
- Live Render deploy: `dep-dbr6j1t9fdbs73delt3g`
- Commit: `f02db7b392aba9ba32b316317ef333b7292cb294`

## Automated checks

- `npm test`: 7/7 unit and real-data tests passed.
- `npm run build`: TypeScript and Vite production build passed.
- `node scripts/e2e.mjs`: 9/9 local browser checks passed.
- `BASE_URL=https://tranchi-land-preview.onrender.com/ node scripts/e2e.mjs`: 9/9 live browser checks passed.

Browser coverage:

1. 140 real parcel markers render on the map.
2. Parcel inspector opens with real data; 12 recorded-sale comps and the max-offer calculation render for the tested parcel.
3. The 0.1-acre maximum filter returns exactly 48 parcels.
4. Named saved searches persist to localStorage.
5. CSV downloads contain 48 filtered records plus the header and no contact columns.
6. Empty results show a useful reset path.
7. Desktop has zero JavaScript errors.
8. The 390px mobile layout has no horizontal page overflow.
9. Mobile filter drawer, list, full-width inspector, close path, and console all pass with zero JavaScript errors.

## Share-safety checks

- 140 real records exported from the local alphapipe cache.
- No owner names, mailing addresses, phone numbers, or email addresses.
- No backend, authentication, live lookup, CRM write, skip trace, direct mail, e-sign, or outbound action.
- No LandAtlas branding, code, or assets.

## Visual review note

Playwright screenshots were captured under `qa/screenshots/` locally. The available AI visual-analysis service timed out on repeated attempts, so no AI visual-inspection claim is made. Layout and interactions were verified through real browser DOM checks, viewport/overflow assertions, and the Playwright suite.

Design-slop self-audit: 0/10. The composition is an Explore surface led by map, filters, and inspector; Tranchi navy/gold and DM Sans are deliberate existing brand choices. No marketing hero, feature-tile grid, generic gradient, glassmorphism, fake metrics, or decorative SVG product imagery.

## Deployment note

The initial automatic Render deploy used default static settings (`public`, no build command) and failed. The service was corrected to `npm ci && npm run build` with `dist` as the publish directory. The explicit replacement deploy succeeded and is live.
