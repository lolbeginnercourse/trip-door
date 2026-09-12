#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import json, html as H, re
from datetime import date

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data' / 'hotels.json'
INDEX = ROOT / 'index.html'
EXPORT = ROOT / 'records.json'
SITE_ORIGIN = 'https://mainitiworakunisuru.com'

GROUPS = [
    ('装飾・祭壇・撮影',['装飾可否','マスキングテープ','養生テープ','粘着フック','画鋲・ピン','バルーン','ベッド装飾','原状復帰','祭壇テーブル','テーブル寸法','使用可能な壁面','白壁','自然光','推し色照明','全身鏡','撮影スペース','撮影制限'],'飾り付け方法と、祭壇・撮影に必要な空間条件を分けて確認します。'),
    ('映像・音響',['Blu-ray','DVD','HDMI入力','キャスト','動画配信','スピーカー','音量制限'],'再生機器・接続方法・配信・音量条件を分けて掲載します。'),
    ('ケーキ・飲食',['ケーキ持込','ホテル提供ケーキ','推し色ケーキ','外部配送','事前受取','冷蔵保管','ケーキスタンド','食器・カトラリー','飲食持込','デリバリー','電子レンジ','冷蔵庫','ゴミ処理'],'ケーキ、受取・保管、飲食持込やデリバリーを別項目として扱います。'),
    ('ライブ遠征・身支度',['チェックイン前荷物預かり','チェックアウト後荷物預かり','最終チェックイン','チェックアウト','ヘアアイロン','衣類スチーマー','全身鏡','着替えやすさ'],'荷物預かり、チェックイン、身支度設備など遠征時に困りやすい条件を確認します。')
]

CSS = r'''
:root{--bg:#f5f5f2;--surface:#fff;--ink:#111;--text:#232326;--muted:#6b6d72;--line:#dedede;--cyan:#00a6c8;--ok:#157a51;--cond:#966b10;--unk:#73777e;--report:#126f8a;--max:1120px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;line-height:1.72}a{color:inherit;text-decoration:none}a:focus-visible,button:focus-visible{outline:3px solid rgba(0,166,200,.3);outline-offset:2px}.container{width:min(var(--max),calc(100% - 32px));margin:auto}.ad{background:#111;color:#fff;font-size:12px}.ad .container{min-height:34px;display:flex;align-items:center;gap:10px}.ad b{background:#fff;color:#111;padding:1px 7px;font-size:10px}.top{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:30}.top:after{content:"";display:block;height:3px;background:linear-gradient(90deg,#111 0 88%,var(--cyan) 88% 100%)}.nav{height:66px;display:flex;align-items:center;gap:24px}.logo{font-size:22px;font-weight:950;letter-spacing:-.04em}.nav a:not(.logo){font-size:13px;color:#555}.nav .spacer{margin-left:auto}.crumb{font-size:12px;color:#777;padding:18px 0}.crumb a{text-decoration:underline;text-underline-offset:3px}.hero{background:#fff;border:1px solid #cfcfcf;border-left:6px solid #111;padding:28px;margin-bottom:20px}.meta{font-size:12px;color:#777;font-weight:800}.hero h1{font-size:clamp(30px,5vw,48px);line-height:1.15;letter-spacing:-.045em;margin:6px 0 8px}.scope{font-size:16px;font-weight:900}.context{font-size:12px;color:#666;margin-top:4px}.summary{max-width:760px;color:#555}.tags{display:flex;gap:7px;flex-wrap:wrap;margin:18px 0 0}.tag{border:1px solid #bbb;background:#fff;padding:5px 8px;font-size:12px;font-weight:800}.updated{margin-top:16px;font-size:11px;color:#777}.layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:20px;align-items:start}.section{background:#fff;border:1px solid var(--line);margin-bottom:16px;padding:22px}.section h2{font-size:22px;margin:0 0 5px;letter-spacing:-.025em}.section>p{font-size:13px;color:#666;margin:0 0 16px}.facts{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line);border-left:1px solid var(--line)}.fact{padding:12px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.fact .key{font-size:11px;color:#777;font-weight:850}.fact .value{font-size:13px;margin-top:4px}.fact-meta{font-size:10px;color:#81858a;margin-top:5px;line-height:1.5}.status{display:inline-block;margin-right:7px;border:1px solid currentColor;padding:1px 5px;font-size:10px;font-weight:950}.status.ok{color:var(--ok)}.status.cond{color:var(--cond)}.status.unk{color:var(--unk)}.status.lead{color:var(--unk)}.status.report{color:var(--report)}.research-grid,.report-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.research-item,.report-item{border:1px solid var(--line);padding:13px;background:#fcfcfb}.research-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.research-title b{font-size:13px}.research-item p,.report-item p{font-size:13px;margin:8px 0 4px}.venue-row{border-top:1px solid var(--line);padding:12px 0}.venue-row:first-child{border-top:0}.venue-row b{display:block}.sidebar{position:sticky;top:90px}.sidebox{background:#fff;border:1px solid var(--line);padding:18px;margin-bottom:12px}.sidebox h3{margin:0 0 10px;font-size:15px}.sidebox p{font-size:12px;color:#666}.cta{display:block;width:100%;text-align:center;background:#111;color:#fff;padding:12px;font-weight:900;margin-top:8px;border:1px solid #111;font:inherit;cursor:pointer}.cta.secondary{background:#fff;color:#111}.notice{background:#fff7dd;border:1px solid #d8c16f;padding:12px;font-size:11px;margin-top:10px}.source{padding:12px 0;border-top:1px solid var(--line)}.source:first-child{border-top:0}.source a{font-weight:900;text-decoration:underline;text-underline-offset:3px}.source p{font-size:12px;color:#666;margin:3px 0 0}.source small{color:#888}.related{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.related a{display:block;border:1px solid #bbb;background:#fff;padding:13px}.related b{display:block}.related span{font-size:11px;color:#777}.footer{margin-top:44px;background:#111;color:#ddd}.footer .container{padding:30px 0}.footer a{text-decoration:underline;margin-right:14px;font-size:12px}.footnote{font-size:11px;color:#aaa;margin-top:12px}@media(max-width:800px){.nav a:not(.logo){display:none}.layout{grid-template-columns:1fr}.sidebar{position:static}.facts{grid-template-columns:1fr}.research-grid,.report-grid{grid-template-columns:1fr}.related{grid-template-columns:1fr}.hero{padding:20px}.section{padding:16px}.container{width:min(100% - 20px,var(--max))}}
'''

