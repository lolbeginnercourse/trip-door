#!/usr/bin/env python3
import json, re, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path

RESULT=Path('research/generated/hotel_detail_research_750.jsonl')
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

def norm(s):
    return re.sub(r'[\s・･\-‐‑–—―_()（）「」『』【】\[\]／/]+','',str(s or '')).lower()

def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept-Language':'ja-JP,ja;q=0.9,en;q=0.6'})
    with urllib.request.urlopen(req,timeout=20) as r:
        return r.read(1000000).decode('utf-8','ignore')

def parse_route(raw):
    # Yahoo embeds route summaries in serialized JSON. Accept both escaped and normal quotes.
    clean=raw.replace('\\"','"').replace('\\u0026','&')
    patterns=[
        r'"summaryInfo"\s*:\s*\{.*?"totalTime"\s*:\s*"(\d+)分".*?"transferCount"\s*:\s*"?(\d+)"?',
        r'ルート\s*1.{0,700}?(\d+)分.{0,350}?乗換\s*[:：]\s*(\d+)\s*回',
        r'(\d+)分\s+\d+\s*円\s+乗換\s*[:：]\s*(\d+)\s*回',
    ]
    # Strip tags for the human-readable fallbacks, but keep serialized content too.
    plain=re.sub(r'(?is)<script.*?</script>|<style.*?</style>',' ',clean)
    plain=re.sub(r'(?s)<[^>]+>',' ',plain)
    plain=re.sub(r'\s+',' ',plain)
    for i,pat in enumerate(patterns):
        src=clean if i==0 else plain
        m=re.search(pat,src,re.S)
        if m:
            return int(m.group(1)),int(m.group(2))
    return None,None

def route(fr,to):
    if not fr or not to: return None,None,None,'missing_station'
    if norm(str(fr).removesuffix('駅'))==norm(str(to).removesuffix('駅')):
        return 0,0,None,None
    params={'from':str(fr).removesuffix('駅'),'to':str(to).removesuffix('駅'),'type':'1','ticket':'ic','hh':'12','m1':'0','m2':'0'}
    url='https://transit.yahoo.co.jp/search/result?'+urllib.parse.urlencode(params)
    try:
        raw=get(url)
        tm,tr=parse_route(raw)
        return tm,tr,url,None if tm is not None else 'parse_failed'
    except Exception as e:
        return None,None,url,repr(e)

def main():
    if not RESULT.exists():
        print('No results file'); return
    rows=[]
    for line in RESULT.read_text(encoding='utf-8').splitlines():
        if line.strip(): rows.append(json.loads(line))
    repaired=0
    for i,r in enumerate(rows,1):
        fr=r.get('hotel_nearest_station'); to=r.get('venue_nearest_station')
        needs=(r.get('station_to_station_min') is None and fr and to) or any(str(w).startswith('transit_') for w in r.get('warnings',[]))
        if not needs: continue
        tm,tr,url,err=route(fr,to)
        if tm is None:
            print(f'[{r.get("research_no")}] still failed {fr}->{to}: {err}',flush=True)
            time.sleep(0.12); continue
        r['station_to_station_min']=tm; r['transfer_count']=tr; r['transit_source_url']=url
        r['warnings']=[w for w in r.get('warnings',[]) if not str(w).startswith('transit_')]
        hw=r.get('hotel_to_station_walk_min'); vw=r.get('venue_station_to_venue_walk_min')
        if all(isinstance(x,int) for x in (hw,tm,vw)):
            r['total_access_min']=hw+tm+vw
        parts=[]
        if isinstance(r.get('total_access_min'),int): parts.append(f'{r.get("venue_name")}まで約{r["total_access_min"]}分')
        if fr and isinstance(hw,int): parts.append(f'{str(fr).removesuffix("駅")}駅まで徒歩{hw}分')
        if tr is not None: parts.append(f'乗換{tr}回')
        r['access_display']=' / '.join(parts) if parts else r.get('access_display')
        warnings=r.get('warnings',[])
        r['verification_status']='verified' if not warnings else ('partial' if r.get('total_access_min') is not None else 'needs_review')
        repaired+=1
        print(f'[{r.get("research_no")}] repaired {fr}->{to}: {tm} min, {tr} transfer(s)',flush=True)
        time.sleep(0.12)
    RESULT.write_text(''.join(json.dumps(r,ensure_ascii=False,separators=(',',':'))+'\n' for r in sorted(rows,key=lambda x:x.get('research_no',999999))),encoding='utf-8')
    print(f'repaired={repaired}, rows={len(rows)}')
if __name__=='__main__': main()
