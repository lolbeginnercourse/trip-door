#!/usr/bin/env python3
import argparse, html as htmlmod, json, re, time, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

JST=timezone(timedelta(hours=9))
SRC=Path('assets/data/hotels.json')
OUT=Path('research/generated')
OUT.mkdir(parents=True,exist_ok=True)
HOTEL_CACHE=OUT/'hotel_access_cache.jsonl'
VENUE_CACHE=OUT/'venue_access_cache.jsonl'
RESULT=OUT/'hotel_detail_research_750.jsonl'
PROGRESS=OUT/'research_progress.json'
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
AGGREGATORS=('travel.yahoo.co.jp','jalan.net','travel.rakuten.co.jp','booking.com','agoda.com','trivago.','ikyu.com','jtb.co.jp','knt.co.jp','navitime.co.jp','ekitan.com','tripadvisor','search.yahoo.co.jp','google.com')
PREFS='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split()

class LinkParser(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]; self.cur=None; self.text=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a': self.cur=dict(attrs).get('href'); self.text=[]
    def handle_data(self,data):
        if self.cur: self.text.append(data)
    def handle_endtag(self,tag):
        if tag=='a' and self.cur:
            t=' '.join(''.join(self.text).split())
            if t: self.links.append({'href':htmlmod.unescape(self.cur),'text':htmlmod.unescape(t)[:500]})
            self.cur=None; self.text=[]

def norm(s): return re.sub(r'[\s・･\-‐‑–—―_()（）「」『』【】\[\]／/]+','',str(s or '')).lower()
def domain(url):
    try: return urlparse(url).netloc.lower()
    except: return ''
def is_aggregator(url): return any(x in domain(url) for x in AGGREGATORS)

def http_get(url,maxbytes=1200000,retries=3):
    last=None
    for i in range(retries):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept-Language':'ja-JP,ja;q=0.9,en;q=0.6'})
            with urllib.request.urlopen(req,timeout=25) as r:
                return r.read(maxbytes).decode('utf-8','ignore'),r.geturl()
        except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError) as e:
            last=e
            if isinstance(e,urllib.error.HTTPError) and e.code not in (429,500,502,503,504): break
            time.sleep(1.5*(i+1))
    raise last or RuntimeError('fetch failed')

def textify(raw):
    s=re.sub(r'(?i)<(?:br\s*/?|/p|/div|/li|/h[1-6]|/tr)>','\n',raw)
    s=re.sub(r'(?is)<script.*?</script>|<style.*?</style>',' ',s)
    s=re.sub(r'(?s)<[^>]+>',' ',s)
    s=htmlmod.unescape(s).replace('\u3000',' ')
    lines=[' '.join(x.split()) for x in s.splitlines()]
    return '\n'.join(x for x in lines if x)

def yahoo_search(query):
    url='https://search.yahoo.co.jp/search?p='+urllib.parse.quote(query)
    raw,final=http_get(url,maxbytes=1000000)
    p=LinkParser(); p.feed(raw)
    return url,raw,textify(raw),p.links

def score_link(link,name,kind):
    u=link['href']; t=link['text']; d=domain(u)
    if not u.startswith('http'): return -999
    if 'search.yahoo.co.jp' in d: return -999
    score=0
    nn=norm(name); nt=norm(t)
    if nn and nn in nt: score+=12
    else:
        toks=[norm(x) for x in re.split(r'[\s・･（）()／/]+',name) if len(norm(x))>=3]
        score+=min(8,sum(2 for x in toks if x in nt))
    if '公式' in t: score+=8
    if not is_aggregator(u): score+=5
    if any(x in u.lower() for x in ('access','map','hotel','yado','facility','guide')): score+=1
    if kind=='venue' and any(x in t for x in ('アクセス','交通','会館','ホール','劇場','アリーナ')): score+=2
    if kind=='hotel' and any(x in t for x in ('ホテル','hotel','宿泊')): score+=2
    return score

def choose_pages(links,name,kind,limit=4):
    ranked=sorted(((score_link(x,name,kind),x) for x in links),key=lambda x:x[0],reverse=True)
    seen=set(); out=[]
    for sc,x in ranked:
        if sc<3: continue
        u=x['href']
        if u in seen: continue
        seen.add(u); out.append((sc,x))
        if len(out)>=limit: break
    return out