CSS += r'''
.hero-grid{display:grid;grid-template-columns:minmax(220px,1fr) minmax(0,2fr);gap:24px;align-items:stretch}.hero-copy{padding:8px 4px}.hero-media{margin:0;min-height:230px;background:#e9e9e6;border:1px solid var(--line);overflow:hidden}.hero-media img{display:block;width:100%;height:100%;min-height:230px;object-fit:cover}.image-placeholder{height:100%;min-height:230px;display:grid;place-items:center;align-content:center;gap:5px;padding:20px;text-align:center;color:#6b6d72}.image-placeholder span{font-size:11px;letter-spacing:.12em;font-weight:950}.image-placeholder strong{font-size:16px;color:#232326}.image-placeholder small{font-size:11px}@media(max-width:800px){.hero-grid{grid-template-columns:1fr;gap:14px}.hero-media,.hero-media img,.image-placeholder{min-height:180px}}
'''


def esc(v): return H.escape(str(v or ''))
def load_records():
    records=json.loads(DATA.read_text(encoding='utf-8'))
    ids=[r.get('id') for r in records]
    if len(ids)!=len(set(ids)): raise SystemExit('ERROR: data/hotels.json に重複IDがあります')
    return records

def compact_records(records):
    out=[]
    for r in records:
        x={k:v for k,v in r.items() if k not in {'details','sources','reviewCycleDays','evidenceReports','researchCategories'}}
        x['details']={k:[d.get('status','未確認'),d.get('note','')] if isinstance(d,dict) else d for k,d in (r.get('details') or {}).items()}
        x['researchCategories']=[{k:item.get(k) for k in ('category','key','status','value','note','sourceCount','checkedAt') if item.get(k) not in (None,'')} for item in r.get('researchCategories',[])]
        x['evidenceReports']=[{k:item.get(k) for k in ('category','key','status','value','note','evidenceType','confidence','checkedAt') if item.get(k) not in (None,'')} for item in r.get('evidenceReports',[])]
        used_source_ids={sid for item in r.get('evidenceReports',[]) for sid in item.get('sourceIds',[])}
        compact_sources=[]
        for s in r.get('sources',[]):
            if s.get('sourceType') in {'ota_search','official_plan','official_service','official_access'} or s.get('id') in used_source_ids:
                compact_sources.append({k:s.get(k) for k in ('id','label','url','note','checkedAt','sourceType','platform','evidenceType') if s.get(k) is not None})
        x['sources']=compact_sources
        out.append(x)
    return out

def seo_indexable(r):
    verified=sum(1 for d in (r.get('details') or {}).values() if isinstance(d,dict) and d.get('status') in {'確認済み','条件付き'})
    sources=sum(1 for s in r.get('sources',[]) if s.get('url'))
    return verified >= 5 and sources >= 2 and len((r.get('summary') or '').strip()) >= 40

PUBLIC_STATUSES={'確認済み','条件付き','報告あり'}
FORBIDDEN_PUBLIC_TERMS=('未確認','確認中','要確認','未調査','候補取得','候補目安','根拠候補','調査中','情報収集中','調査台帳','候補URL','本文確認前','分類検索','根拠確認前','利用人数は要確認','lead_only')
PUBLIC_GROUPS=[
    ('映像を見る',['Blu-ray','DVD','HDMI入力','キャスト','動画配信','スピーカー','音量制限'],'鑑賞会で使う映像機器や接続条件を掲載します。'),
    ('グッズを広げる・撮影する',['装飾可否','マスキングテープ','養生テープ','粘着フック','画鋲・ピン','バルーン','ベッド装飾','原状復帰','祭壇テーブル','テーブル寸法','使用可能な壁面','白壁','自然光','推し色照明','全身鏡','撮影スペース','撮影制限'],'グッズの設置や撮影に関係する設備・スペースを掲載します。'),
    ('ケーキ・飲食',['ケーキ持込','ホテル提供ケーキ','推し色ケーキ','外部配送','事前受取','冷蔵保管','ケーキスタンド','食器・カトラリー','飲食持込','デリバリー','電子レンジ','冷蔵庫','ゴミ処理'],'ケーキの手配、受け取り、保管、飲食の条件を掲載します。'),
    ('遠征時の身支度',['チェックイン前荷物預かり','チェックアウト後荷物預かり','最終チェックイン','チェックアウト','ヘアアイロン','衣類スチーマー','着替えやすさ'],'荷物預かりや身支度など、遠征時に役立つ情報を掲載します。')
]

