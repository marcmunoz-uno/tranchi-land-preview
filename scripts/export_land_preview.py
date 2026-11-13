#!/usr/bin/env python3
"""Export share-safe land candidates with per-parcel vacancy validation.

No network calls. Owner names, mailing addresses, phones, and emails are never
exported. The vacantLot list seed is evidence to validate, not proof of vacancy.
"""
import argparse
import collections
import json
import math
import os
import sqlite3
from datetime import datetime, timezone

VALIDATION_STATUSES = ('verified_vacant', 'probable_vacant', 'improved', 'unclear')
AMBIGUOUS_TYPES = {'', 'general', 'unknown', 'unspecified', 'other', 'n/a', 'null'}
LAND_COMPATIBLE_TYPES = {'recreational', 'range land', 'agricultural', 'farm', 'ranch', 'forest', 'undeveloped land', 'unimproved land'}
IMPROVED_TYPE_TOKENS = ('apartment', 'office', 'mixed use', 'parking garage', 'church', 'worship', 'government')
COVERAGE_FIELDS = (
    'apn', 'propertyTypeDetail', 'lot.acres', 'lot.squareFeet',
    'lot.frontageFeet', 'lot.depthFeet', 'lot.zoning', 'lot.topography',
    'building.livingArea', 'building.buildingArea', 'building.yearBuilt',
    'building.units', 'sale.price', 'sale.date',
)


def number(value):
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) else None
    except (TypeError, ValueError):
        return None


def first_number(source, keys):
    for key in keys:
        if key in source and source[key] is not None:
            return number(source[key])
    return None


def present(value):
    return isinstance(value, str) and bool(value.strip())