def extract_address(text):
    for line in text.splitlines():
        if re.search(r'\d{3}-\d{4}',line) and any(p in line for p in PREFS):
            m=re.search(r'(?:〒\s*)?\d{3}-\d{4}\s*([^\n]{4,100})',line)
            if m:
                s=m.group(1)
                for stop in ('TEL','Tel','電話','FAX','Fax','アクセス','Google','MAP','地図','チェックイン'):
                    s=s.split(stop)[0]
                s=s.strip(' ・,，/／')
                if any(p in s for p in PREFS): return s[:90]
    # fallback without postal code
    for line in text.splitlines():
        if any(p in line for p in PREFS) and re.search(r'\d',line) and len(line)<=120:
            return line.strip()[:90]
    return None

def candidate_walk(text,station):
    if not station: return None
    st=re.escape(str(station).removesuffix('駅'))
    pats=[
      rf'{st}\s*[」』”\"]?\s*駅?[^。\n]{{0,100}}?徒歩\s*(?:約\s*)?(\d{{1,2}})\s*分',
      rf'徒歩\s*(?:約\s*)?(\d{{1,2}})\s*分[^。\n]{{0,80}}?{st}\s*[」』”\"]?\s*駅?'
    ]
    vals=[]
    for pat in pats:
        vals += [int(x) for x in re.findall(pat,text,re.I) if 0<int(x)<=60]
    return min(vals) if vals else None

def all_station_walks(text):
    out=[]
    # Keep the station name conservative; stop at punctuation/newline and common particles.
    pat=r'([A-Za-z0-9一-龥々ぁ-んァ-ヶ・ー]{1,24})\s*[」』”\"]?\s*駅[^。\n]{0,90}?徒歩\s*(?:約\s*)?(\d{1,2})\s*分'
    for m in re.finditer(pat,text,re.I):
        st=m.group(1).strip('「『【（(・ '); mins=int(m.group(2))
        # Remove leading line/company fragments when possible.
        st=re.sub(r'^(?:JR|地下鉄|東京メトロ|都営|京急|東急|阪急|阪神|近鉄|名鉄|西鉄|京阪|南海|東武|西武|相鉄|りんかい線|東京モノレール)\s*','',st)
        if 0<mins<=60 and len(st)>=1:
            item={'station':st.removesuffix('駅'),'walk_min':mins,'context':m.group(0)[:180]}
            if not any(norm(x['station'])==norm(item['station']) and x['walk_min']==mins for x in out): out.append(item)
    return sorted(out,key=lambda x:x['walk_min'])[:8]

def research_place(name,kind,candidate_station=None,prefecture=None):
    q=f'"{name}" アクセス 最寄り駅 徒歩 公式'
    if prefecture: q+=f' {prefecture}'
    checked=datetime.now(JST).isoformat(timespec='seconds')
    try: search_url,raw,search_text,links=yahoo_search(q)
    except Exception as e:
        return {'name':name,'candidate_station':candidate_station,'station':candidate_station,'walk_min':None,'address':None,'source_url':None,'search_url':None,'source_type':'error','checked_at':checked,'error':repr(e),'alternatives':[]}
    page_texts=[]; chosen_url=None; chosen_type='search'; chosen_score=None
    # Search results can themselves contain useful access snippets.
    combined=search_text
    pages=[]
    for sc,link in choose_pages(links,name,kind):
        try:
            raw2,final=http_get(link['href'])
            txt=textify(raw2)
            # Avoid obviously unrelated pages.
            if norm(name)[:8] and norm(name)[:8] not in norm(txt) and sc<10: continue
            pages.append((sc,final,txt,link['text']))
            combined+='\n'+txt
            if chosen_url is None:
                chosen_url=final; chosen_score=sc; chosen_type='ota' if is_aggregator(final) else 'official'
            # Stop after a strong official page has yielded useful access text.
            if not is_aggregator(final) and (candidate_walk(txt,candidate_station) is not None or all_station_walks(txt)):
                break
        except Exception:
            continue
        finally:
            time.sleep(0.12)
    walk=candidate_walk(combined,candidate_station)
    alternatives=all_station_walks(combined)
    station=candidate_station
    if walk is None and alternatives:
        station=alternatives[0]['station']; walk=alternatives[0]['walk_min']
    # If candidate station is present among alternatives, prefer it even when generic regex found another first.
    if candidate_station:
        for a in alternatives:
            if norm(a['station'])==norm(str(candidate_station).removesuffix('駅')):
                station=candidate_station; walk=a['walk_min']; break
    address=None
    for _,_,txt,_ in pages:
        address=extract_address(txt)
        if address: break
    if address is None: address=extract_address(search_text)
    if chosen_url is None and links:
        # Keep a search result source only if no page was fetchable.
        chosen_url=search_url; chosen_type='search'; chosen_score=0
    return {'name':name,'candidate_station':candidate_station,'station':station,'walk_min':walk,'address':address,'source_url':chosen_url,'search_url':search_url,'source_type':chosen_type,'source_score':chosen_score,'checked_at':checked,'error':None,'alternatives':alternatives}

