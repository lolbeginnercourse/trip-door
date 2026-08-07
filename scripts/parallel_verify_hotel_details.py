#!/usr/bin/env python3
import argparse
import json
import math
import re
import time
from datetime import datetime
from pathlib import Path

from research_hotel_details import (
    JST,
    SRC,
    RESULT,
    choose_pages,
    http_get,
    is_aggregator,
    norm,
    textify,
    transit_route,
    yahoo_search,
)

BAD_STATION_WORDS = (
    '最寄', 'アクセス', 'ホテル', '会場', '公式', '徒歩', '電車', '交通', '周辺',
    '乗換', 'ルート', '地図', '出口', '改札', 'バス', 'タクシー', '住所', '施設'
)
OPERATOR_PREFIXES = (
    '東京モノレール', 'JR東日本', 'JR東海', 'JR西日本', 'JR北海道', 'JR九州', 'JR四国', 'JR',
    '東京メトロ', '都営地下鉄', '都営', 'りんかい線', '京急電鉄', '京急', '東急電鉄', '東急',
    '小田急電鉄', '小田急', '京王電鉄', '京王', '西武鉄道', '西武', '東武鉄道', '東武',
    '相模鉄道', '相鉄', '横浜市営地下鉄', '大阪メトロ', 'Osaka Metro', '阪急電鉄', '阪急',
    '阪神電鉄', '阪神', '近畿日本鉄道', '近鉄', '名古屋鉄道', '名鉄', '南海電鉄', '南海',
    '京阪電鉄', '京阪', '西日本鉄道', '西鉄', '福岡市地下鉄', '札幌市営地下鉄', '仙台市地下鉄',
)


def load_jsonl(path):
    rows=[]
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            if line.strip():
                try: rows.append(json.loads(line))
                except Exception: pass
    return rows


def clean_station(raw):
    s=str(raw or '').strip(' \t\r\n「」『』【】()（）<>＜＞:：,，、・/／|-')
    if not s: return None
    # Keep the last whitespace-delimited token; access snippets often prepend a railway operator.
    s=re.split(r'\s+',s)[-1]
    for p in OPERATOR_PREFIXES:
        if s.startswith(p) and len(s)>len(p):
            s=s[len(p):]
            break
    # Railway-line text sometimes sticks directly to the station name: ○○線△△駅.
    if '線' in s and not s.endswith('線'):
        tail=s.rsplit('線',1)[-1]
        if 1 <= len(tail) <= 24:
            s=tail
    s=s.removesuffix('駅').strip('「」『』【】()（）・ ')
    if not s or len(s)>24: return None
    if any(w in s for w in BAD_STATION_WORDS): return None
    if re.fullmatch(r'\d+',s): return None
    return s


def station_walk_pairs(text):
    out=[]
    # Find station mentions first, then search a compact context around each mention for walking minutes.
    for m in re.finditer(r'([^\s、。,.，:：;；/／「」『』【】()（）<>＜＞]{1,36})駅', text):
        station=clean_station(m.group(1))
        if not station: continue
        left=text[max(0,m.start()-70):m.start()]
        right=text[m.end():min(len(text),m.end()+140)]
        mins=[]
        for pat in (
            r'(?:徒歩|歩いて)\s*(?:約\s*)?(\d{1,2})\s*分',
            r'(?:徒歩|歩いて)\s*(?:およそ\s*)?(\d{1,2})\s*分',
        ):
            mr=re.search(pat,right,re.I)
            if mr: mins.append(int(mr.group(1)))
        ml=re.search(r'(?:徒歩|歩いて)\s*(?:約\s*)?(\d{1,2})\s*分[^。\n]{0,60}$',left,re.I)
        if ml: mins.append(int(ml.group(1)))
        for minute in mins:
            if 0 < minute <= 60:
                item={'station':station,'walk_min':minute,'context':(left[-60:]+m.group(0)+right[:110]).replace('\n',' ')[:220]}
                if not any(norm(x['station'])==norm(station) and x['walk_min']==minute for x in out):
                    out.append(item)
    return out


def choose_pair(text, candidate=None):
    pairs=station_walk_pairs(text)
    if candidate:
        cn=norm(str(candidate).removesuffix('駅'))
        exact=[x for x in pairs if norm(x['station'])==cn]
        if exact:
            return sorted(exact,key=lambda x:x['walk_min'])[0],pairs
        # Candidate station may be present with only the walk wording close by but with operator text breaking the generic pair parser.
        c=re.escape(str(candidate).removesuffix('駅'))
        for pat in (
            rf'{c}\s*駅?[^。\n]{{0,120}}?(?:徒歩|歩いて)\s*(?:約\s*)?(\d{{1,2}})\s*分',
            rf'(?:徒歩|歩いて)\s*(?:約\s*)?(\d{{1,2}})\s*分[^。\n]{{0,80}}?{c}\s*駅?',
        ):
            mm=re.search(pat,text,re.I)
            if mm:
                minute=int(mm.group(1))
                if 0 < minute <= 60:
                    return {'station':str(candidate).removesuffix('駅'),'walk_min':minute,'context':mm.group(0)[:220]},pairs
    if not pairs: return None,pairs
    # Prefer realistic short station walks, then the earliest match.
    realistic=[x for x in pairs if x['walk_min'] <= 30]
    return (realistic[0] if realistic else pairs[0]),pairs


