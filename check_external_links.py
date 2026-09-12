#!/usr/bin/env python3
"""Optional network check for source/affiliate URLs. Run where outbound HTTP is allowed."""
import json, urllib.request, urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parent
records=json.loads((ROOT/'data'/'hotels.json').read_text(encoding='utf-8'))
items=[]
for r in records:
    for s in r.get('sources',[]):
        if s.get('url'): items.append((r['hotel'],'source',s['url']))
    for provider,url in (r.get('bookingLinks') or {}).items():
        if url: items.append((r['hotel'],provider,url))
failed=[]
for hotel,kind,url in items:
    req=urllib.request.Request(url,method='HEAD',headers={'User-Agent':'Mozilla/5.0 OshiyadoLinkCheck/1.0'})
    try:
        with urllib.request.urlopen(req,timeout=12) as res: code=res.status
    except urllib.error.HTTPError as e:
        # Some sites reject HEAD; retry GET without downloading the full body.
        if e.code in (403,405):
            try:
                req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 OshiyadoLinkCheck/1.0','Range':'bytes=0-0'})
                with urllib.request.urlopen(req,timeout=12) as res: code=res.status
            except Exception as e2: failed.append((hotel,kind,url,str(e2))); continue
        else: failed.append((hotel,kind,url,f'HTTP {e.code}')); continue
    except Exception as e: failed.append((hotel,kind,url,str(e))); continue
    print('OK',code,hotel,kind,url)
for x in failed: print('NG',*x)
raise SystemExit(1 if failed else 0)