def transit_route(fr,to):
    if not fr or not to: return {'time_min':None,'transfer_count':None,'source_url':None,'error':'missing_station'}
    if norm(str(fr).removesuffix('駅'))==norm(str(to).removesuffix('駅')):
        return {'time_min':0,'transfer_count':0,'source_url':None,'error':None,'same_station':True}
    now=datetime.now(JST)
    params={'from':str(fr).removesuffix('駅'),'to':str(to).removesuffix('駅'),'type':'1','ticket':'ic','y':now.year,'m':f'{now.month:02d}','d':f'{now.day:02d}','hh':'12','m1':'0','m2':'0'}
    url='https://transit.yahoo.co.jp/search/result?'+urllib.parse.urlencode(params)
    try:
        raw,_=http_get(url,maxbytes=900000)
        # First route summary in Yahoo's embedded serialized data.
        m=re.search(r'\\"summaryInfo\\":\{\\"departureTime\\":\\"[^\"]*\\",\\"arrivalTime\\":\\"[^\"]*\\",\\"totalTime\\":\\"(\d+)分\\".*?\\"transferCount\\":\\"(\d+)\\"',raw,re.S)
        if not m:
            plain=textify(raw)
            m2=re.search(r'ルート\s*1[^\n]{0,220}?(\d+)分[^\n]{0,100}?乗換[:：]\s*(\d+)\s*回',plain)
            if m2: return {'time_min':int(m2.group(1)),'transfer_count':int(m2.group(2)),'source_url':url,'error':None}
            return {'time_min':None,'transfer_count':None,'source_url':url,'error':'parse_failed'}
        return {'time_min':int(m.group(1)),'transfer_count':int(m.group(2)),'source_url':url,'error':None}
    except Exception as e:
        return {'time_min':None,'transfer_count':None,'source_url':url,'error':repr(e)}

def read_jsonl(path,key):
    d={}
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            try:
                x=json.loads(line); d[x[key]]=x
            except Exception: pass
    return d