def positive(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def acres(payload):
    value = number((payload.get('lot') or {}).get('lotSizeAcres'))
    return value if value is not None and value > 0 else None


def iso(value):
    return str(value)[:10] if value else None


def valid_coordinates(record):
    lat = record['address'].get('lat')
    lng = record['address'].get('lng')
    return (
        isinstance(lat, (int, float)) and math.isfinite(lat) and abs(lat) <= 90
        and isinstance(lng, (int, float)) and math.isfinite(lng) and abs(lng) <= 180
    )


def field_completeness(record):
    lot = record['lot']
    checks = (
        present(record.get('apn')),
        present(record.get('propertyTypeDetail')),
        present(record.get('landUseCode')),
        positive(lot.get('acres')),
        positive(lot.get('squareFeet')),
        valid_coordinates(record),
        present(record['address'].get('geoStatus')),
        present(lot.get('zoning')),
        positive(lot.get('frontageFeet')),
        positive(lot.get('depthFeet')),
    )
    return round(sum(checks) / len(checks) * 100)


def building_improvements(record):
    building = record.get('building') or {}
    improvements = []
    fields = (
        ('livingArea', 'living area'), ('buildingArea', 'building area'),
        ('units', 'unit count'), ('stories', 'story count'),
        ('bedrooms', 'bedroom count'), ('bathrooms', 'bathroom count'),
        ('totalRooms', 'room count'),
    )
    for field, label in fields:
        value = building.get(field)
        if positive(value):
            improvements.append(f'Building {label} is present ({value:g}).')
    return improvements


def assessment_improvement(record):
    land = record['assessment'].get('landMarketValue')
    total = record['assessment'].get('totalMarketValue')
    return positive(land) and positive(total) and total > land * 1.25 + 5000


def acreage_conflict(record):
    lot = record['lot']
    lot_acres = lot.get('acres')
    square_feet = lot.get('squareFeet')
    if not positive(lot_acres) or not positive(square_feet):
        return False
    return abs(square_feet - lot_acres * 43560) / (lot_acres * 43560) > 0.15


def validate_record(record):
    """Return vacancy confidence, human reasons, and core-field completeness."""
    property_type = (record.get('propertyTypeDetail') or '').strip()
    normalized_type = property_type.lower()
    vacant_type = 'vacant' in normalized_type
    land_compatible = vacant_type or normalized_type in LAND_COMPATIBLE_TYPES
    known_improved_type = any(token in normalized_type for token in IMPROVED_TYPE_TOKENS)
    ambiguous_type = normalized_type in AMBIGUOUS_TYPES
    flags = record.get('flags') or []
    has_candidate = 'vacantLot' in flags
    has_vacant_flag = 'vacant' in flags
    has_apn = present(record.get('apn'))
    has_acreage = positive(record['lot'].get('acres'))
    has_coordinates = valid_coordinates(record)
    improvements = building_improvements(record)
    has_assessment_improvement = assessment_improvement(record)
    has_acreage_conflict = acreage_conflict(record)

    score = 0
    if vacant_type:
        score += 45
    elif land_compatible:
        score += 25
    elif ambiguous_type:
        score += 5 if present(record.get('propertyTypeDetail')) else 0
    else:
        score -= 20
    score += 15 if has_candidate else -20
    if has_vacant_flag:
        score += 20
    if has_acreage:
        score += 5
    if has_coordinates:
        score += 5
    if has_apn:
        score += 5
    if present(record.get('landUseCode')):
        score += 2
    if present(record['lot'].get('zoning')):
        score += 1
    if present(record['address'].get('geoStatus')):
        score += 2
    if has_acreage_conflict:
        score -= 10

    reasons = []
    if known_improved_type or improvements or has_assessment_improvement:
        status = 'improved'
        if known_improved_type:
            reasons.append(f'Improved: property type is {property_type}.')
        reasons.extend(f'Improved: {reason}' for reason in improvements)
        if has_assessment_improvement:
            reasons.append('Improved: assessed total value exceeds land value by a material margin.')
        if has_candidate:
            reasons.append('The vacantLot candidate flag conflicts with the improvement evidence.')
        score = min(score, 19)
    else:
        missing = []
        if not has_apn:
            missing.append('APN')
        if not has_acreage:
            missing.append('positive lot acreage')
        if not has_coordinates:
            missing.append('valid coordinates')

        if ambiguous_type or not land_compatible or not has_candidate or missing:
            status = 'unclear'
            if ambiguous_type:
                type_description = f'"{property_type}"' if property_type else 'is missing'
                reasons.append(f'Unclear: property type {type_description} does not establish vacant land.')
            elif not land_compatible:
                reasons.append(f'Unclear: property type "{property_type}" is not recognized as land or a known improvement.')
            if not has_candidate:
                reasons.append('Unclear: vacantLot candidate flag is absent.')
            if missing:
                reasons.append(f"Missing required parcel evidence: {', '.join(missing)}.")
            score = min(score, 49)
        elif not vacant_type or not has_vacant_flag or has_acreage_conflict:
            status = 'probable_vacant'
            if not vacant_type:
                reasons.append(f'Probable vacant: {property_type} is a land-compatible use, not an explicit vacant-land label.')
            if not has_vacant_flag:
                reasons.append('Probable vacant: property type and candidate flag agree, but the independent vacant indicator is absent.')
            if has_acreage_conflict:
                reasons.append('Source conflict: lot acreage and square feet do not agree; confidence is capped.')
            score = min(score, 84)
        else:
            status = 'verified_vacant'
            reasons.append('Verified vacant: property type, vacant indicator, candidate flag, APN, acreage, and coordinates agree.')

    if not reasons:
        reasons.append('Unclear: available source evidence is insufficient.')
    return {
        'status': status,
        'score': max(0, min(100, round(score))),
        'reasons': reasons,
        'fieldCompleteness': field_completeness(record),
    }


def forbidden_key(key):
    normalized = ''.join(character for character in key.lower() if character.isalnum())
    return (
        normalized == 'owner'
        or 'ownername' in normalized
        or (normalized.startswith('owner') and 'name' in normalized)
        or 'fullname' in normalized
        or normalized.startswith('mailing')
        or 'phone' in normalized
        or 'telephone' in normalized
        or 'email' in normalized
    )


def find_forbidden_fields(value):
    """Return contact-field paths, without inspecting or exporting their values."""
    forbidden = []

    def scan(nested, path=''):
        if isinstance(nested, list):
            for index, item in enumerate(nested):
                scan(item, f'{path}[{index}]')
        elif isinstance(nested, dict):
            for key, child in nested.items():
                child_path = f'{path}.{key}' if path else key
                if forbidden_key(key):
                    forbidden.append(child_path)
                scan(child, child_path)

    scan(value)
    return forbidden


def distance_miles(a, b):
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 3958.7613 * 2 * math.asin(min(1, math.sqrt(h)))


def field_value(record, path):
    value = record
    for part in path.split('.'):
        value = (value or {}).get(part)
    return value


def validation_summary(records):
    status_counts = collections.Counter(record['validation']['status'] for record in records)
    count = len(records)
    return {
        'statusCounts': {status: status_counts[status] for status in VALIDATION_STATUSES},
        'averageScore': round(sum(r['validation']['score'] for r in records) / count, 1) if count else 0,
        'averageFieldCompleteness': round(sum(r['validation']['fieldCompleteness'] for r in records) / count, 1) if count else 0,
    }


def build_coverage(records):
    buckets = collections.Counter()
    field_counts = collections.Counter()
    for record in records:
        for path in COVERAGE_FIELDS:
            if field_value(record, path) is not None:
                field_counts[path] += 1
        if record['validation']['status'] in {'improved', 'unclear'}:
            buckets['not_land'] += 1
            continue
        if valid_coordinates(record):
            position = (record['address']['lat'], record['address']['lng'])
            subject_acres = record['lot']['acres']
            eligible = 0
            if positive(subject_acres):
                for candidate in records:
                    if candidate['validation']['status'] in {'improved', 'unclear'}:
                        continue
                    if candidate['id'] == record['id'] or not positive(candidate['lot']['acres']):
                        continue
                    if not positive(candidate['sale']['price']) or candidate['sale']['transactionTypeCode'] != 'B':
                        continue
                    if not valid_coordinates(candidate):
                        continue
                    distance = distance_miles(position, (candidate['address']['lat'], candidate['address']['lng']))
                    ratio = candidate['lot']['acres'] / subject_acres
                    if distance <= 25 and 0.25 <= ratio <= 4:
                        eligible += 1
            buckets['3+' if eligible >= 3 else '1-2' if eligible else '0'] += 1
    return {
        'recordCount': len(records),
        'fields': dict(field_counts),
        'validation': validation_summary(records),
        'compCandidatesWithin25MiAnd4xAcreage': dict(buckets),
        'notes': [
            'Counts describe only the selected cached markets in this export.',
            'No owner names, mailing addresses, phone numbers, or email addresses were exported.',
            'Coordinates are provider points/parcel centroids, not parcel-boundary polygons.',
            'vacantLot is a candidate seed; validation labels and scores classify vacancy confidence without excluding records.',
        ],
    }


def export_records(db_path):
    connection = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
    rows = connection.execute(
        "SELECT payload_json,last_seen FROM properties WHERE quicklists_true LIKE '%vacantLot%'"
    ).fetchall()
    records = []
    for raw, last_seen in rows:
        payload = json.loads(raw)
        address = payload.get('address') or {}
        ids = payload.get('ids') or {}
        lot = payload.get('lot') or {}
        building = payload.get('building') or {}
        sale = (payload.get('sale') or {}).get('lastSale') or {}
        quick_lists = payload.get('quickLists') or {}
        general = payload.get('general') or {}
        assessment = payload.get('assessment') or {}
        record = {
            'id': address.get('hash') or ids.get('apn') or f'cached-row-{len(records) + 1}',
            'apn': ids.get('apn'),
            'address': {
                'street': address.get('street') or address.get('streetNoUnit'),
                'city': address.get('city'), 'state': address.get('state'),
                'zip': address.get('zip'), 'county': address.get('county'),
                'countyFips': address.get('countyFipsCode'),
                'lat': number(address.get('latitude')), 'lng': number(address.get('longitude')),
                'geoStatus': address.get('geoStatus'),
            },
            'propertyTypeDetail': general.get('propertyTypeDetail'),
            'landUseCode': general.get('standardizedLandUseCode'),
            'lot': {
                'acres': acres(payload), 'squareFeet': number(lot.get('lotSizeSquareFeet')),
                'frontageFeet': number(lot.get('lotFrontageFeet')),
                'depthFeet': number(lot.get('lotDepthFeet')),
                'zoning': lot.get('zoningCode'), 'topography': lot.get('topography'),
            },
            'building': {
                'livingArea': first_number(building, ('livingArea', 'livingAreaSquareFeet', 'livingAreaSqFt')),
                'buildingArea': first_number(building, ('buildingArea', 'buildingAreaSquareFeet', 'buildingAreaSqFt', 'grossArea')),
                'yearBuilt': first_number(building, ('yearBuilt', 'effectiveYearBuilt')),
                'units': first_number(building, ('units', 'totalUnits', 'numberOfUnits')),
                'stories': first_number(building, ('stories', 'numberOfStories')),
                'bedrooms': first_number(building, ('bedrooms', 'bedroomCount')),
                'bathrooms': first_number(building, ('bathrooms', 'bathroomCount')),
                'totalRooms': first_number(building, ('totalRooms', 'roomCount')),
            },
            'assessment': {
                'landMarketValue': number(assessment.get('landMarketValue')),
                'totalMarketValue': number(assessment.get('totalMarketValue')),
                'assessedLandValue': number(assessment.get('assessedLandValue')),
            },
            'sale': {
                'price': number(sale.get('price')), 'date': iso(sale.get('saleDate')),
                'transactionType': sale.get('transactionType'),
                'transactionTypeCode': sale.get('transactionTypeCode'),
                'priceCodeDescription': sale.get('priceCodeDescription'),
            },
            'flags': sorted(key for key, value in quick_lists.items() if value is True),
            'ownerOccupied': (payload.get('owner') or {}).get('ownerOccupied'),
            'cachedAt': last_seen,
        }
        record['validation'] = validate_record(record)
        records.append(record)
    records.sort(key=lambda record: ((record['address'].get('street') or ''), record['id']))
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', default=os.path.expanduser('~/.tranchi/alphapipe.db'))
    parser.add_argument('--out', required=True)
    parser.add_argument('--coverage', required=True)
    args = parser.parse_args()
    records = export_records(args.db)
    market_counts = collections.Counter(
        f"{record['address'].get('city') or 'Unknown'}, {record['address'].get('state') or 'Unknown'}"
        for record in records
    )
    markets = [{'id': market, 'records': count} for market, count in sorted(market_counts.items())]
    output = {
        'dataset': 'Tranchi multi-market land preview',
        'source': 'Tranchi alphapipe cache; BatchData public-record payloads',
        'market': f"{len(markets)} cached markets",
        'markets': markets,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'recordCount': len(records),
        'records': records,
    }
    coverage = build_coverage(records)
    forbidden = find_forbidden_fields(output) + find_forbidden_fields(coverage)
    if forbidden:
        raise SystemExit(f"share-safe export failed: {', '.join(forbidden)}")

    for path, value, separator in ((args.out, output, (',', ':')), (args.coverage, coverage, None)):
        os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
        with open(path, 'w', encoding='utf-8') as handle:
            json.dump(value, handle, separators=separator, indent=None if separator else 2)
            handle.write('\n')
    print(json.dumps({
        'records': len(records),
        'forbiddenFields': forbidden,
        'validation': validation_summary(records),
        'coverage': args.coverage,
    }, indent=2))


if __name__ == '__main__':
    main()
