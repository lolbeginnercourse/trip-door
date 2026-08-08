#!/usr/bin/env python3
import argparse
import csv
import html as htmlmod
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from html.parser import HTMLParser
from pathlib import Path
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151 Safari/537.36'
YAD_RE = re.compile(r'https?://(?:www\.)?jalan\.net/yad(\d+)(?:/[^\s"<>]*)?', re.I)

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.cur=None; self.text=[]
    def handle_starttag(self, tag, attrs):
        if tag == 'a': self.cur = dict(attrs).get('href'); self.text=[]
    def handle_data(self, data):
        if self.cur: self.text.append(data)
    def handle_endtag(self, tag):
        if tag == 'a' and self.cur:
            text=' '.join(''.join(self.text).split())
            self.links.append((htmlmod.unescape(self.cur), htmlmod.unescape(text)))
            self.cur=None; self.text=[]

def norm(s):
    s = unicodedata.normalize('NFKC', str(s or '')).lower()
    s = re.sub(r'(?i)\bby\s+ihg\b', '', s)
    s = re.sub(r'[\s\u3000・･\-‐‑–—―_()（）「」『』【】\[\]〈〉<>／/.,，。:：!！?？&＆+＋\'\"`]+', '', s)
    return s

def textify(raw):
    s = re.sub(r'(?is)<script.*?</script>|<style.*?</style>', ' ', raw)
    s = re.sub(r'(?i)<(?:br\s*/?|/p|/div|/li|/h[1-6]|/tr|/td|/th)>', '\n', s)
    s = re.sub(r'(?s)<[^>]+>', ' ', s)
    s = htmlmod.unescape(s).replace('\u3000',' ')
    return '\n'.join(' '.join(x.split()) for x in s.splitlines() if ' '.join(x.split()))

def decode_response(data, headers):
    candidates=[]
    try:
        c=headers.get_content_charset()
        if c: candidates.append(c)
    except Exception:
        pass
    head=data[:8192].decode('latin1','ignore')
    m=re.search(r'(?i)charset\s*=\s*["\']?\s*([a-zA-Z0-9._-]+)', head)
    if m: candidates.append(m.group(1))
    candidates += ['utf-8','cp932','shift_jis','euc_jp']
    seen=set()
    for enc in candidates:
        if not enc: continue
        key=enc.lower().replace('_','-')
        if key in seen: continue
        seen.add(key)
        try:
            return data.decode(enc)
        except Exception:
            continue
    return data.decode('utf-8','replace')

