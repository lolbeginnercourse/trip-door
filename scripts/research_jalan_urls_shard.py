#!/usr/bin/env python3
import argparse, csv, html, json, random, re, time, unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, unquote
from urllib.request import Request, urlopen

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'
YAD_RE=re.compile(r'https?://(?:www\.)?jalan\.net/yad(\d+)/?', re.I)
TIMEOUT=15


def norm(s):
    s=unicodedata.normalize('NFKC',s or '').lower()
    s=re.sub(r'【[^】]*】|\[[^\]]*\]','',s)
    return re.sub(r'[^0-9a-zぁ-んァ-ヶ一-龠ー]','',s)


def get(url,retries=1):
    for i in range(retries+1):
        try:
            req=Request(url,headers={'User-Agent':UA,'Accept-Language':'ja,en;q=0.7'})
            with urlopen(req,timeout=TIMEOUT) as r:
                raw=r.read(); cs=r.headers.get_content_charset() or 'utf-8'
                try: text=raw.decode(cs,errors='replace')
                except LookupError: text=raw.decode('utf-8',errors='replace')
                return text,r.geturl()
        except (HTTPError,URLError,TimeoutError):
            if i==retries:return '',url
            time.sleep(.8*(i+1))
    return '',url


def expanded(text):
    vals=[text]; cur=text
    for _ in range(3):
        nxt=html.unescape(unquote(cur))
        if nxt==cur:break
        vals.append(nxt);cur=nxt
    return '\n'.join(vals)


def candidates(text):
    out=[]
    for m in YAD_RE.finditer(expanded(text)):
        u=f'https://www.jalan.net/yad{m.group(1)}/'
        if u not in out:out.append(u)
    return out


def title_of(body):
    pats=[r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']',r'<title[^>]*>(.*?)</title>']
    for p in pats:
        m=re.search(p,body,re.I|re.S)
        if m:return re.sub(r'<[^>]+>','',html.unescape(m.group(1))).strip()
    return ''


def score(hotel,title,body):
    h=norm(hotel);t=norm(title)
    if not h or not t:return 0
    if h in t:return 1
    if t in h and len(t)>=max(5,int(len(h)*.65)):return .96
    s=SequenceMatcher(None,h,t).ratio()
    b=norm(re.sub(r'<[^>]+>',' ',body[:100000]))
    if h in b:s=max(s,.92)
    return s


def search(hotel):
    queries=[f'site:jalan.net/yad "{hotel}"',f'じゃらん {hotel}',f'site:www.jalan.net/yad {hotel}']
    found=[]
    for q in queries:
        for base in ['https://search.yahoo.co.jp/search?p=','https://www.bing.com/search?q=','https://html.duckduckgo.com/html/?q=']:
            body,_=get(base+quote_plus(q),1)
            for u in candidates(body):
                if u not in found:found.append(u)
            if found:break
        if found:break
        time.sleep(random.uniform(.2,.5))
    scored=[]
    for u in found[:7]:
        body,final=get(u,1)
        if not body:continue
        ti=title_of(body); sc=score(hotel,ti,body)
        can=candidates(final+'\n'+body[:40000])
        scored.append((sc,can[0] if can else u,ti))
    scored.sort(reverse=True,key=lambda x:x[0])
    if scored:
        best=scored[0]; second=scored[1][0] if len(scored)>1 else 0
        if best[0]>=.90 and (best[0]>=.97 or best[0]-second>=.06):
            return {'hotel_name':hotel,'jalan_url':best[1],'status':'verified_search','score':round(best[0],3),'matched_title':best[2]}
    return {'hotel_name':hotel,'jalan_url':'','status':'unresolved','score':round(scored[0][0],3) if scored else 0,'matched_title':scored[0][2] if scored else ''}


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--shard',type=int,required=True);ap.add_argument('--shards',type=int,default=10);a=ap.parse_args()
    rows=list(csv.DictReader(open('exports/booking_urls_750.csv',encoding='utf-8-sig')))
    hotels=[];existing={}
    for r in rows:
        h=r['hotel_name'].strip()
        if h not in hotels:hotels.append(h)
        if r.get('jalan_url','').strip():existing[h]={'hotel_name':h,'jalan_url':r['jalan_url'].strip(),'status':'existing_yad_no','score':1.0,'matched_title':''}
    assigned=[h for i,h in enumerate(hotels) if i%a.shards==a.shard and h not in existing]
    print(f'shard {a.shard}/{a.shards}: {len(assigned)} hotels',flush=True)
    out={}
    for i,h in enumerate(assigned,1):
        try:r=search(h)
        except Exception as e:r={'hotel_name':h,'jalan_url':'','status':'error','score':0,'matched_title':str(e)[:200]}
        out[h]=r
        print(f'[{i}/{len(assigned)}] {h}: {r["jalan_url"] or "UNRESOLVED"}',flush=True)
        time.sleep(random.uniform(.25,.65))
    p=Path('exports/jalan_shards');p.mkdir(parents=True,exist_ok=True)
    (p/f'shard_{a.shard}.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':main()
