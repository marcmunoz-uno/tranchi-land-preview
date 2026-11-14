# Tranchi Land · Multi-Market Interactive Preview

**Live preview:** https://tranchi-land-preview.onrender.com/

An original Tranchi-branded land-flipping product mockup built with real cached public-record data from the DGX Spark alphapipe cache. It is not affiliated with LandAtlas and uses no LandAtlas code, branding, or assets.

## What works

- 556 real records across Cleveland OH, Bastrop TX, and Lehigh Acres FL.
- A default view of 439 verified/probable vacant-land records; improved and unclear records remain available only by explicit choice.
- Per-record vacancy status, confidence, reasons, and field completeness.
- Street and satellite maps with synchronized parcel selection and normal mouse-wheel/touch zoom.
- Address-specific Google Street View in the right-hand parcel and real-deal inspectors, with an external Google Maps fallback and coverage warning.
- Market, address/APN/ZIP, acreage, zoning, topography, seller-signal, vacancy, and sale-history filters.
- Market-level record counts, field coverage, and freshness.
- Map-first and list-first layouts.
- Parcel facts and explainable seller signals without the residential vacantLot penalty.
- Recorded-sale land comps with explicit radius, recency, and acreage controls; improved and unclear parcels are excluded from comps.
- Comp-supported value and editable max-offer model; no estimate with fewer than three usable comps.
- Persistent shortlist, shortlist-only browsing, and side-by-side comparison of 2–5 parcels.
- Shareable filter, shortlist, and compare URLs with safe recovery from unsupported values.
- Client-side comp/offer PDF generation with selected evidence, assumptions, and an honest insufficient-comp state.
- Named saved searches on the current device.
- CSV export of filtered parcel data without owner contact columns.
- Accessible mobile drawers, inspector, dialogs, and controls, including Escape-to-close and named share actions.
- `noindex,nofollow` and static security headers.

## Real production deals

The **Real deals** workspace adds 18 read-only production records from `on_market_properties`:

- 6 Cuyahoga Land Bank records with PII-free public source links.
- 8 recent tax-lien/distress records with supplied opening-bid provenance.
- 4 off-market motivated-seller leads with tax-assessed reference values, not asking prices.

Unsupported on-market rows are excluded until verifiable price provenance and public sources exist. Current source-backed records are in Cleveland and Lehigh Acres. DLN case links are omitted because their URLs can contain party names.

Cards and the detail drawer include actual Tranchi IDs, property photos, production status, supplied price provenance, source-model rent/DSCR/cash flow where available, ingest dates, PII-free public source links, and direct `tranchi.ai/properties/on-market?highlight=<id>` links. No owner identity/contact fields, internal notes, or free-form distress metadata are exported.

Refresh the share-safe export read-only:

```bash
python3 scripts/export_real_deals.py --out data/tranchi-deals.json
node scripts/e2e-deals.mjs
```

## Honest limits

This is a static interactive preview, not a live subscription product. It has no backend, authentication, live feed, owner contacts, skip tracing, direct mail, e-sign, CRM writes, or outbound actions. Flood, wetlands, canal access, and parcel-boundary polygons are not in the cached dataset. Points are provider coordinates/parcel centroids, not boundaries. Public records can be wrong or stale; verify before making an offer.

The public JSON excludes owner names, mailing addresses, phone numbers, and email addresses. Raw cache databases are gitignored.

## Local development

```bash
npm ci
python3 scripts/export_land_preview.py --db data/land-markets.db --out data/cleveland-land.json --coverage data/coverage.json
npm run dev
```

Open http://localhost:3210.

## Multi-market data refresh

The 556-record extract uses the authoritative Spark cache, not a paid refresh. See `docs/SPARK-DATA.md` for evidence and reproduction.

```bash
scp scripts/export_spark_land.py dgx-spark:/tmp/export_spark_land.py
ssh dgx-spark 'python3 /tmp/export_spark_land.py'
scp dgx-spark:~/.tranchi/land-preview-export-20261113.db data/land-markets.db
python3 scripts/export_land_preview.py \
  --db data/land-markets.db \
  --out data/cleveland-land.json \
  --coverage data/coverage.json
```

## Verification

```bash
npm test
npm run build
node scripts/e2e.mjs
node scripts/e2e-workflows.mjs
node scripts/e2e-markets.mjs
```

The Playwright suites use installed macOS Chrome by default. Set `CHROME_PATH` on another platform and `BASE_URL` to test a deployed URL.

## Cache-only alphapipe endpoint

A separate `feat/land-search-api` branch adds `POST /alpha/land/search`, which serves cached vacant-land records only and never triggers BatchData on the request path. It reports missing evidence in `criteriaNotJudged` and returns a typed `cache_miss` instead of purchasing data.

PR: https://github.com/tranchi-labs/tranchi-alpha-pipeline/pull/1

## Render

Static site settings:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- No environment variables required
