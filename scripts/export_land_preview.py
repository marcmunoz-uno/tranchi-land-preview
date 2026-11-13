#!/usr/bin/env python3
"""Export share-safe vacant-land records from the local alphapipe cache.

No network calls. Excludes owner names, mailing addresses, phones, and emails.
"""
import argparse, collections, json, math, os, sqlite3
from datetime import datetime, timezone

def acres(p):
    try:
        v=float((p.get('lot') or {}).get('lotSizeAcres'))
        return v if math.isfinite(v) and v>0 else None
    except (TypeError,ValueError): return None

def number(v):
    try:
        n=float(v)
        return n if math.isfinite(n) else None
    except (TypeError,ValueError): return None

def iso(v):
    return str(v)[:10] if v else None

def distance_miles(a,b):
    lat1,lon1=math.radians(a[0]),math.radians(a[1]); lat2,lon2=math.radians(b[0]),math.radians(b[1])
    dlat=lat2-lat1; dlon=lon2-lon1
    h=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 3958.7613*2*math.asin(min(1,math.sqrt(h)))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--db',default=os.path.expanduser('~/.tranchi/alphapipe.db'))
    ap.add_argument('--out',required=True)
    ap.add_argument('--coverage',required=True)
    args=ap.parse_args()
    con=sqlite3.connect(f'file:{args.db}?mode=ro',uri=True)
    rows=con.execute("SELECT payload_json,last_seen FROM properties WHERE quicklists_true LIKE '%vacantLot%'").fetchall()
    records=[]
    for raw,last_seen in rows:
        p=json.loads(raw); a=p.get('address') or {}; lot=p.get('lot') or {}; sale=(p.get('sale') or {}).get('lastSale') or {}
        lat=number(a.get('latitude')); lng=number(a.get('longitude'))
        if lat is None or lng is None or not a.get('hash'): continue
        q=p.get('quickLists') or {}; general=p.get('general') or {}; assess=p.get('assessment') or {}
        records.append({
            'id':a['hash'],'apn':(p.get('ids') or {}).get('apn'),
            'address':{'street':a.get('street') or a.get('streetNoUnit'),'city':a.get('city'),'state':a.get('state'),'zip':a.get('zip'),'county':a.get('county'),'countyFips':a.get('countyFipsCode'),'lat':lat,'lng':lng,'geoStatus':a.get('geoStatus')},
            'propertyTypeDetail':general.get('propertyTypeDetail'),'landUseCode':general.get('standardizedLandUseCode'),
            'lot':{'acres':acres(p),'squareFeet':number(lot.get('lotSizeSquareFeet')),'frontageFeet':number(lot.get('lotFrontageFeet')),'depthFeet':number(lot.get('lotDepthFeet')),'zoning':lot.get('zoningCode'),'topography':lot.get('topography')},
            'assessment':{'landMarketValue':number(assess.get('landMarketValue')),'totalMarketValue':number(assess.get('totalMarketValue')),'assessedLandValue':number(assess.get('assessedLandValue'))},
            'sale':{'price':number(sale.get('price')),'date':iso(sale.get('saleDate')),'transactionType':sale.get('transactionType'),'transactionTypeCode':sale.get('transactionTypeCode'),'priceCodeDescription':sale.get('priceCodeDescription')},
            'flags':sorted([k for k,v in q.items() if v is True]),
            'ownerOccupied':(p.get('owner') or {}).get('ownerOccupied'),
            'cachedAt':last_seen,
        })
    records.sort(key=lambda r: ((r['address'].get('street') or ''),r['id']))
    out={'dataset':'Cleveland vacant land preview','source':'Tranchi alphapipe cache; BatchData public-record payloads','market':'Cleveland, OH','generatedAt':datetime.now(timezone.utc).isoformat(),'recordCount':len(records),'records':records}
    os.makedirs(os.path.dirname(args.out),exist_ok=True)
    with open(args.out,'w') as f: json.dump(out,f,separators=(',',':'))
    buckets=collections.Counter(); field_counts=collections.Counter()
    for r in records:
        for path in [('lot','acres'),('lot','frontageFeet'),('lot','depthFeet'),('lot','zoning'),('lot','topography'),('sale','price'),('sale','date')]:
            if r[path[0]].get(path[1]) is not None: field_counts['.'.join(path)]+=1
        pos=(r['address']['lat'],r['address']['lng']); subject_acres=r['lot']['acres']
        eligible=0
        if subject_acres:
            for c in records:
                if c['id']==r['id'] or not c['lot']['acres'] or not c['sale']['price'] or c['sale']['transactionTypeCode']!='B': continue
                d=distance_miles(pos,(c['address']['lat'],c['address']['lng']))
                ratio=c['lot']['acres']/subject_acres
                if d<=25 and .25<=ratio<=4: eligible+=1
        buckets['3+' if eligible>=3 else '1-2' if eligible else '0']+=1
    coverage={'recordCount':len(records),'fields':dict(field_counts),'compCandidatesWithin25MiAnd4xAcreage':dict(buckets),'notes':['Counts describe this local cached Cleveland dataset only.','No owner names, mailing addresses, phone numbers, or email addresses were exported.','Coordinates are provider points/parcel centroids, not parcel-boundary polygons.']}
    with open(args.coverage,'w') as f: json.dump(coverage,f,indent=2)
    forbidden=[]
    def scan(x,path=''):
        if isinstance(x,dict):
            for k,v in x.items():
                if k.lower() in {'phone','email','mailingaddress','ownername','fullname'}: forbidden.append(path+k)
                scan(v,path+k+'.')
        elif isinstance(x,list):
            for i,v in enumerate(x): scan(v,path+str(i)+'.')
    scan(out)
    print(json.dumps({'records':len(records),'forbiddenFields':forbidden,'coverage':coverage},indent=2))
    if forbidden: raise SystemExit('share-safe export failed')
if __name__=='__main__': main()