def source_type(url):
    if not url: return 'search'
    return 'ota' if is_aggregator(url) else 'official'


def try_text(text, candidate=None):
    pair,pairs=choose_pair(text,candidate)
    return pair,pairs


def verify_entity(name, kind, candidate=None, prefecture=None, preferred_url=None):
    checked=datetime.now(JST).isoformat(timespec='seconds')
    best=None
    alternatives=[]

    # First retry the already-discovered source with a broader parser. This is much faster than a new search when the page is good.
    if preferred_url and preferred_url.startswith('http') and 'search.yahoo.co.jp' not in preferred_url:
        try:
            raw,final=http_get(preferred_url,maxbytes=1400000,retries=2)
            text=textify(raw)
            pair,pairs=try_text(text,candidate)
            alternatives.extend(pairs)
            if pair:
                return {
                    'station':pair['station'],'walk_min':pair['walk_min'],'source_url':final,
                    'source_type':source_type(final),'evidence_type':'source_page','evidence':pair['context'],
                    'alternatives':pairs[:10],'checked_at':checked,'error':None,
                }
        except Exception:
            pass

    if kind=='hotel':
        queries=[]
        if candidate: queries.append(f'"{name}" "{str(candidate).removesuffix("駅")}駅" 徒歩')
        queries.append(f'"{name}" アクセス 最寄り駅 徒歩 公式')
    else:
        queries=[
            f'"{name}" 最寄り駅 徒歩',
            f'"{name}" アクセス 駅 徒歩 公式',
        ]
    if prefecture:
        queries=[q+' '+prefecture for q in queries]

    last_error=None
    for q in queries:
        try:
            search_url,raw,search_text,links=yahoo_search(q)
        except Exception as e:
            last_error=repr(e)
            time.sleep(0.4)
            continue

        pair,pairs=try_text(search_text,candidate)
        alternatives.extend(pairs)
        ranked=choose_pages(links,name,kind,limit=3)
        if pair:
            supporting=ranked[0][1]['href'] if ranked else search_url
            return {
                'station':pair['station'],'walk_min':pair['walk_min'],'source_url':supporting,
                'source_type':source_type(supporting),'evidence_type':'search_snippet','evidence':pair['context'],
                'alternatives':pairs[:10],'checked_at':checked,'error':None,
            }

        # Search only a few highly ranked pages and stop immediately when a station/walk pair is found.
        for score,link in ranked:
            try:
                raw2,final=http_get(link['href'],maxbytes=1400000,retries=2)
                text=textify(raw2)
                pair,pairs=try_text(text,candidate)
                alternatives.extend(pairs)
                if pair:
                    return {
                        'station':pair['station'],'walk_min':pair['walk_min'],'source_url':final,
                        'source_type':source_type(final),'evidence_type':'source_page','evidence':pair['context'],
                        'alternatives':pairs[:10],'checked_at':checked,'error':None,
                    }
            except Exception as e:
                last_error=repr(e)
            finally:
                time.sleep(0.08)
        time.sleep(0.15)

    # Deduplicate evidence for later manual review.
    uniq=[]
    for x in alternatives:
        if not any(norm(y['station'])==norm(x['station']) and y['walk_min']==x['walk_min'] for y in uniq):
            uniq.append(x)
    return {
        'station':str(candidate).removesuffix('駅') if candidate else None,'walk_min':None,'source_url':preferred_url,
        'source_type':source_type(preferred_url),'evidence_type':None,'evidence':None,
        'alternatives':uniq[:10],'checked_at':checked,'error':last_error or 'not_found',
    }


