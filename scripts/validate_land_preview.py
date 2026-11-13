#!/usr/bin/env python3
"""Validate generated land data, coverage, and share-safe field boundaries."""
import argparse
import json
import sys

from export_land_preview import (
    build_coverage,
    find_forbidden_fields,
    validate_record,
    validation_summary,
)


def validate_dataset(dataset):
    errors = []
    records = dataset.get('records')
    if not isinstance(records, list):
        return ['records must be an array']
    if dataset.get('recordCount') != len(records):
        errors.append(f"recordCount is {dataset.get('recordCount')!r}, expected {len(records)}")

    seen_ids = set()
    for index, record in enumerate(records):
        record_id = record.get('id') if isinstance(record, dict) else None
        label = record_id or f'records[{index}]'
        if not isinstance(record, dict):
            errors.append(f'{label}: record must be an object')
            continue
        if not record_id:
            errors.append(f'{label}: missing id')
        elif record_id in seen_ids:
            errors.append(f'{label}: duplicate id')
        seen_ids.add(record_id)
        expected = validate_record(record)
        if record.get('validation') != expected:
            errors.append(
                f"{label}: validation mismatch; expected {json.dumps(expected, sort_keys=True)}, "
                f"found {json.dumps(record.get('validation'), sort_keys=True)}"
            )
    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='data/cleveland-land.json')
    parser.add_argument('--coverage', default='data/coverage.json')
    args = parser.parse_args()
    with open(args.dataset, encoding='utf-8') as handle:
        dataset = json.load(handle)
    with open(args.coverage, encoding='utf-8') as handle:
        coverage = json.load(handle)

    errors = validate_dataset(dataset)
    records = dataset.get('records') if isinstance(dataset.get('records'), list) else []
    if coverage != build_coverage(records):
        errors.append('coverage.json does not match the exported records')

    forbidden = find_forbidden_fields(dataset) + find_forbidden_fields(coverage)
    if forbidden:
        errors.append(f"forbidden contact fields: {', '.join(forbidden)}")

    summary = validation_summary(records) if records and not errors else None
    result = {
        'records': len(records),
        'validation': summary,
        'forbiddenFields': forbidden,
        'errors': errors,
    }
    print(json.dumps(result, indent=2))
    if errors:
        sys.exit(1)


if __name__ == '__main__':
    main()
