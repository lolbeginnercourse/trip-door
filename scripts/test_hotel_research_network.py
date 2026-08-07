#!/usr/bin/env python3
import json, urllib.parse, urllib.request
from pathlib import Path

OUT=Path('research/generated/network_probe.json')
OUT.parent.mkdir(parents=True,exist_ok=True)
q='スーパーホテル品川 新馬場 最寄り駅 徒歩 公式'
urls={
 'duckduckgo':'https://html.duckduckgo.com/html/?q='+urllib.parse.quote(q),
 'google':'https://www.google.com/search?q='+urllib.parse.quote(q),
 'yahoo_jp':'https://search.yahoo.co.jp/search?p='+urllib.parse.quote(q),
 'nominatim':'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+urllib.parse.quote('スーパーホテル品川・新馬場 東京'),
}
res={}
for name,url in urls.items():
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; trip-door-hotel-research/1.0)'})
  with urllib.request.urlopen(req,timeout=20) as r:
   b=r.read(300000)
   text=b.decode('utf-8','ignore')
   res[name]={'status':r.status,'length':len(b),'prefix':text[:500]}
 except Exception as e:
  res[name]={'error':repr(e)}
OUT.write_text(json.dumps(res,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:{kk:vv for kk,vv in v.items() if kk!='prefix'} for k,v in res.items()},ensure_ascii=False))