def recompute(row, src, hotel_check=None, venue_check=None):
    out=dict(row)
    candidate=src.get('station') if src else out.get('hotel_nearest_station')

    if hotel_check:
        if hotel_check.get('station'): out['hotel_nearest_station']=hotel_check['station']
        if hotel_check.get('walk_min') is not None: out['hotel_to_station_walk_min']=hotel_check['walk_min']
        if hotel_check.get('source_url'): out['hotel_source_url']=hotel_check['source_url']
        out['hotel_source_type']=hotel_check.get('source_type') or out.get('hotel_source_type')
        out['hotel_parallel_evidence_type']=hotel_check.get('evidence_type')
        out['hotel_parallel_evidence']=hotel_check.get('evidence')

    if venue_check:
        if venue_check.get('station'): out['venue_nearest_station']=venue_check['station']
        if venue_check.get('walk_min') is not None: out['venue_station_to_venue_walk_min']=venue_check['walk_min']
        if venue_check.get('source_url'): out['venue_source_url']=venue_check['source_url']
        out['venue_source_type']=venue_check.get('source_type') or out.get('venue_source_type')
        out['venue_access_alternatives']=venue_check.get('alternatives') or out.get('venue_access_alternatives',[])
        out['venue_parallel_evidence_type']=venue_check.get('evidence_type')
        out['venue_parallel_evidence']=venue_check.get('evidence')

    hs=out.get('hotel_nearest_station') or candidate
    vs=out.get('venue_nearest_station')
    route=transit_route(hs,vs)
    hw=out.get('hotel_to_station_walk_min')
    vw=out.get('venue_station_to_venue_walk_min')
    tm=route.get('time_min')
    out['station_to_station_min']=tm
    out['transfer_count']=route.get('transfer_count')
    out['transit_source_url']=route.get('source_url')

    total=hw+tm+vw if all(isinstance(x,int) for x in (hw,tm,vw)) else None
    out['total_access_min']=total
    warnings=[]
    if hw is None: warnings.append('hotel_walk_unverified')
    if not vs or vw is None: warnings.append('venue_access_unverified')
    if route.get('error'): warnings.append('transit_'+str(route['error']))
    if hs and candidate and norm(hs)!=norm(candidate): warnings.append('hotel_station_differs_from_existing')
    if isinstance(tm,int) and tm>120: warnings.append('transit_time_over_120_review')
    out['warnings']=warnings
    out['verification_status']='verified' if not warnings else ('partial' if total is not None else 'needs_review')

    parts=[]
    if total is not None: parts.append(f'{out.get("venue_name")}まで約{total}分')
    if hs and hw is not None: parts.append(f'{str(hs).removesuffix("駅")}駅まで徒歩{hw}分')
    if route.get('transfer_count') is not None: parts.append(f'乗換{route["transfer_count"]}回')
    out['access_display']=' / '.join(parts) if parts else None
    out['parallel_verified_at']=datetime.now(JST).isoformat(timespec='seconds')
    return out


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--shard-index',type=int,required=True)
    ap.add_argument('--shards',type=int,required=True)
    ap.add_argument('--output',required=True)
    args=ap.parse_args()

    baseline=load_jsonl(RESULT)
    if len(baseline)!=750:
        raise SystemExit(f'Expected 750 baseline rows, got {len(baseline)}')
    baseline.sort(key=lambda x:x.get('research_no',999999))
    srcdata=json.loads(SRC.read_text(encoding='utf-8'))
    records=srcdata['hotels'] if isinstance(srcdata,dict) else srcdata
    source_by_id={r.get('id'):r for r in records if r.get('id')}

    chunk=math.ceil(len(baseline)/args.shards)
    lo=args.shard_index*chunk
    hi=min(len(baseline),(args.shard_index+1)*chunk)
    selected=baseline[lo:hi]

    hotel_cache={}
    venue_cache={}
    updated=[]
    for pos,row in enumerate(selected,lo+1):
        if row.get('verification_status')=='verified':
            out=dict(row)
            out['parallel_check_skipped']='already_verified'
            updated.append(out)
            print(f'[{pos}/750] already verified {row.get("hotel_name")}',flush=True)
            continue

        src=source_by_id.get(row.get('id'),{})
        candidate=src.get('station') or row.get('hotel_nearest_station')
        hkey=row.get('hotel_name')
        vkey=row.get('venueId')

        need_hotel=row.get('hotel_to_station_walk_min') is None or 'hotel_station_differs_from_existing' in (row.get('warnings') or [])
        need_venue=not row.get('venue_nearest_station') or row.get('venue_station_to_venue_walk_min') is None

        hcheck=None
        if need_hotel:
            if hkey not in hotel_cache:
                hotel_cache[hkey]=verify_entity(
                    hkey,'hotel',candidate,src.get('prefecture') or row.get('prefecture'),row.get('hotel_source_url')
                )
            hcheck=hotel_cache[hkey]

        vcheck=None
        if need_venue:
            if vkey not in venue_cache:
                venue_cache[vkey]=verify_entity(
                    row.get('venue_name'),'venue',row.get('venue_nearest_station'),src.get('prefecture') or row.get('prefecture'),row.get('venue_source_url')
                )
            vcheck=venue_cache[vkey]

        out=recompute(row,src,hcheck,vcheck)
        updated.append(out)
        print(
            f'[{pos}/750] {out.get("hotel_name")} -> {out.get("venue_name")}: '
            f'{row.get("verification_status")} => {out.get("verification_status")} '
            f'hotelwalk={out.get("hotel_to_station_walk_min")} venue={out.get("venue_nearest_station")} '
            f'venuewalk={out.get("venue_station_to_venue_walk_min")} route={out.get("station_to_station_min")}',
            flush=True,
        )

    path=Path(args.output)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n' for x in updated),encoding='utf-8')
    summary={
        'shard_index':args.shard_index,'shards':args.shards,'start_research_no':lo+1,'end_research_no':hi,
        'row_count':len(updated),'hotel_entities_checked':len(hotel_cache),'venue_entities_checked':len(venue_cache),
        'status_counts':{},'finished_at':datetime.now(JST).isoformat(timespec='seconds')
    }
    for x in updated:
        s=x.get('verification_status','unknown'); summary['status_counts'][s]=summary['status_counts'].get(s,0)+1
    Path(str(path)+'.summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False),flush=True)

if __name__=='__main__':
    main()
