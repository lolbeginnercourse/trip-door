#!/usr/bin/env python3
import csv, html, json, re, time, unicodedata, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path

SRC=Path('research/generated/jalan_links_750_final.csv')
OUT=Path('research/generated')
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151 Safari/537.36'

ALIASES={
    'inn':'イン','hotel':'ホテル','tokyo':'東京','shibuya':'渋谷','kyoto':'京都','osaka':'大阪',
    'wing':'ウィング','newwing':'ニューウイング','biwako':'びわ湖','lakebiwa':'びわ湖',
}

def norm(s):
    s=unicodedata.normalize('NFKC',str(s or '')).lower()
    s=s.replace('ｉｎｎ','inn')
    s=re.sub(r'\bby\s+ihg\b','',s,flags=re.I)
    s=re.sub(r'（旧[^）]*）|\(旧[^)]*\)','',s)
    s=re.sub(r'[\s\u3000・･\-‐‑–—―_()（）「」『』【】\[\]〈〉<>／/.,，。:：!！?？&＆+＋\'\"`]+','',s)
    return s

def canonical_parts(s):
    n=norm(s)
    # remove common marketing/service suffixes that Jalan appends to H1
    stop=['高濃度炭酸泉','天然温泉','大浴場','朝食','無料','駅前','bbhホテルグループ']
    return n

def decode_response(data, headers):
    ct=headers.get('content-type','') if headers else ''
    m=re.search(r'charset=([\w\-]+)',ct,re.I)
    candidates=[]
    if m: candidates.append(m.group(1))
    head=data[:5000].decode('ascii','ignore')
    m2=re.search(r'charset=["\']?([\w\-]+)',head,re.I)
    if m2: candidates.append(m2.group(1))
    candidates += ['utf-8','shift_jis','cp932','euc-jp']
    for enc in candidates:
        try: return data.decode(enc)
        except Exception: pass
    return data.decode('utf-8','ignore')

def fetch(url):
    last=None
    for i in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept-Language':'ja-JP,ja;q=0.9'})
            with urllib.request.urlopen(req,timeout=25) as r:
                data=r.read(1300000)
                raw=decode_response(data,r.headers)
                return raw,r.geturl(),getattr(r,'status',200),None
        except Exception as e:
            last=repr(e); time.sleep(0.8*(i+1))
    return '',url,None,last

def extract_h1(raw):
    m=re.search(r'(?is)<h1[^>]*>(.*?)</h1>',raw)
    if not m: return ''
    s=re.sub(r'(?s)<[^>]+>',' ',m.group(1))
    return ' '.join(html.unescape(s).split())

def extract_title(raw):
    m=re.search(r'(?is)<title[^>]*>(.*?)</title>',raw)
    if not m: return ''
    s=re.sub(r'(?s)<[^>]+>',' ',m.group(1))
    return ' '.join(html.unescape(s).split())

def textify(raw):
    s=re.sub(r'(?is)<script.*?</script>|<style.*?</style>',' ',raw)
    s=re.sub(r'(?s)<[^>]+>',' ',s)
    return ' '.join(html.unescape(s).split())

def sim(a,b):
    na,nb=norm(a),norm(b)
    if not na or not nb: return 0.0
    if na==nb: return 1.0
    if na in nb or nb in na: return 0.97
    return round(SequenceMatcher(None,na,nb).ratio(),4)

def classify(expected,live,pref,text,status,error):
    if error or not live:
        return 'fetch_failed'
    s=sim(expected,live)
    pref_ok=(not pref) or (pref in text)
    if s>=0.9 and pref_ok: return 'match'
    if s>=0.75 and pref_ok: return 'likely_match'
    if s>=0.55 and pref_ok: return 'review_name'
    return 'suspect'

def main():
    rows=list(csv.DictReader(SRC.open(encoding='utf-8-sig',newline='')))
    assert len(rows)==750
    urls=sorted({r['jalan_url'] for r in rows if r.get('jalan_url')})
    results={}
    with ThreadPoolExecutor(max_workers=18) as ex:
        futs={ex.submit(fetch,u):u for u in urls}
        for fut in as_completed(futs):
            u=futs[fut]
            raw,final,status,error=fut.result()
            h1=extract_h1(raw)
            title=extract_title(raw)
            text=textify(raw)
            results[u]={'url':u,'final_url':final,'http_status':status,'error':error,'live_h1':h1,'live_title':title,'text':text[:40000]}

    # Check same URL assigned to materially different expected hotel names.
    by_url={}
    for r in rows:
        if r.get('jalan_url'):
            by_url.setdefault(r['jalan_url'],[]).append(r)
    url_collisions=[]
    for u,rr in by_url.items():
        names=[]
        for r in rr:
            if not any(sim(r['hotel_name'],n)>=0.8 for n in names): names.append(r['hotel_name'])
        if len(names)>1:
            url_collisions.append({'url':u,'hotel_names':names,'research_nos':[int(x['research_no']) for x in rr]})

    audit=[]
    for r in rows:
        base={k:r.get(k,'') for k in ['research_no','id','hotel_name','prefecture','station','jalan_url','jalan_hotel_name','verification_status']}
        if not r.get('jalan_url'):
            base.update({'live_h1':'','live_title':'','name_similarity':'','prefecture_on_page':'','audit_status':'no_url','error':''})
        else:
            z=results[r['jalan_url']]
            live=z['live_h1'] or z['live_title']
            score=sim(r['hotel_name'],live)
            pref_ok=bool(r.get('prefecture') and r['prefecture'] in z['text'])
            st=classify(r['hotel_name'],live,r.get('prefecture'),z['text'],z['http_status'],z['error'])
            base.update({'live_h1':z['live_h1'],'live_title':z['live_title'],'name_similarity':score,'prefecture_on_page':pref_ok,'audit_status':st,'error':z['error'] or ''})
        audit.append(base)

    fields=list(audit[0].keys())
    with (OUT/'jalan_name_url_audit_750.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(audit)
    suspicious=[x for x in audit if x['audit_status'] not in ('match','likely_match','no_url')]
    with (OUT/'jalan_name_url_suspicious.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(suspicious)
    counts={}
    for x in audit: counts[x['audit_status']]=counts.get(x['audit_status'],0)+1
    summary={
      'row_count':len(rows),'link_rows':sum(bool(r.get('jalan_url')) for r in rows),'unique_urls':len(urls),
      'status_counts':counts,'suspicious_rows':len(suspicious),'url_collision_count':len(url_collisions),
      'url_collisions':url_collisions,'suspicious_research_nos':[int(x['research_no']) for x in suspicious]
    }
    (OUT/'jalan_name_url_audit_summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__': main()