def write_jsonl(path,items,key_order=None):
    vals=list(items.values()) if isinstance(items,dict) else list(items)
    if key_order: vals.sort(key=key_order)
    path.write_text(''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n' for x in vals),encoding='utf-8')

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--start',type=int,default=1); ap.add_argument('--end',type=int,default=50); args=ap.parse_args()
    data=json.loads(SRC.read_text(encoding='utf-8'))
    records=data['hotels'] if isinstance(data,dict) else data
    targets=[r for r in records if r.get('isPublished',True) and isinstance(r.get('rank'),int) and 1<=r['rank']<=3 and r.get('venueId')]
    targets.sort(key=lambda r:(r.get('venueNumber',999999),r.get('rank',99),r.get('id','')))
    assert len(targets)==750, f'expected 750, got {len(targets)}'
    start=max(1,args.start); end=min(len(targets),args.end); batch=targets[start-1:end]
    hotel_cache=read_jsonl(HOTEL_CACHE,'name'); venue_cache=read_jsonl(VENUE_CACHE,'venueId'); results=read_jsonl(RESULT,'id')
    for idx,r in enumerate(batch,start):
        hname=r['name']; vid=r['venueId']; vname=r['venueLabel']; pref=r.get('prefecture'); cand=r.get('station')
        if hname not in hotel_cache:
            hotel_cache[hname]=research_place(hname,'hotel',cand,pref)
            write_jsonl(HOTEL_CACHE,hotel_cache,key_order=lambda x:x['name'])
            time.sleep(0.25)
        h=hotel_cache[hname]
        if vid not in venue_cache:
            venue_cache[vid]={'venueId':vid,**research_place(vname,'venue',None,pref)}
            write_jsonl(VENUE_CACHE,venue_cache,key_order=lambda x:x['venueId'])
            time.sleep(0.25)
        v=venue_cache[vid]
        route=transit_route(h.get('station') or cand,v.get('station'))
        time.sleep(0.18)
        hw=h.get('walk_min'); vw=v.get('walk_min'); tm=route.get('time_min')
        known=[x for x in (hw,tm,vw) if isinstance(x,int)]
        total=sum(known) if len(known)==3 else None
        warnings=[]
        if h.get('walk_min') is None: warnings.append('hotel_walk_unverified')
        if not v.get('station') or v.get('walk_min') is None: warnings.append('venue_access_unverified')
        if route.get('error'): warnings.append('transit_'+str(route['error']))
        if h.get('station') and cand and norm(h['station'])!=norm(cand): warnings.append('hotel_station_differs_from_existing')
        if isinstance(tm,int) and tm>120: warnings.append('transit_time_over_120_review')
        status='verified' if not warnings else ('partial' if total is not None else 'needs_review')
        parts=[]
        if total is not None: parts.append(f'{vname}まで約{total}分')
        if h.get('station') and hw is not None: parts.append(f'{str(h.get("station")).removesuffix("駅")}駅まで徒歩{hw}分')
        if route.get('transfer_count') is not None: parts.append(f'乗換{route["transfer_count"]}回')
        results[r['id']]={
          'research_no':idx,'id':r['id'],'venueId':vid,'venueNumber':r.get('venueNumber'),'rank':r.get('rank'),'genre':r.get('genre'),
          'hotel_name':hname,'venue_name':vname,'prefecture':pref,'area':r.get('area'),
          'hotel_nearest_station':h.get('station') or cand,'hotel_to_station_walk_min':hw,'hotel_address':h.get('address'),'hotel_source_url':h.get('source_url'),'hotel_source_type':h.get('source_type'),'hotel_search_url':h.get('search_url'),
          'venue_nearest_station':v.get('station'),'venue_station_to_venue_walk_min':vw,'venue_address':v.get('address'),'venue_source_url':v.get('source_url'),'venue_source_type':v.get('source_type'),'venue_search_url':v.get('search_url'),'venue_access_alternatives':v.get('alternatives',[]),
          'station_to_station_min':tm,'transfer_count':route.get('transfer_count'),'transit_source_url':route.get('source_url'),
          'total_access_min':total,'access_display':' / '.join(parts) if parts else None,
          'existing_access_estimate':r.get('accessEstimate'),'price_estimate':r.get('priceEstimate'),'price_range_estimate':r.get('priceRangeEstimate'),'plan_estimate':r.get('planEstimate'),'room_type_estimate':r.get('roomTypeEstimate'),'cancellation_estimate':r.get('cancellationEstimate'),
          'verification_status':status,'warnings':warnings,'checked_at':datetime.now(JST).isoformat(timespec='seconds')
        }
        write_jsonl(RESULT,results,key_order=lambda x:x['research_no'])
        print(f'[{idx}/750] {hname} -> {vname}: {status} total={total} walk={hw} route={tm} venuewalk={vw}',flush=True)
    write_jsonl(HOTEL_CACHE,hotel_cache,key_order=lambda x:x['name']); write_jsonl(VENUE_CACHE,venue_cache,key_order=lambda x:x['venueId']); write_jsonl(RESULT,results,key_order=lambda x:x['research_no'])
    counts={'verified':0,'partial':0,'needs_review':0}
    for x in results.values(): counts[x.get('verification_status','needs_review')]=counts.get(x.get('verification_status','needs_review'),0)+1
    progress={'target_count':750,'processed_count':len(results),'batch_start':start,'batch_end':end,'hotel_cache_count':len(hotel_cache),'venue_cache_count':len(venue_cache),'status_counts':counts,'updated_at':datetime.now(JST).isoformat(timespec='seconds')}
    PROGRESS.write_text(json.dumps(progress,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(progress,ensure_ascii=False),flush=True)
if __name__=='__main__': main()