def drec(r,key):
    v=(r.get('details') or {}).get(key)
    if isinstance(v,dict): return v
    if isinstance(v,list): return {'status':v[0] if v else '','note':v[1] if len(v)>1 else ''}
    return {'status':'','note':'','scope':'','sourceIds':[],'checkedAt':''}

def status_cls(s): return {'確認済み':'ok','条件付き':'cond','報告あり':'report'}.get(s,'')

def source_map(r): return {s.get('id'):s for s in r.get('sources',[]) if s.get('id')}

def contains_forbidden(*values):
    text=' '.join(str(v or '') for v in values)
    return any(term in text for term in FORBIDDEN_PUBLIC_TERMS)

def is_public_detail(item):
    if not isinstance(item,dict) or item.get('status') not in PUBLIC_STATUSES: return False
    note=str(item.get('note') or '').strip()
    return bool(note) and not contains_forbidden(item.get('note'),item.get('value'),item.get('scope'))

def is_public_source(source):
    if not source or source.get('sourceType') in {'third_party_search_lead','v1_search_lead'}: return False
    return bool(source.get('label') or source.get('url')) and not contains_forbidden(source.get('label'),source.get('note'),source.get('sourceType'),source.get('evidenceType'))

def public_detail_items(r):
    items=[]
    for key,item in (r.get('details') or {}).items():
        if is_public_detail(item): items.append((key,str(item.get('note') or '').strip(),item))
    for item in r.get('evidenceReports') or []:
        if is_public_detail(item):
            key=str(item.get('key') or '').strip()
            text=str(item.get('value') or item.get('note') or '').strip()
            if key and text: items.append((key,text,item))
    return items

def field_html(key,text):
    return f'<div class="fact"><div class="key">{esc(key)}</div><div class="value">{esc(text)}</div></div>'

def group_html(r,title,keys,desc,exclude_keys=None,seen_text=None):
    exclude_keys=exclude_keys or set()
    seen=seen_text if seen_text is not None else set()
    fields=[]
    for key in keys:
        if key in exclude_keys: continue
        item=drec(r,key)
        if not is_public_detail(item): continue
        text=str(item.get('note') or '').strip()
        if not text or text in seen: continue
        seen.add(text)
        fields.append(field_html(key,text))
    if not fields: return ''
    return f'<section class="section"><h2>{esc(title)}</h2><p>{esc(desc)}</p><div class="facts">{"".join(fields)}</div></section>'

def evidence_reports_html(r,seen_text=None):
    cards=[]; seen=seen_text if seen_text is not None else set()
    for item in r.get('evidenceReports') or []:
        if not is_public_detail(item): continue
        key=str(item.get('key') or item.get('category') or '').strip()
        text=str(item.get('value') or item.get('note') or '').strip()
        if not key or not text or text in seen: continue
        seen.add(text)
        cards.append(f'<article class="report-item"><b>{esc(key)}</b><p>{esc(text)}</p></article>')
    if not cards: return ''
    return '<section class="section report-section"><h2>宿泊者情報</h2><p>宿泊者から寄せられた内容を、利用時の参考情報として掲載しています。</p><div class="report-grid">'+''.join(cards)+'</div></section>'

def sources_html(r):
    cards=[]
    for s in r.get('sources',[]):
        if not is_public_source(s): continue
        label=' / '.join(str(v) for v in (s.get('platform'),s.get('label')) if v)
        source_url=str(s.get('url') or '').strip()
        link=f'<a href="{esc(source_url)}" target="_blank" rel="noopener noreferrer">{esc(label)}</a>' if source_url else f'<span>{esc(label)}</span>'
        cards.append(f'<div class="source">{link}</div>')
    return ''.join(cards)

def occupancy_label(r):
    o=r.get('occupancy') or {}; mn=o.get('minGuests'); mx=o.get('maxGuests')
    if mn is not None and mx is not None: return f'{mn}〜{mx}名'
    if mx is not None: return f'最大{mx}名'
    if mn is not None: return f'{mn}名〜'
    if o.get('soloAllowed') in (True,'確認済み','可'): return '1名利用可'
    return ''

def address_label(r):
    addr=r.get('address') or {}
    parts=[]
    if addr.get('postalCode'): parts.append('〒'+str(addr['postalCode']))
    parts.extend(str(addr.get(k)) for k in ('region','locality','street') if addr.get(k))
    return ' '.join(parts)

def public_scope(r):
    scope=str(r.get('room') or '').strip()
    if not scope or contains_forbidden(scope) or scope in {'会場遠征向けホテル候補','推し活向けホテル候補'}: return ''
    return scope

