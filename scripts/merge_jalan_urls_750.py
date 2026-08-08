#!/usr/bin/env python3
import csv,json,re
from pathlib import Path
rows=list(csv.DictReader(open('exports/booking_urls_750.csv',encoding='utf-8-sig')))
if len(rows)!=750: raise SystemExit(f'expected 750 rows, got {len(rows)}')
results={}
for r in rows:
    h=r['hotel_name'].strip()
    if r.get('jalan_url','').strip():
        results[h]={'hotel_name':h,'jalan_url':r['jalan_url'].strip(),'status':'existing_yad_no','score':1.0,'matched_title':''}
for p in sorted(Path('exports/jalan_shards').glob('shard_*.json')):
    results.update(json.loads(p.read_text(encoding='utf-8')))
unique=[]
for r in rows:
    h=r['hotel_name'].strip()
    if h not in unique: unique.append(h)
for h in unique:
    results.setdefault(h,{'hotel_name':h,'jalan_url':'','status':'unresolved','score':0,'matched_title':''})
fields=['no','id','hotel_name','venue_name','venue_id','venue_number','rank','jalan_yad_no','jalan_url','jalan_url_source','jalan_match_score','jalan_matched_title']
out=[]
for r in rows:
    m=results[r['hotel_name'].strip()];u=m.get('jalan_url','');ym=re.search(r'/yad(\d+)/',u)
    out.append({'no':r['no'],'id':r['id'],'hotel_name':r['hotel_name'],'venue_name':r['venue_name'],'venue_id':r['venue_id'],'venue_number':r['venue_number'],'rank':r['rank'],'jalan_yad_no':ym.group(1) if ym else r.get('jalan_yad_no',''),'jalan_url':u,'jalan_url_source':m.get('status',''),'jalan_match_score':m.get('score',''),'jalan_matched_title':m.get('matched_title','')})
with open('exports/jalan_urls_750_researched.csv','w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(out)
Path('exports/jalan_hotel_url_map.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
missing=[results[h] for h in unique if not results[h].get('jalan_url')]
with open('exports/jalan_urls_unresolved.csv','w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['hotel_name','status','score','matched_title']);w.writeheader();
    for m in missing:w.writerow({k:m.get(k,'') for k in ['hotel_name','status','score','matched_title']})
summary={'rows':750,'unique_hotels':len(unique),'rows_with_jalan_url':sum(bool(r['jalan_url']) for r in out),'rows_missing_jalan_url':sum(not bool(r['jalan_url']) for r in out),'unique_hotels_with_jalan_url':sum(bool(results[h].get('jalan_url')) for h in unique),'unique_hotels_missing_jalan_url':len(missing),'mode':'10_parallel_shards_search_engines_plus_jalan_page_title_verification'}
Path('exports/jalan_urls_750_research_summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
