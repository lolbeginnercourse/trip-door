#!/usr/bin/env python3
import json
from pathlib import Path
from collections import Counter, defaultdict

SRC = Path('assets/data/hotels.json')
OUT = Path('research/generated')
OUT.mkdir(parents=True, exist_ok=True)

with SRC.open(encoding='utf-8') as f:
    data = json.load(f)

def is_record_list(v):
    return isinstance(v, list) and (not v or all(isinstance(x, dict) for x in v[:20]))

candidates=[]
if isinstance(data,list): candidates.append(('$root',data))
elif isinstance(data,dict):
    for k,v in data.items():
        if is_record_list(v): candidates.append((k,v))
if not candidates: raise SystemExit('No list-of-dict collection found in hotels.json')
collection_name,records=max(candidates,key=lambda kv:len(kv[1]))

key_counts=Counter(); type_counts={}
for r in records:
    for k,v in r.items():
        key_counts[k]+=1; type_counts.setdefault(k,Counter())[type(v).__name__]+=1
published=[r for r in records if r.get('isPublished',True)]
# Production target: top 3 ranked hotels for each of 250 venues = exactly 750 detail records.
target=[r for r in published if isinstance(r.get('rank'),int) and 1 <= r['rank'] <= 3 and r.get('venueId')]
target.sort(key=lambda r:(r.get('venueNumber',999999),r.get('rank',99),r.get('id','')))

summary={
 'source':str(SRC),'top_level_type':type(data).__name__,
 'candidate_collections':{k:len(v) for k,v in candidates},'selected_collection':collection_name,
 'record_count':len(records),'published_record_count':len(published),
 'unique_published_hotel_name_count':len({str(r.get('name','')).strip() for r in published if str(r.get('name','')).strip()}),
 'unique_venue_id_count':len({r.get('venueId') for r in published if r.get('venueId')}),
 'target_detail_record_count':len(target),
 'target_unique_hotel_name_count':len({r.get('name') for r in target if r.get('name')}),
 'target_unique_venue_count':len({r.get('venueId') for r in target if r.get('venueId')}),
 'keys':[{'key':k,'present':key_counts[k],'types':dict(type_counts[k])} for k in sorted(key_counts)],
 'sample_records':records[:3],
}
(OUT/'hotel_structure.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')

for filename,rows in [('hotel_records.jsonl',records),('target_750.jsonl',target)]:
    with (OUT/filename).open('w',encoding='utf-8') as f:
        for i,r in enumerate(rows,1):
            f.write(json.dumps({'_row':i,**r},ensure_ascii=False,separators=(',',':'))+'\n')

with (OUT/'hotel_key_inventory.jsonl').open('w',encoding='utf-8') as f:
    for i,r in enumerate(records,1):
        compact={'_row':i}
        for k,v in r.items():
            lk=k.lower()
            if any(t in lk for t in ('id','name','hotel','venue','hall','station','access','walk','minute','time','price','address','area','route','line','transfer','lat','lng','lon','source','url')):
                if isinstance(v,(str,int,float,bool)) or v is None: compact[k]=v
                elif isinstance(v,(list,dict)):
                    s=json.dumps(v,ensure_ascii=False,separators=(',',':'))
                    compact[k]=v if len(s)<=3000 else f'<nested:{len(s)} chars>'
        f.write(json.dumps(compact,ensure_ascii=False,separators=(',',':'))+'\n')

by_name=defaultdict(list)
for r in published:
    name=str(r.get('name','')).strip()
    if name: by_name[name].append(r)
with (OUT/'unique_hotels.jsonl').open('w',encoding='utf-8') as f:
    for i,name in enumerate(sorted(by_name),1):
        rs=by_name[name]
        def uniq(key):
            vals=[]
            for r in rs:
                v=r.get(key)
                if v not in (None,'') and v not in vals: vals.append(v)
            return vals
        row={'_hotel_no':i,'name':name,'record_count':len(rs),'ids':uniq('id'),'genres':uniq('genre'),'prefectures':uniq('prefecture'),'areas':uniq('area'),'stations':uniq('station'),'venueIds':uniq('venueId'),'venueLabels':uniq('venueLabel'),'accessEstimates':uniq('accessEstimate'),'priceEstimates':uniq('priceEstimate'),'priceRangeEstimates':uniq('priceRangeEstimate'),'hotelMapUrls':uniq('hotelMapUrl'),'rakutenHotelNos':uniq('rakutenHotelNo'),'jalanYadNos':uniq('jalanYadNo'),'researchedAts':uniq('researchedAt')}
        f.write(json.dumps(row,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(records)} total; target={len(target)} details; unique target hotels={summary["target_unique_hotel_name_count"]}; venues={summary["target_unique_venue_count"]}')