def public_venue_rows(r):
    rows=[]
    for v in r.get('venueRoutes') or []:
        if v.get('status') not in PUBLIC_STATUSES: continue
        venue=str(v.get('venue') or '').strip()
        if not venue: continue
        details=[]
        if v.get('totalMinutes') is not None: details.append(f'{v.get("totalMinutes")}分')
        if v.get('walkMinutes') is not None: details.append(f'徒歩{v.get("walkMinutes")}分')
        if v.get('transfers') is not None: details.append(f'乗換{v.get("transfers")}回')
        if v.get('distanceKm') not in (None,''): details.append(f'{v.get("distanceKm")}km')
        if not details: details.append('対象会場')
        rows.append((venue,' / '.join(details)))
    return rows

def venue_html(r):
    rows=public_venue_rows(r)
    if not rows: return ''
    unique=[]; seen=set()
    for venue,detail in rows:
        if venue in seen: continue
        seen.add(venue)
        unique.append(f'<div class="venue-row"><b>{esc(venue)}</b><span>{esc(detail)}</span></div>')
    return '<section class="section"><h2>会場へのアクセス</h2><p>掲載できる会場情報のみを表示しています。</p>'+''.join(unique)+'</section>'

def public_summary(r):
    area=str(r.get('area') or '').strip(); station=str(r.get('station') or '').strip()
    rows=public_venue_rows(r)
    if rows:
        venues='、'.join(v for v,_ in rows[:3])
        return f'{area}の{station}を拠点に、{venues}への遠征で検討しやすいホテルです。'
    return f'{area}の{station}周辺で、ライブ・イベント遠征の宿泊先として検討しやすいホテルです。'

def booking_html(r):
    b=r.get('bookingLinks') or {}; links=[]
    for key,label in (('rakuten','楽天トラベル'),('jalan','じゃらんnet')):
        url=str(b.get(key) or '').strip()
        if url:
            links.append(f'<a class="cta" href="{esc(url)}" target="_blank" rel="sponsored nofollow noopener noreferrer">{esc(label)}で空室・料金を確認</a>')
    return ''.join(links)

def hero_media_html(r):
    candidates=[]
    if r.get('image'): candidates.append(r.get('image'))
    candidates.extend(r.get('images') or [])
    image=next((str(v).strip() for v in candidates if isinstance(v,str) and re.match(r'^https?://',v.strip(),re.I)), '')
    if image:
        return f'<figure class="hero-media"><img src="{esc(image)}" alt="{esc(r.get("hotel"))}の掲載画像" loading="eager" decoding="async"></figure>'
    return '<figure class="hero-media"><div class="image-placeholder"><span>PHOTO</span><strong>外観画像未登録</strong><small>公式素材を確認後に掲載</small></div></figure>'

def embed_records(records):
    text=INDEX.read_text(encoding='utf-8')
    browser_records=compact_records(records)
    block='<script>\nwindow.OSHIYADO_RECORDS = '+json.dumps(browser_records,ensure_ascii=False,separators=(',',':'))+';\n</script>'
    patterns=[
        r'<script>\s*const D=.*?window\.OSHIYADO_RECORDS\s*=\s*\[.*?\];\s*</script>',
        r'<script>\s*window\.OSHIYADO_RECORDS\s*=\s*\[.*?\];\s*</script>'
    ]
    for pat in patterns:
        new,n=re.subn(pat,lambda m:block,text,count=1,flags=re.S)
        if n:
            INDEX.write_text(new,encoding='utf-8'); return
    raise SystemExit('ERROR: index.html の OSHIYADO_RECORDS ブロックを更新できません')

def update_home_featured(records):
    text=INDEX.read_text(encoding='utf-8')
    eligible=[r for r in records if seo_indexable(r)]
    eligible.sort(key=lambda r:(r.get('checked') or '', r.get('hotel') or ''), reverse=True)
    cards=[]
    for r in eligible[:3]:
        cards.append(f'<a class="info-cell" href="hotels/{esc(r["id"])}/"><b>{esc(r["hotel"])}</b><span>{esc(public_summary(r))}</span></a>')
    cards.append('<a class="info-cell" href="hotels/"><b>掲載ホテル一覧</b><span>検索対象のホテルと推し活対応情報を一覧で確認できます。</span></a>')
    section=(
        '<section class="section" id="hotel-pages"><div class="container"><div class="section-head"><div>'
        '<h2>確認情報が揃ったホテル詳細</h2><p>主要項目と情報源が一定以上揃ったページを優先して案内します。</p>'
        '</div></div><div class="info-strip">'+''.join(cards)+'</div></div></section>'
    )
    new,n=re.subn(r'<section class="section" id="hotel-pages">.*?</section>',section,text,count=1,flags=re.S)
    if not n: raise SystemExit('ERROR: index.html の hotel-pages セクションを更新できません')
    INDEX.write_text(new,encoding='utf-8')

