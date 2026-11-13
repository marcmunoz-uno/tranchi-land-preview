# Spark cache extraction

The multi-market preview is populated entirely from the authoritative Spark alphapipe cache. No paid provider calls are made by the extraction.

Evidence from the read-only source query on 2026-11-13 UTC:

- 1,100,191 total cached properties.
- 69,245 records carrying the `vacantLot` candidate flag.
- Selected for this preview:
  - Cleveland, OH: 361
  - Bastrop, TX: 135
  - Lehigh Acres, FL: 60
- Total selected: 556

The first city-only query also found same-named cities in other states. The extractor therefore filters exact `(city, state)` pairs, not city names alone.

## Reproduce

```bash
scp scripts/export_spark_land.py dgx-spark:/tmp/export_spark_land.py
ssh dgx-spark 'python3 /tmp/export_spark_land.py'
scp dgx-spark:~/.tranchi/land-preview-export-20261113.db data/land-markets.db
python3 scripts/export_land_preview.py \
  --db data/land-markets.db \
  --out data/cleveland-land.json \
  --coverage data/coverage.json
```

`data/*.db` is gitignored because raw provider payloads include owner information. The public JSON exporter removes owner names, mailing addresses, phone numbers, and email addresses before anything is committed or deployed.

The cached `vacantLot` flag is a candidate seed, not proof of vacancy. The validation layer must classify each record before the UI treats it as a land lead.