def http_get(url, maxbytes=1200000, retries=3, timeout=25):
    last=None
    for i in range(retries):
        try:
            req=urllib.request.Request(url, headers={'User-Agent':UA,'Accept-Language':'ja-JP,ja;q=0.9,en;q=0.5'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data=r.read(maxbytes)
                return decode_response(data,r.headers), r.geturl()
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            last=e
            if isinstance(e, urllib.error.HTTPError) and e.code not in (429,500,502,503,504): break
            time.sleep(0.7*(i+1))
    raise last or RuntimeError('fetch failed')

def yahoo_search(query):
    u='https://search.yahoo.co.jp/search?p='+urllib.parse.quote(query)
    raw,final=http_get(u, maxbytes=1000000)
    p=LinkParser(); p.feed(raw)
    return u,raw,p.links

def canonical_yad_urls(raw, links):
    seen=[]
    def add_text(x):
        for s in (x, urllib.parse.unquote(x)):
            for m in YAD_RE.finditer(s):
                u=f'https://www.jalan.net/yad{m.group(1)}/'
                if u not in seen: seen.append(u)
    add_text(htmlmod.unescape(raw))
    for href,text in links:
        add_text(href); add_text(text)
    return seen

def extract_jalan_name(raw):
    m=re.search(r'(?is)<h1[^>]*>(.*?)</h1>', raw)
    if m:
        t=textify(m.group(1)).strip()
        if t:
            t=re.sub(r'の施設概要$','',t).strip()
            return t
    m=re.search(r'(?is)<title[^>]*>(.*?)</title>', raw)
    if m:
        t=textify(m.group(1)).strip()
        for sep in (' - 宿泊予約は','－宿泊予約は','【じゃらん',' | じゃらん'):
            t=t.split(sep)[0]
        return t.strip()
    return ''

def similarity(a,b):
    na,nb=norm(a),norm(b)
    if not na or not nb: return 0.0
    if na==nb: return 1.0
    if len(na)>=5 and (na in nb or nb in na): return 0.97
    return SequenceMatcher(None,na,nb).ratio()

def station_tokens(s):
    s=unicodedata.normalize('NFKC',str(s or ''))
    return [x.removesuffix('駅') for x in re.split(r'[・･/／\s]+',s) if len(x.removesuffix('駅'))>=2]

def evaluate_candidate(target, url):
    try:
        raw,final=http_get(url, maxbytes=1400000)
    except Exception as e:
        return {'url':url,'jalan_hotel_name':'','score':0,'name_similarity':0,'prefecture_match':False,'station_match':False,'fetch_error':repr(e)}
    m=YAD_RE.search(final) or YAD_RE.search(url)
    root=f'https://www.jalan.net/yad{m.group(1)}/' if m else url
    jname=extract_jalan_name(raw)
    plain=textify(raw[:1200000])
    ns=similarity(target['hotel_name'],jname)
    pref=bool(target.get('prefecture') and target['prefecture'] in plain)
    sts=station_tokens(target.get('station'))
    stmatch=any(t in plain for t in sts) if sts else False
    score=ns*100 + (5 if pref else 0) + (2 if stmatch else 0)
    return {'url':root,'jalan_hotel_name':jname,'score':round(score,2),'name_similarity':round(ns,4),'prefecture_match':pref,'station_match':stmatch,'fetch_error':''}

def classify(best, second=None):
    if not best or not best.get('url') or best.get('fetch_error'):
        return 'not_found','no verified Jalan facility page found'
    ns=best['name_similarity']; pref=best['prefecture_match']; st=best['station_match']
    ambiguous=bool(second and second.get('url')!=best.get('url') and best['score']-second['score']<4.0 and second.get('name_similarity',0)>=0.75)
    if ambiguous:
        return 'needs_review','multiple Jalan candidates have similar scores'
    if ns>=0.95 and (pref or st or ns>=0.99):
        return 'verified','hotel name matches Jalan page; location context consistent'
    if ns>=0.78 and (pref or st):
        return 'verified_fuzzy','hotel name is a fuzzy/renamed match; location context consistent'
    if ns>=0.70 and pref and st:
        return 'needs_review','possible renamed hotel; manual confirmation recommended'
    return 'needs_review','candidate exists but name/location match is not strong enough'

def research_one(target):
    queries=[
        f'"{target["hotel_name"]}" じゃらん',
        f'"{target["hotel_name"]}" site:jalan.net/yad',
        f'"{target["hotel_name"]}" {target.get("prefecture","")} {target.get("station","")} じゃらん',
    ]
    candidate_urls=[]; search_urls=[]; errors=[]
    for qi,q in enumerate(queries):
        try:
            su,raw,links=yahoo_search(q); search_urls.append(su)
            for u in canonical_yad_urls(raw,links):
                if u not in candidate_urls: candidate_urls.append(u)
            if candidate_urls and qi==0: break
        except Exception as e:
            errors.append(repr(e))
        time.sleep(0.12)
    evals=[]
    for u in candidate_urls[:5]:
        ev=evaluate_candidate(target,u); evals.append(ev)
        if ev['name_similarity']>=0.99 and (ev['prefecture_match'] or ev['station_match']): break
        time.sleep(0.08)
    evals.sort(key=lambda x:x['score'], reverse=True)
    best=evals[0] if evals else None; second=evals[1] if len(evals)>1 else None
    status,note=classify(best,second)
    now=datetime.now(JST).isoformat(timespec='seconds')
    return {
        **target,
        'jalan_url': best['url'] if best and status in ('verified','verified_fuzzy') else '',
        'jalan_hotel_name': best.get('jalan_hotel_name','') if best else '',
        'verification_status': status,
        'name_similarity': best.get('name_similarity','') if best else '',
        'prefecture_match': best.get('prefecture_match','') if best else '',
        'station_match': best.get('station_match','') if best else '',
        'verification_note': note,
        'search_url': search_urls[0] if search_urls else '',
        'candidate_url': best.get('url','') if best else '',
        'checked_at': now,
        'error': '; '.join(errors)[:1000],
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--manifest',default='research/generated/jalan_target_manifest.csv')
    ap.add_argument('--start',type=int,default=1)
    ap.add_argument('--end',type=int,default=750)
    ap.add_argument('--output',required=True)
    args=ap.parse_args()
    with open(args.manifest,encoding='utf-8-sig',newline='') as f:
        rows=list(csv.DictReader(f))
    rows=[r for r in rows if args.start<=int(r['research_no'])<=args.end]
    cache={}
    out=[]
    for i,r in enumerate(rows,1):
        key=(norm(r['hotel_name']),r.get('prefecture',''))
        if key not in cache:
            cache[key]=research_one(r)
        x=dict(cache[key])
        for k in ('research_no','id','venueId','venueNumber','venue_name','rank','genre','area','station'):
            x[k]=r.get(k,'')
        out.append(x)
        print(json.dumps({'progress':i,'total':len(rows),'research_no':r['research_no'],'hotel':r['hotel_name'],'status':x['verification_status'],'url':x['jalan_url']},ensure_ascii=False),flush=True)
    fields=['research_no','id','hotel_name','prefecture','area','station','venueId','venueNumber','venue_name','rank','genre','jalan_url','jalan_hotel_name','verification_status','name_similarity','prefecture_match','station_match','verification_note','search_url','candidate_url','checked_at','error']
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    with open(args.output,'w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore'); w.writeheader(); w.writerows(out)

if __name__=='__main__': main()