def build_detail(r,records):
    slug=r['id']; out=ROOT/'hotels'/slug; out.mkdir(parents=True,exist_ok=True)
    title=f"{r['hotel']}の推し活条件｜{r['room']}｜推し宿"
    desc=(f"{r['hotel']}の{r['room']}を推し活目線で確認。装飾、Blu-ray・接続方法、ケーキ、祭壇・撮影、ライブ遠征向け条件を確認済み・条件付き・未確認に分けて掲載。")[:155]
    canonical=f'{SITE_ORIGIN}/hotels/{slug}/'
    addr=r.get('address') or {}
    venue=''.join(f'<div class="venue-row"><b>{esc(v.get("venue"))}</b><span class="status {status_cls(v.get("status","未確認"))}">{esc(v.get("status","未確認"))}</span>{esc(v.get("note",""))}</div>' for v in r.get('venueRoutes',[])) or '<div class="venue-row">登録なし</div>'
    sources=sources_html(r)
    research=research_html(r)
    reports=evidence_reports_html(r,seen_text)
    hero_media=hero_media_html(r)
    nearby=[rr for rr in records if rr['id']!=slug and (rr.get('area')==r.get('area') or rr.get('subarea')==r.get('subarea'))]
    related_records=(nearby+[rr for rr in records if rr['id']!=slug and rr not in nearby])[:4]
    related=''.join(f'<a href="../{esc(rr["id"])}/"><b>{esc(rr["hotel"])}</b><span>{esc(rr["area"])} / {esc(rr["room"])}</span></a>' for rr in related_records)
    ld={'@context':'https://schema.org','@graph':[{'@type':'WebPage','@id':canonical,'url':canonical,'name':title,'description':desc,'dateModified':r.get('checked'),'inLanguage':'ja'},{'@type':'Hotel','name':r['hotel'],'url':r.get('officialUrl'),'address':({'@type':'PostalAddress','postalCode':addr.get('postalCode'),'addressRegion':addr.get('region'),'addressLocality':addr.get('locality'),'streetAddress':addr.get('street'),'addressCountry':'JP'} if addr else None)},{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'推し宿','item':f'{SITE_ORIGIN}/'},{'@type':'ListItem','position':2,'name':'ホテル一覧','item':f'{SITE_ORIGIN}/hotels/'},{'@type':'ListItem','position':3,'name':r['hotel'],'item':canonical}]}]}
    first=''.join(field_html(r,k) for k in ['装飾可否','Blu-ray','HDMI入力','推し色ケーキ','祭壇テーブル','チェックイン前荷物預かり'])
    groups=''.join(group_html(r,*g) for g in GROUPS[:3]); trip=group_html(r,*GROUPS[3])
    pending_js="<script>document.addEventListener('click',function(e){var b=e.target.closest('.affiliate-pending');if(!b)return;var n=b.closest('.sidebox').querySelector('.affiliate-note');if(n){n.hidden=false;n.textContent=(b.dataset.provider||'予約サイト')+'のアフィリエイトリンクは準備中です。';}});</script>"
    robots_marker='true' if seo_indexable(r) else 'false'
    page=f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow" data-seo-indexable="{robots_marker}"><meta name="referrer" content="strict-origin-when-cross-origin"><title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{canonical}"><meta property="og:type" content="article"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{canonical}"><style>{CSS}</style><script type="application/ld+json">{json.dumps(ld,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')}</script></head><body><div class="ad"><div class="container"><b>広告</b><span>本サイトはアフィリエイト広告を利用しています。</span></div></div><header class="top"><div class="container nav"><a class="logo" href="../../index.html">推し宿</a><a href="../">ホテル一覧</a><a href="../../editorial-policy.html">調査・更新方針</a><span class="spacer"></span><a href="../../operator.html">運営者情報</a></div></header><main class="container"><nav class="crumb" aria-label="パンくず"><a href="../../index.html">推し宿</a> / <a href="../">ホテル一覧</a> / <span>{esc(r['hotel'])}</span></nav><article><header class="hero"><div class="meta">{esc(r['area'])} / {esc(r['station'])} / {esc(occupancy_label(r))}</div><div class="meta">〒{esc(addr.get('postalCode'))} {esc(addr.get('region'))}{esc(addr.get('locality'))}{esc(addr.get('street'))}</div><h1>{esc(r['hotel'])}</h1><div class="scope">{esc(r['room'])}</div><div class="context">{esc(r.get('officialContext'))}</div><p class="summary">{esc(r['summary'])}</p><div class="updated">最終確認：{esc(r.get('checked'))}　情報は確認日以降に変更される場合があります。</div></header><div class="layout"><div><section class="section"><h2>この客室・対応範囲の推し活条件</h2><p>確認できた事実を項目ごとに分け、断定できない項目は未確認のまま掲載しています。</p><div class="facts">{first}</div></section>{research}{reports}{groups}<section class="section"><h2>ライブ・イベント会場へのアクセス</h2><p>所要時間や乗換回数は実際に確認できた情報だけ確定値として掲載します。</p>{venue}</section>{trip}<section class="section"><h2>情報源・確認根拠</h2><p>ホテル公式情報、予約サイト、第三者情報など、出典の区分を残して掲載しています。</p>{sources}</section><section class="section"><h2>関連する推し活ホテル</h2><div class="related">{related}</div></section></div><aside class="sidebar"><div class="sidebox"><h3>予約サイトで確認</h3><p>空室・料金・実際に予約できる客室・提供内容は楽天トラベル・じゃらんnetで最終確認してください。本サイトでは予約を受け付けません。</p>{booking_html(r)}</div><div class="sidebox"><h3>掲載情報について</h3><p>未確認は「利用不可」という意味ではありません。対象範囲や最新条件は予約前にご確認ください。</p><a class="cta secondary" href="../../editorial-policy.html">調査・更新方針</a></div></aside></div></article></main><footer class="footer"><div class="container"><a href="../../terms.html">利用規約</a><a href="../../privacy.html">プライバシーポリシー</a><a href="../../affiliate-disclosure.html">広告について</a><a href="../../operator.html">運営者情報</a><div class="footnote">掲載情報は確認日以降に変更される場合があります。予約前に予約サイトの最新情報をご確認ください。</div></div></footer>{pending_js}</body></html>'''
    page=page.replace('<header class="hero"><div class="meta">',f'<header class="hero"><div class="hero-grid">{hero_media}<div class="hero-copy"><div class="meta">',1)
    page=page.replace('</div></header><div class="layout">','</div></div></div></header><div class="layout">',1)
    (out/'index.html').write_text(page,encoding='utf-8')

