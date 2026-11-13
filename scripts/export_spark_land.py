#!/usr/bin/env python3
"""Extract selected land markets from the authoritative Spark alphapipe cache.

Run on spark-ce3d. This reads the large source DB read-only and writes a small
export DB containing only the selected city/state pairs. No provider/API calls.
"""
import argparse
import os
import sqlite3

MARKETS = (('cleveland', 'OH'), ('bastrop', 'TX'), ('lehigh acres', 'FL'))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default=os.path.expanduser('~/.tranchi/alphapipe.db'))
    parser.add_argument('--out', default=os.path.expanduser('~/.tranchi/land-preview-export-20261113.db'))
    args = parser.parse_args()
    con = sqlite3.connect(f'file:{args.source}?mode=ro', uri=True)
    out = sqlite3.connect(args.out)
    out.execute('CREATE TABLE IF NOT EXISTS properties(addr_hash TEXT PRIMARY KEY, street TEXT, city TEXT, state TEXT, zip TEXT, slices TEXT, quicklists_true TEXT, payload_json TEXT, first_seen TEXT, last_seen TEXT)')
    out.execute('DELETE FROM properties')
    out.execute('ATTACH DATABASE ? AS source', (args.source,))
    clauses = ' OR '.join(['(lower(city)=? AND state=?)'] * len(MARKETS))
    params = [value for market in MARKETS for value in market]
    out.execute(f"INSERT INTO properties SELECT * FROM source.properties WHERE quicklists_true LIKE '%vacantLot%' AND ({clauses})", params)
    out.commit()
    print('source_total', con.execute('select count(*) from properties').fetchone()[0])
    print('source_vacant_lot', con.execute("select count(*) from properties where quicklists_true like '%vacantLot%'").fetchone()[0])
    print('exported', out.execute('select count(*) from properties').fetchone()[0])
    for row in out.execute('select city,state,count(*) n from properties group by city,state order by n desc'):
        print(row)
    print('path', args.out, 'bytes', os.path.getsize(args.out))
    out.close()
    con.close()


if __name__ == '__main__':
    main()
