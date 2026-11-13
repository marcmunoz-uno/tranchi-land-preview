#!/usr/bin/env python3
import copy
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from export_land_preview import (
    export_records,
    first_number,
    number_text,
    valid_coordinates,
    validate_record,
)


DATASET = json.loads((Path(__file__).parents[1] / 'data/cleveland-land.json').read_text())
BASE = next(record for record in DATASET['records'] if record['validation']['status'] == 'verified_vacant')


def record_with(**changes):
    return copy.deepcopy({**BASE, **changes})


class ExportValidationTests(unittest.TestCase):
    def test_explicit_non_vacant_labels_are_not_verified(self):
        for label in ('Non-Vacant Land', 'Non Vacant Land', 'Not Vacant Land', 'Occupied Land'):
            result = validate_record(record_with(propertyTypeDetail=label))
            self.assertEqual(result['status'], 'improved', label)
            self.assertLess(result['score'], 50)

    def test_missing_coordinates_are_unclear(self):
        record = record_with()
        record['address']['lat'] = None
        record['address']['lng'] = None
        self.assertEqual(validate_record(record)['status'], 'unclear')

    def test_boolean_coordinates_are_invalid(self):
        record = record_with()
        record['address']['lat'] = True
        record['address']['lng'] = False
        self.assertFalse(valid_coordinates(record))

    def test_invalid_first_alias_falls_through_to_valid_alias(self):
        value = first_number(
            {'livingArea': 'not-a-number', 'livingAreaSquareFeet': 1234},
            ('livingArea', 'livingAreaSquareFeet'),
        )
        self.assertEqual(value, 1234)

    def test_number_text_matches_javascript_for_large_integer(self):
        self.assertEqual(number_text(1000000.0), '1000000')

    def test_export_retains_missing_coordinate_record_as_unclear(self):
        payload = {
            'ids': {'apn': 'MISSING-COORDS'},
            'address': {
                'street': 'No Coordinates', 'city': 'Cleveland', 'state': 'OH',
                'zip': '44105', 'latitude': None, 'longitude': None,
            },
            'general': {'propertyTypeDetail': 'Vacant Land'},
            'lot': {'lotSizeAcres': 0.2},
            'quickLists': {'vacantLot': True, 'vacant': True},
        }
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / 'test.db'
            con = sqlite3.connect(db_path)
            con.execute('CREATE TABLE properties (addr_hash TEXT PRIMARY KEY, street TEXT, city TEXT, state TEXT, zip TEXT, slices TEXT, quicklists_true TEXT, payload_json TEXT, first_seen TEXT, last_seen TEXT)')
            con.execute('INSERT INTO properties VALUES (?,?,?,?,?,?,?,?,?,?)', (
                'missing-coords', 'No Coordinates', 'Cleveland', 'OH', '44105',
                '[]', '["vacantLot"]', json.dumps(payload), '2026-01-01', '2026-01-01',
            ))
            con.commit()
            con.close()
            records = export_records(str(db_path))
        self.assertEqual(len(records), 1)
        self.assertIsNone(records[0]['address']['lat'])
        self.assertIsNone(records[0]['address']['lng'])
        self.assertEqual(records[0]['validation']['status'], 'unclear')


if __name__ == '__main__':
    unittest.main()