def jp_date(value):
    match=re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$',str(value or ''))
    if not match: return str(value or '')
    return f'{match.group(1)}年{int(match.group(2))}月{int(match.group(3))}日'

def build_detail_public(r,records):
    slug=r['id']; out=ROOT/'hotels'/slug; out.mkdir(parents=True,exist_ok=True)
    hotel=str(r.get('hotel') or '').strip()
    station=str(r.get('station') or '').strip()
    scope=public_scope(r)
    public_items=public_detail_items(r)
    title=(f'{hotel}｜推し活・ライブ遠征向け設備と客室情報｜推し宿'
           if len(public_items)>=2 else f'{hotel}｜{station}・ライブ遠征向けホテル情報｜推し宿')
    desc=(public_summary(r)+' 最寄駅や会場情報、予約サイトをまとめています。')[:155]
    canonical=f'{SITE_ORIGIN}/hotels/{slug}/'
    address=address_label(r)
    meta_items=[str(v).strip() for v in (r.get('area'),station,occupancy_label(r)) if str(v or '').strip()]
    hero_meta=' / '.join(meta_items)
    address_html=f'<div class=\"meta address\">{esc(address)}</div>' if address else ''
    scope_html=f'<div class=\"scope\">{esc(scope)}</div>' if scope else ''
    updated=f'<div class=\"updated\">最終更新：{esc(jp_date(r.get("checked")))}</div>' if r.get('checked') else ''
    reason_titles=[]
    for group_title,group_keys,_ in PUBLIC_GROUPS:
        if any(is_public_detail(drec(r,key)) for key in group_keys):
            reason_titles.append(group_title)
    reason_html=''
    if len(reason_titles)>=2:
        reason_html='<section class=\"section\"><h2>このホテルが遠征候補になる理由</h2><ul>'+''.join(f'<li>{esc(text)}の情報が確認できます。</li>' for text in reason_titles)+'</ul></section>'
    seen_text=set()
    groups=''.join(group_html(r,*group,seen_text=seen_text) for group in PUBLIC_GROUPS)
    access=venue_html(r)
    reports=evidence_reports_html(r,seen_text)
    sources=sources_html(r)
    source_section=('<section class=\"section\"><h2>主な出典</h2><div>'+sources+'</div></section>' if sources else '')
    booking=booking_html(r)
    booking_box=('<div class=\"sidebox\"><h3>予約サイトで確認</h3><p>空室、料金、客室・プランの内容は各予約サイトでご確認ください。</p>'+booking+'</div>' if booking else '')
    related_records=[rr for rr in records if rr['id']!=slug and (rr.get('area')==r.get('area') or rr.get('subarea')==r.get('subarea'))]
    related_records=(related_records+[rr for rr in records if rr['id']!=slug and rr not in related_records])[:4]
    related=''.join(
        f'<a href=\"../{esc(rr["id"])}/\"><b>{esc(rr["hotel"])}</b><span>{esc(rr.get("area"))} / {esc(rr.get("station"))}</span></a>'
        for rr in related_records
    )
    related_section=('<section class=\"section\"><h2>同じエリアの遠征ホテル</h2><div class=\"related\">'+related+'</div></section>' if related else '')
    hotel_ld={'@type':'Hotel','@id':canonical+'#hotel','name':hotel,'url':canonical}
    if r.get('officialUrl'): hotel_ld['sameAs']=r['officialUrl']
    if address:
        hotel_ld['address']={'@type':'PostalAddress','streetAddress':address,'addressCountry':'JP'}
    if r.get('image') and re.match(r'^https?://',str(r.get('image')),re.I): hotel_ld['image']=r['image']
    ld={'@context':'https://schema.org','@graph':[
        {'@type':'WebPage','@id':canonical,'url':canonical,'name':title,'description':desc,'dateModified':r.get('checked'),'inLanguage':'ja','mainEntity':{'@id':canonical+'#hotel'}},
        hotel_ld,
        {'@type':'BreadcrumbList','itemListElement':[
            {'@type':'ListItem','position':1,'name':'推し宿','item':f'{SITE_ORIGIN}/'},
            {'@type':'ListItem','position':2,'name':'ホテル一覧','item':f'{SITE_ORIGIN}/hotels/'},
            {'@type':'ListItem','position':3,'name':hotel,'item':canonical}
        ]}
    ]}
    hero_media=hero_media_html(r)
    ld_json=json.dumps(ld,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
    page=f'''<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,follow\" data-seo-indexable=\"{'true' if seo_indexable(r) else 'false'}\"><meta name=\"referrer\" content=\"strict-origin-when-cross-origin\"><title>{esc(title)}</title><meta name=\"description\" content=\"{esc(desc)}\"><link rel=\"canonical\" href=\"{canonical}\"><meta property=\"og:type\" content=\"article\"><meta property=\"og:title\" content=\"{esc(title)}\"><meta property=\"og:description\" content=\"{esc(desc)}\"><meta property=\"og:url\" content=\"{canonical}\"><style>{CSS}</style><script type=\"application/ld+json\">{ld_json}</script></head><body><div class=\"ad\"><div class=\"container\"><b>広告</b><span>本サイトはアフィリエイト広告を利用しています。</span></div></div><header class=\"top\"><div class=\"container nav\"><a class=\"logo\" href=\"../../index.html\">推し宿</a><a href=\"../\">ホテル一覧</a><a href=\"../../editorial-policy.html\">掲載方針</a><span class=\"spacer\"></span><a href=\"../../operator.html\">運営者情報</a></div></header><main class=\"container\"><nav class=\"crumb\" aria-label=\"パンくず\"><a href=\"../../index.html\">推し宿</a> / <a href=\"../\">ホテル一覧</a> / <span>{esc(hotel)}</span></nav><article><header class=\"hero\"><div class=\"hero-grid\">{hero_media}<div class=\"hero-copy\"><div class=\"meta\">{esc(hero_meta)}</div>{address_html}<h1>{esc(hotel)}</h1>{scope_html}<p class=\"summary\">{esc(public_summary(r))}</p>{updated}</div></div></header><div class=\"layout\"><div>{reason_html}{access}{groups}{reports}{source_section}{related_section}</div><aside class=\"sidebar\">{booking_box}<div class=\"sidebox\"><h3>掲載情報について</h3><p>設備・サービス・プラン内容は変更される場合があります。予約時は宿泊する客室・プランの最新情報をご確認ください。</p><a class=\"cta secondary\" href=\"../../editorial-policy.html\">掲載方針を見る</a></div></aside></div></article></main><footer class=\"footer\"><div class=\"container\"><a href=\"../../terms.html\">利用規約</a><a href=\"../../privacy.html\">プライバシーポリシー</a><a href=\"../../affiliate-disclosure.html\">広告について</a><a href=\"../../operator.html\">運営者情報</a><div class=\"footnote\">掲載情報は確認日以降に変更される場合があります。予約前に予約サイトの最新情報をご確認ください。</div></div></footer></body></html>'''
    (out/'index.html').write_text(page,encoding='utf-8')

def build_listing(records):
    outdir=ROOT/'hotels'; outdir.mkdir(exist_ok=True)
    def listing_card(r):
        scope=public_scope(r)
        scope_html=f'<div class="scope">{esc(scope)}</div>' if scope else ''
        return f'<article class="card"><div class="meta">{esc(r["area"])} / {esc(r["station"])}</div><h2><a href="{esc(r["id"])}/">{esc(r["hotel"])}</a></h2>{scope_html}<p>{esc(public_summary(r))}</p><a class="more" href="{esc(r["id"])}/">ホテル情報の詳細を見る</a></article>'
    cards=''.join(listing_card(r) for r in records)
    ld={'@context':'https://schema.org','@graph':[{'@type':'CollectionPage','url':f'{SITE_ORIGIN}/hotels/','name':'推し活ホテル一覧｜推し宿','description':'推し活に使いやすいホテルを、客室・対応範囲ごとの条件から確認できる一覧ページ。'},{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'推し宿','item':f'{SITE_ORIGIN}/'},{'@type':'ListItem','position':2,'name':'ホテル一覧','item':f'{SITE_ORIGIN}/hotels/'}]}]}
    css='''*{box-sizing:border-box}body{margin:0;background:#f5f5f2;color:#222;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;line-height:1.7}a{color:inherit;text-decoration:none}.container{width:min(1080px,calc(100% - 32px));margin:auto}.top{background:#fff;border-bottom:1px solid #ddd}.top:after{content:"";display:block;height:3px;background:linear-gradient(90deg,#111 0 88%,#00a6c8 88% 100%)}.nav{height:66px;display:flex;align-items:center;gap:20px}.logo{font-size:22px;font-weight:950}.nav .back{margin-left:auto;font-size:13px}.crumb{font-size:12px;color:#777;padding:18px 0}.crumb a{text-decoration:underline}.hero{padding:24px 0 10px}.hero h1{font-size:42px;letter-spacing:-.04em;margin:0}.hero p{color:#666}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:18px 0 48px}.card{background:#fff;border:1px solid #cfcfcf;border-left:5px solid #111;padding:20px}.card:hover{border-left-color:#00a6c8;border-color:#8c9da1}.meta{font-size:11px;color:#777;font-weight:800}.card h2{margin:4px 0;font-size:23px}.card h2 a:hover{text-decoration:underline;text-underline-offset:4px}.scope{font-size:12px;font-weight:900}.card p{font-size:13px;color:#666}.more{display:block;margin-top:15px;background:#111;color:#fff;text-align:center;padding:10px;font-weight:900}.footer{background:#111;color:#ddd;padding:24px 0;font-size:12px}@media(max-width:700px){.grid{grid-template-columns:1fr}.hero h1{font-size:32px}.container{width:min(100% - 20px,1080px)}}'''
    page=f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>推し活ホテル一覧｜客室ごとの条件から探す｜推し宿</title><meta name="description" content="本人不在の誕生日、鑑賞会、祭壇・撮影、ライブ遠征など、推し活用途に使いやすいホテルを客室・対応範囲ごとの条件で確認できる一覧ページ。"><link rel="canonical" href="{SITE_ORIGIN}/hotels/"><meta property="og:type" content="website"><meta property="og:title" content="推し活ホテル一覧｜推し宿"><meta property="og:description" content="推し活用途に使いやすいホテルを、客室・対応範囲ごとの確認情報から探せます。"><meta property="og:url" content="{SITE_ORIGIN}/hotels/"><style>{css}</style><script type="application/ld+json">{json.dumps(ld,ensure_ascii=False,separators=(',',':'))}</script></head><body><header class="top"><div class="container nav"><a class="logo" href="../index.html">推し宿</a><a class="back" href="../index.html#hotels">条件検索へ戻る</a></div></header><main class="container"><nav class="crumb"><a href="../index.html">推し宿</a> / ホテル一覧</nav><div class="hero"><h1>推し活ホテル一覧</h1><p>ホテル名だけではなく、客室・推し活対応情報ごとに装飾、映像、ケーキ、祭壇・撮影、遠征条件を確認しています。</p></div><div class="grid">{cards}</div></main><footer class="footer"><div class="container">掲載情報は確認日以降に変更される場合があります。予約前に予約サイトの最新情報をご確認ください。</div></footer></body></html>'''
    page=page.replace('</style>','.pagination{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin:18px 0 0}.pagination button,.page-gap{min-width:34px;height:34px;border:1px solid #aaa;background:#fff;color:#222;padding:0 9px;font-size:11px;font-weight:900;text-align:center}.pagination button:hover:not(:disabled){background:#f2f2f2}.pagination button[aria-current="page"]{background:#111;color:#fff;border-color:#111}.pagination button:disabled{cursor:not-allowed;opacity:.45}.page-gap{display:grid;place-items:center;border-color:transparent;background:transparent;color:#777}@media(max-width:700px){.pagination{gap:4px}.pagination button,.page-gap{min-width:32px;height:32px;padding:0 7px}} </style>',1)
    pagination_script='''<script>(function(){var grid=document.querySelector('.grid');if(!grid)return;var cards=Array.from(grid.children),size=10,total=Math.ceil(cards.length/size),current=1,nav=document.createElement('nav');nav.className='pagination';nav.setAttribute('aria-label','ホテル一覧のページ移動');grid.after(nav);function draw(){cards.forEach(function(card,index){card.hidden=index<(current-1)*size||index>=current*size});if(total<=1){nav.hidden=true;return}var pages=[1];if(current>3)pages.push('start');for(var p=Math.max(2,current-1);p<=Math.min(total-1,current+1);p++)pages.push(p);if(current<total-2)pages.push('end');if(total>1)pages.push(total);var unique=[];pages.forEach(function(p){if(unique[unique.length-1]!==p)unique.push(p)});nav.hidden=false;nav.innerHTML='<button type="button" data-page="'+(current-1)+'" '+(current===1?'disabled':'')+'>前へ</button>'+unique.map(function(p){return typeof p==='string'?'<span class="page-gap" aria-hidden="true">...</span>':'<button type="button" data-page="'+p+'" '+(p===current?'aria-current="page"':'')+' aria-label="'+p+'ページ目">'+p+'</button>'}).join('')+'<button type="button" data-page="'+(current+1)+'" '+(current===total?'disabled':'')+'>次へ</button>'}nav.addEventListener('click',function(event){var button=event.target.closest('button[data-page]');if(!button)return;var next=Number(button.dataset.page);if(!Number.isInteger(next)||next<1||next>total)return;current=next;draw();window.scrollTo({top:grid.offsetTop-90,behavior:'smooth'})});draw()})();</script>'''
    page=page.replace('</body></html>',pagination_script+'</body></html>')
    (outdir/'index.html').write_text(page,encoding='utf-8')

def main():
    records=load_records(); embed_records(records); update_home_featured(records)
    EXPORT.write_text(json.dumps(compact_records(records),ensure_ascii=False,indent=2),encoding='utf-8')
    build_listing(records)
    for r in records: build_detail_public(r,records)
    print(f'Built site from data/hotels.json: {len(records)} records.')

if __name__=='__main__': main()
