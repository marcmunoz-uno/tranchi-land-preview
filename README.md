# Tranchi Land · Interactive Cleveland Preview

An original Tranchi-branded land-flipping product mockup built with real cached public-record data. It is not affiliated with LandAtlas and uses no LandAtlas code, branding, or assets.

## What works

- 140 real Cleveland vacant-land records with no owner contact details
- Street and satellite maps with synchronized parcel selection
- Address/APN/ZIP, acreage, zoning, topography, seller-signal, and sale-history filters
- Map-first and list-first layouts
- Parcel facts and explainable seller signals
- Recorded-sale land comps with explicit radius, recency, and acreage controls
- Comp-supported value and editable max-offer model; no estimate with fewer than three comps
- Named saved searches on the current device
- CSV export of filtered parcel data without owner contact columns
- Shareable parcel links and responsive mobile drawers/inspector

## Honest limits

This is a static interactive preview, not a live subscription product. It has no backend, authentication, live feed, owner contacts, skip tracing, direct mail, e-sign, CRM writes, or outbound actions. Flood, wetlands, canal access, and parcel-boundary polygons are not in the cached dataset. Points are provider coordinates/parcel centroids, not boundaries. Public records can be wrong or stale; verify before making an offer.

## Local development

```bash
npm ci
python3 scripts/export_land_preview.py --out data/cleveland-land.json --coverage data/coverage.json
npm run dev
```

Open http://localhost:3210.

## Verification

```bash
npm test
npm run build
node scripts/e2e.mjs
```

The Playwright suite uses the installed macOS Chrome by default. Set `CHROME_PATH` on another platform and `BASE_URL` to test a deployed URL.

## Render

Static site settings:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- No environment variables required
