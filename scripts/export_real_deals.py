#!/usr/bin/env python3
"""Export a share-safe sample of real Tranchi production deals.

Read-only against production TiDB through the existing freshness_worker.db()
credential path. Owner identity/contact blocks and internal/free-form notes
are never selected. Only the allowlisted deal/price fields below are exported.
"""
import argparse
import collections
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path.home() / 'Developer' / 'tranchi-property-pipeline'))
from freshness_worker import db  # noqa: E402

TARGET = "((city='Cleveland' AND state='OH') OR (city='Bastrop' AND state='TX') OR (city='Lehigh Acres' AND state='FL'))"
FIELDS = (
    'id,address,city,state,zipCode,price,priceSource,priceConfidence,monthlyRent,'
    'dscrRatio,cashFlow,daysOnMarket,propertyType,bedrooms,bathrooms,squareFeet,'
    'market,zillowUrl,imageUrls,score,dealCategory,qcStatus,leadStatus,listingDate,'
    'sourceCreatedAt,geocodeLat,geocodeLng,lastSalePrice,lastSaleDate,marketValue,'
    'saleDate,openingBid,auctionStatus,appraisedValue,filingDate,taxBalance,'
    'delinquentFlag,sourceUrl,absenteeOwner,createdAt'
)
QUERIES = {
    'land_bank': f"SELECT {FIELDS} FROM on_market_properties WHERE isActive=1 AND dealCategory='land_bank' AND {TARGET} AND sourceUrl IS NOT NULL ORDER BY createdAt DESC LIMIT 6",
    'tax_lien': f"SELECT {FIELDS} FROM on_market_properties WHERE isActive=1 AND dealCategory IN ('foreclosure_auction','tax_lien','probate') AND {TARGET} AND (openingBid IS NOT NULL OR taxBalance IS NOT NULL OR marketValue IS NOT NULL) AND sourceUrl IS NOT NULL ORDER BY createdAt DESC LIMIT 8",
    'motivated_seller': f"SELECT {FIELDS} FROM on_market_properties WHERE isActive=1 AND dealCategory='motivated_seller' AND {TARGET} AND marketValue IS NOT NULL ORDER BY score DESC,createdAt DESC LIMIT 4",
}
PRICE_LABELS = {
    'opening_bid': 'Opening bid',
    'tax_assessed': 'Tax-assessed reference',
}
CATEGORY_LABELS = {
    'on_market': 'On-market listing',
    'land_bank': 'Land bank',
    'tax_lien': 'Tax / distress',
    'foreclosure_auction': 'Foreclosure auction',
    'probate': 'Probate',
    'motivated_seller': 'Off-market lead',
}
EXTRA_QUERIES = [
    ('on_market', f"SELECT {FIELDS} FROM on_market_properties WHERE isActive=1 AND dealCategory='on_market' AND city='Bastrop' AND state='TX' AND imageUrls IS NOT NULL ORDER BY cashFlow DESC LIMIT 2"),
]


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def date(value):
    return str(value)[:10] if value else None


def public_url(value):
    if not value or not str(value).startswith(('https://', 'http://')):
        return None
    if 'myplace.cuyahogacounty.us' in value or 'dln.com' in value or 'county-treasurer-vs-' in value:
        return None
    return value


def normalize(row, group):
    raw_images = row.get('imageUrls')
    if isinstance(raw_images, str):
        try:
            images = json.loads(raw_images)
        except json.JSONDecodeError:
            images = []
    else:
        images = raw_images or []
    images = [url for url in images if isinstance(url, str) and url.startswith('https://')][:2]
    price_source = row.get('priceSource')
    category = row['dealCategory']
    source_url = public_url(row.get('sourceUrl')) or public_url(row.get('zillowUrl'))
    return {
        'id': row['id'],
        'tranchiUrl': f"https://tranchi.ai/properties/on-market?highlight={row['id']}",
        'sourceUrl': source_url,
        'address': {
            'street': row['address'], 'city': row['city'], 'state': row['state'],
            'zip': row['zipCode'], 'lat': number(row.get('geocodeLat')),
            'lng': number(row.get('geocodeLng')),
        },
        'category': category,
        'categoryGroup': group,
        'categoryLabel': CATEGORY_LABELS.get(category, 'Deal'),
        'leadStatus': row.get('leadStatus'),
        'qcStatus': row.get('qcStatus'),
        'price': number(row.get('price')),
        'priceSource': price_source,
        'priceLabel': PRICE_LABELS.get(price_source, PRICE_LABELS.get(group, 'Reference price')),
        'priceConfidence': number(row.get('priceConfidence')),
        'monthlyRent': number(row.get('monthlyRent')),
        'dscrRatio': number(row.get('dscrRatio')),
        'cashFlow': number(row.get('cashFlow')),
        'daysOnMarket': row.get('daysOnMarket'),
        'propertyType': row.get('propertyType'),
        'bedrooms': row.get('bedrooms'),
        'bathrooms': number(row.get('bathrooms')),
        'squareFeet': row.get('squareFeet'),
        'market': row.get('market'),
        'score': number(row.get('score')),
        'marketValue': number(row.get('marketValue')),
        'lastSalePrice': number(row.get('lastSalePrice')),
        'lastSaleDate': date(row.get('lastSaleDate')),
        'saleDate': date(row.get('saleDate')),
        'openingBid': number(row.get('openingBid')),
        'auctionStatus': row.get('auctionStatus'),
        'appraisedValue': number(row.get('appraisedValue')),
        'filingDate': date(row.get('filingDate')),
        'taxBalance': number(row.get('taxBalance')),
        'delinquent': bool(row.get('delinquentFlag')),
        'absenteeOwner': bool(row.get('absenteeOwner')),
        'images': images,
        'listingDate': date(row.get('listingDate')),
        'sourceCreatedAt': date(row.get('sourceCreatedAt')),
        'createdAt': date(row.get('createdAt')),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default='data/tranchi-deals.json')
    args = parser.parse_args()
    records = []
    con = db()
    try:
        cur = con.cursor()
        for group, query in QUERIES.items():
            cur.execute(query)
            records.extend(normalize(row, group) for row in cur.fetchall())
        cur.execute('SELECT COUNT(*) FROM on_market_properties WHERE isActive=1')
        active_count = next(iter(cur.fetchone().values()))
    finally:
        con.close()
    records.sort(key=lambda record: (record['categoryGroup'], record['id']))
    output = {
        'dataset': 'Tranchi production real-deal preview',
        'source': 'Read-only export from Tranchi production on_market_properties',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'recordCount': len(records),
        'activeDealCount': active_count,
        'categoryCounts': dict(collections.Counter(record['categoryGroup'] for record in records)),
        'privacy': 'No owner identity/contact fields, internal notes, or free-form distress metadata; only documented deal/price fields are exported.',
        'records': records,
    }
    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(output, indent=2) + '\n')
    print(json.dumps({'records': len(records), 'categories': output['categoryCounts'], 'out': str(path)}, indent=2))


if __name__ == '__main__':
    main()
