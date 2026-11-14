# Tranchi Land Preview · QA Report

## Verified deployments

- Local integrated preview: `http://127.0.0.1:3213/`
- Live: `https://tranchi-land-preview.onrender.com/`
- Latest verified application commit: `9a44de0` (`feat: add real Tranchi production deals workspace`)
- Alphapipe PR: https://github.com/tranchi-labs/tranchi-alpha-pipeline/pull/1

## Automated checks

- `npm test`: 68/68 unit, data, validation, market, URL, and real-deal tests passed.
- `npm run build`: TypeScript and Vite production build passed.
- `uv run pytest -q` in alphapipe: 49/49 tests passed.
- `python3 -m unittest discover scripts -p 'test_*.py'`: 6/6 malformed-data/export tests passed.
- `python3 scripts/validate_land_preview.py`: 556 records, no errors, no forbidden contact fields.
- `node scripts/e2e.mjs`: 10/10 checks passed locally and against the live URL.
- `node scripts/e2e-workflows.mjs`: shortlist, comparison, sharing, PDF, corrupt-link recovery, Escape, accessible mobile sharing, and mobile overflow all passed locally and live.
- `node scripts/e2e-markets.mjs`: market filtering, evidence filters, share URLs, and unsupported-zoning recovery all passed locally and live.
- `node scripts/e2e-deals.mjs`: 26 production cards, all three markets, real photos, source links, production IDs, filters, search/reset, mobile detail, and zero JavaScript errors passed locally.

## Verified product behavior

1. The map renders 439 verified/probable land records across Cleveland OH, Bastrop TX, and Lehigh Acres FL.
2. Improved and unclear records appear only after explicit inclusion; all 556 candidates are retained in the data.
3. Lehigh Acres filtering returns 59 likely-vacant records with evidence badges.
4. Market selection is preserved in share URLs.
5. Unsupported zoning resets with a visible warning instead of a silent empty state.
6. Parcel analysis uses 12 real recorded-sale comps; improved and unclear parcels are excluded from comp pools and valuation.
7. The 0.1-acre filter returns 104 records across all three markets.
8. Named saved searches persist to localStorage.
9. CSV downloads contain 104 filtered records plus the header, validation fields, and no contact columns.
10. Shortlist add/remove persists across reloads.
11. Two-parcel comparison works and is restored from a compare URL.
12. Shared searches restore shortlisted parcel IDs.
13. Real PDF downloads work: 20,168 bytes with an estimate and 10,101 bytes with an honest insufficient-comps state.
14. Escape closes the comp/offer dialog; when opened from comparison, only the topmost PDF handles Escape and comparison returns after it closes.
15. Mobile share has an accessible name.
16. The 390px mobile layout has no horizontal overflow; filter drawer, list, shortlist, comparison, and full-width inspector work with zero JavaScript errors.

## Data and share-safety checks

- 556 real records extracted from the authoritative DGX Spark alphapipe cache; no paid provider retrieval.
- Validation statuses: 51 verified vacant, 388 probable vacant, 114 improved, 3 unclear.
- No owner names, mailing addresses, phone numbers, or email addresses.
- No backend, authentication, live lookup, CRM write, skip trace, direct mail, e-sign, or outbound action.
- No LandAtlas branding, code, or assets.
- Raw SQLite files and Python artifacts are gitignored.
- `noindex,nofollow` and static security headers are present.

## Visual review note

Playwright screenshots were captured under `qa/screenshots/` locally. The available AI visual-analysis service timed out on repeated attempts, so no AI visual-inspection claim is made. Layout and interactions were verified through real browser DOM checks, viewport/overflow assertions, and Playwright suites.

Design-slop self-audit: 0/10. The composition is an Explore surface led by map, filters, and inspector; Tranchi navy/gold and DM Sans are deliberate existing brand choices. No marketing hero, feature-tile grid, generic gradient, glassmorphism, fake metrics, or decorative SVG product imagery.

## Deployment notes

The initial automatic Render deploy used default static settings (`public`, no build command) and failed. The service was corrected to `npm ci && npm run build` with `dist` as the publish directory. The explicit replacement deploy succeeded and is live. Subsequent integrated commits auto-deployed successfully, including the final accessibility/hardening commit.

## API verification

The separate alphapipe branch implements `POST /alpha/land/search` with exact vacant-lot predicates, land-specific scoring, cache-only responses, contact-free projections, explicit `cache_miss`, and `criteriaNotJudged` for missing APN, geo status, assessment, sale, acreage, zoning, and topography. The endpoint makes no BatchData call. Its second-market plan uses free `take=0` counts only: Cleveland 3,421; Ocala 2,578; Lehigh Acres 64,552. Ocala is recommended for a later guarded second market; a broad Lehigh Acres pull is rejected.
