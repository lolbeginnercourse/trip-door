#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import json, html as H, re
from datetime import date

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data' / 'hotels.json'
INDEX = ROOT / 'index.html'
EXPORT = ROOT / 'records.json'

GROUPS = [
    ('装飾・祭壇・撮影',['装飾可否','マスキングテープ','養生テープ','粘着フック','画鋲・ピン','バルーン','ベッド装飾','原状復帰','祭壇テーブル','テーブル寸法','使用可能な壁面','白壁','自然光','推し色照明','全身鏡','撮影スペース','撮影制限'],'飾り付け方法と、祭壇・撮影に必要な空間条件を分けて確認します。'),
    ('映像・音響',['Blu-ray','DVD','HDMI入力','キャスト','動画配信','スピーカー','音量制限'],'再生機器・接続方法・配信・音量条件を分けて掲載します。'),
    ('ケーキ・飲食',['ケーキ持込','ホテル提供ケーキ','推し色ケーキ','外部配送','事前受取','冷蔵保管','ケーキスタンド','食器・カトラリー','飲食持込','デリバリー','電子レンジ','冷蔵庫','ゴミ処理'],'ケーキ、受取・保管、飲食持込やデリバリーを別項目として扱います。'),
    ('ライブ遠征・身支度',['チェックイン前荷物預かり','チェックアウト後荷物預かり','最終チェックイン','チェックアウト','ヘアアイロン','衣類スチーマー','全身鏡','着替えやすさ'],'荷物預かり、チェックイン、身支度設備など遠征時に困りやすい条件を確認します。')
]

CSS = r'''
:root{--bg:#f5f5f2;--surface:#fff;--ink:#111;--text:#232326;--muted:#6b6d72;--line:#dedede;--cyan:#00a6c8;--ok:#157a51;--cond:#966b10;--unk:#73777e;--max:1120px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;line-height:1.72}a{color:inherit;text-decoration:none}a:focus-visible,button:focus-visible{outline:3px solid rgba(0,166,200,.3);outline-offset:2px}.container{width:min(var(--max),calc(100% - 32px));margin:auto}.ad{background:#111;color:#fff;font-size:12px}.ad .container{min-height:34px;display:flex;align-items:center;gap:10px}.ad b{background:#fff;color:#111;padding:1px 7px;font-size:10px}.top{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:30}.top:after{content:"";display:block;height:3px;background:linear-gradient(90deg,#111 0 88%,var(--cyan) 88% 100%)}.nav{height:66px;display:flex;align-items:center;gap:24px}.logo{font-size:22px;font-weight:950;letter-spacing:-.04em}.nav a:not(.logo){font-size:13px;color:#555}.nav .spacer{margin-left:auto}.crumb{font-size:12px;color:#777;padding:18px 0}.crumb a{text-decoration:underline;text-underline-offset:3px}.hero{background:#fff;border:1px solid #cfcfcf;border-left:6px solid #111;padding:28px;margin-bottom:20px}.meta{font-size:12px;color:#777;font-weight:800}.hero h1{font-size:clamp(30px,5vw,48px);line-height:1.15;letter-spacing:-.045em;margin:6px 0 8px}.scope{font-size:16px;font-weight:900}.context{font-size:12px;color:#666;margin-top:4px}.summary{max-width:760px;color:#555}.tags{display:flex;gap:7px;flex-wrap:wrap;margin:18px 0 0}.tag{border:1px solid #bbb;background:#fff;padding:5px 8px;font-size:12px;font-weight:800}.updated{margin-top:16px;font-size:11px;color:#777}.layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:20px;align-items:start}.section{background:#fff;border:1px solid var(--line);margin-bottom:16px;padding:22px}.section h2{font-size:22px;margin:0 0 5px;letter-spacing:-.025em}.section>p{font-size:13px;color:#666;margin:0 0 16px}.facts{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line);border-left:1px solid var(--line)}.fact{padding:12px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.fact .key{font-size:11px;color:#777;font-weight:850}.fact .value{font-size:13px;margin-top:4px}.fact-meta{font-size:10px;color:#81858a;margin-top:5px;line-height:1.5}.status{display:inline-block;margin-right:7px;border:1px solid currentColor;padding:1px 5px;font-size:10px;font-weight:950}.status.ok{color:var(--ok)}.status.cond{color:var(--cond)}.status.unk{color:var(--unk)}.venue-row{border-top:1px solid var(--line);padding:12px 0}.venue-row:first-child{border-top:0}.venue-row b{display:block}.sidebar{position:sticky;top:90px}.sidebox{background:#fff;border:1px solid var(--line);padding:18px;margin-bottom:12px}.sidebox h3{margin:0 0 10px;font-size:15px}.sidebox p{font-size:12px;color:#666}.cta{display:block;width:100%;text-align:center;background:#111;color:#fff;padding:12px;font-weight:900;margin-top:8px;border:1px solid #111;font:inherit;cursor:pointer}.cta.secondary{background:#fff;color:#111}.notice{background:#fff7dd;border:1px solid #d8c16f;padding:12px;font-size:11px;margin-top:10px}.source{padding:12px 0;border-top:1px solid var(--line)}.source:first-child{border-top:0}.source a{font-weight:900;text-decoration:underline;text-underline-offset:3px}.source p{font-size:12px;color:#666;margin:3px 0 0}.source small{color:#888}.related{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.related a{display:block;border:1px solid #bbb;background:#fff;padding:13px}.related b{display:block}.related span{font-size:11px;color:#777}.footer{margin-top:44px;background:#111;color:#ddd}.footer .container{padding:30px 0}.footer a{text-decoration:underline;margin-right:14px;font-size:12px}.footnote{font-size:11px;color:#aaa;margin-top:12px}@media(max-width:800px){.nav a:not(.logo){display:none}.layout{grid-template-columns:1fr}.sidebar{position:static}.facts{grid-template-columns:1fr}.related{grid-template-columns:1fr}.hero{padding:20px}.section{padding:16px}.container{width:min(100% - 20px,var(--max))}}
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
        x={k:v for k,v in r.items() if k not in {'details','sources','reviewCycleDays'}}
        x['details']={k:[d.get('status','未確認'),d.get('note','')] if isinstance(d,dict) else d for k,d in (r.get('details') or {}).items()}
        x['sources']=[{k:s.get(k) for k in ('label','url','note','checkedAt') if s.get(k) is not None} for s in r.get('sources',[])]
        out.append(x)
    return out

def seo_indexable(r):
    verified=sum(1 for d in (r.get('details') or {}).values() if isinstance(d,dict) and d.get('status') in {'確認済み','条件付き'})
    sources=sum(1 for s in r.get('sources',[]) if s.get('url'))
    return verified >= 5 and sources >= 2 and len((r.get('summary') or '').strip()) >= 40

def drec(r,key):
    v=(r.get('details') or {}).get(key)
    if isinstance(v,dict): return v
    if isinstance(v,list): return {'status':v[0],'note':v[1] if len(v)>1 else ''}
    return {'status':'未確認','note':'公式情報または問い合わせで要確認','scope':'','sourceIds':[],'checkedAt':'','nextReviewAt':''}

def status_cls(s): return {'確認済み':'ok','条件付き':'cond'}.get(s,'unk')

def source_map(r): return {s.get('id'):s for s in r.get('sources',[]) if s.get('id')}

def field_html(r,key):
    d=drec(r,key); sm=source_map(r)
    labels=[sm[sid].get('label','') for sid in d.get('sourceIds',[]) if sid in sm]
    meta=[]
    if d.get('scope'): meta.append('対象: '+str(d['scope']))
    if d.get('checkedAt'): meta.append('確認: '+str(d['checkedAt']))
    if labels: meta.append('根拠: '+' / '.join(labels))
    return f'<div class="fact"><div class="key">{esc(key)}</div><div class="value"><span class="status {status_cls(d.get("status"))}">{esc(d.get("status","未確認"))}</span>{esc(d.get("note",""))}</div>{("<div class=\"fact-meta\">"+esc(" / ".join(meta))+"</div>") if meta else ""}</div>'

def group_html(r,title,keys,desc):
    return f'<section class="section"><h2>{esc(title)}</h2><p>{esc(desc)}</p><div class="facts">{"".join(field_html(r,k) for k in keys)}</div></section>'

def occupancy_label(r):
    o=r.get('occupancy') or {}; mn=o.get('minGuests'); mx=o.get('maxGuests'); solo=o.get('soloAllowed','未確認')
    if mn is not None and mx is not None: return f'{mn}〜{mx}名'
    if mx is not None: return f'最大{mx}名'
    if mn is not None: return f'{mn}名〜'
    if solo in (True,'確認済み','可'): return '1名利用可 / 上限要確認'
    return '利用人数は要確認'

def booking_html(r):
    b=r.get('bookingLinks') or {}
    def cta(provider,label,key,secondary=False):
        url=(b.get(key) or '').strip(); cls='cta'+(' secondary' if secondary else '')
        if url: return f'<a class="{cls}" href="{esc(url)}" target="_blank" rel="sponsored nofollow noopener noreferrer">{esc(label)}</a>'
        return f'<button class="{cls} affiliate-pending" type="button" data-provider="{esc(provider)}">{esc(label)}</button>'
    pending=not b.get('rakuten') or not b.get('jalan')
    return cta('楽天トラベル','楽天トラベルで空室・料金を確認（広告）','rakuten')+cta('じゃらんnet','じゃらんnetで空室・料金を確認（広告）','jalan',True)+(('<div class="notice affiliate-note" hidden>予約サイトへのアフィリエイトリンクは準備中です。</div>') if pending else '')

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
        cards.append(f'<a class="info-cell" href="hotels/{esc(r["id"])}/"><b>{esc(r["hotel"])}</b><span>{esc(r["summary"])}</span></a>')
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
    canonical=f'https://YOUR-DOMAIN/hotels/{slug}/'
    addr=r.get('address') or {}
    venue=''.join(f'<div class="venue-row"><b>{esc(v.get("venue"))}</b><span class="status {status_cls(v.get("status","未確認"))}">{esc(v.get("status","未確認"))}</span>{esc(v.get("note",""))}</div>' for v in r.get('venueRoutes',[])) or '<div class="venue-row">登録なし</div>'
    sources=''.join(f'<div class="source"><a href="{esc(s.get("url"))}" target="_blank" rel="noopener noreferrer">{esc(s.get("label"))}</a><p>{esc(s.get("note"))}</p><small>確認: {esc(s.get("checkedAt") or r.get("checked"))}</small></div>' for s in r.get('sources',[]))
    related=''.join(f'<a href="../{esc(rr["id"])}/"><b>{esc(rr["hotel"])}</b><span>{esc(rr["area"])} / {esc(rr["room"])}</span></a>' for rr in records if rr['id']!=slug)
    ld={'@context':'https://schema.org','@graph':[{'@type':'WebPage','@id':canonical,'url':canonical,'name':title,'description':desc,'dateModified':r.get('checked'),'inLanguage':'ja'},{'@type':'Hotel','name':r['hotel'],'url':r.get('officialUrl'),'address':({'@type':'PostalAddress','postalCode':addr.get('postalCode'),'addressRegion':addr.get('region'),'addressLocality':addr.get('locality'),'streetAddress':addr.get('street'),'addressCountry':'JP'} if addr else None)},{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'推し宿','item':'https://YOUR-DOMAIN/'},{'@type':'ListItem','position':2,'name':'ホテル一覧','item':'https://YOUR-DOMAIN/hotels/'},{'@type':'ListItem','position':3,'name':r['hotel'],'item':canonical}]}]}
    first=''.join(field_html(r,k) for k in ['装飾可否','Blu-ray','HDMI入力','推し色ケーキ','祭壇テーブル','チェックイン前荷物預かり'])
    groups=''.join(group_html(r,*g) for g in GROUPS[:3]); trip=group_html(r,*GROUPS[3])
    pending_js="<script>document.addEventListener('click',function(e){var b=e.target.closest('.affiliate-pending');if(!b)return;var n=b.closest('.sidebox').querySelector('.affiliate-note');if(n){n.hidden=false;n.textContent=(b.dataset.provider||'予約サイト')+'のアフィリエイトリンクは準備中です。';}});</script>"
    robots_marker='true' if seo_indexable(r) else 'false'
    page=f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow" data-seo-indexable="{robots_marker}"><meta name="referrer" content="strict-origin-when-cross-origin"><title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{canonical}"><meta property="og:type" content="article"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{canonical}"><style>{CSS}</style><script type="application/ld+json">{json.dumps(ld,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')}</script></head><body><div class="ad"><div class="container"><b>広告</b><span>本サイトはアフィリエイト広告を利用しています。</span></div></div><header class="top"><div class="container nav"><a class="logo" href="../../index.html">推し宿</a><a href="../">ホテル一覧</a><a href="../../editorial-policy.html">調査・更新方針</a><span class="spacer"></span><a href="../../operator.html">運営者情報</a></div></header><main class="container"><nav class="crumb" aria-label="パンくず"><a href="../../index.html">推し宿</a> / <a href="../">ホテル一覧</a> / <span>{esc(r['hotel'])}</span></nav><article><header class="hero"><div class="meta">{esc(r['area'])} / {esc(r['station'])} / {esc(occupancy_label(r))}</div><div class="meta">〒{esc(addr.get('postalCode'))} {esc(addr.get('region'))}{esc(addr.get('locality'))}{esc(addr.get('street'))}</div><h1>{esc(r['hotel'])}</h1><div class="scope">{esc(r['room'])}</div><div class="context">{esc(r.get('officialContext'))}</div><p class="summary">{esc(r['summary'])}</p><div class="updated">最終確認：{esc(r.get('checked'))}　情報は確認日以降に変更される場合があります。</div></header><div class="layout"><div><section class="section"><h2>この客室・対応範囲の推し活条件</h2><p>確認できた事実を項目ごとに分け、断定できない項目は未確認のまま掲載しています。</p><div class="facts">{first}</div></section>{groups}<section class="section"><h2>ライブ・イベント会場へのアクセス</h2><p>所要時間や乗換回数は実際に確認できた情報だけ確定値として掲載します。</p>{venue}</section>{trip}<section class="section"><h2>情報源・確認根拠</h2><p>ホテル公式情報を優先し、各項目に確認日と根拠を紐づけて管理しています。</p>{sources}</section><section class="section"><h2>関連する推し活ホテル</h2><div class="related">{related}</div></section></div><aside class="sidebar"><div class="sidebox"><h3>予約サイトで確認</h3><p>空室・料金・実際に予約できる客室・提供内容は楽天トラベル・じゃらんnetで最終確認してください。本サイトでは予約を受け付けません。</p>{booking_html(r)}</div><div class="sidebox"><h3>掲載情報について</h3><p>未確認は「利用不可」という意味ではありません。対象範囲や最新条件は予約前にご確認ください。</p><a class="cta secondary" href="../../editorial-policy.html">調査・更新方針</a></div></aside></div></article></main><footer class="footer"><div class="container"><a href="../../terms.html">利用規約</a><a href="../../privacy.html">プライバシーポリシー</a><a href="../../affiliate-disclosure.html">広告について</a><a href="../../operator.html">運営者情報</a><div class="footnote">掲載情報は確認日以降に変更される場合があります。予約前に予約サイトの最新情報をご確認ください。</div></div></footer>{pending_js}</body></html>'''
    (out/'index.html').write_text(page,encoding='utf-8')

def build_listing(records):
    outdir=ROOT/'hotels'; outdir.mkdir(exist_ok=True)
    cards=''.join(f'<article class="card"><div class="meta">{esc(r["area"])} / {esc(r["station"])}</div><h2><a href="{esc(r["id"])}/">{esc(r["hotel"])}</a></h2><div class="scope">{esc(r["room"])}</div><p>{esc(r["summary"])}</p><a class="more" href="{esc(r["id"])}/">推し活条件の詳細を見る</a></article>' for r in records)
    ld={'@context':'https://schema.org','@graph':[{'@type':'CollectionPage','url':'https://YOUR-DOMAIN/hotels/','name':'推し活ホテル一覧｜推し宿','description':'推し活に使いやすいホテルを、客室・対応範囲ごとの条件から確認できる一覧ページ。'},{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'推し宿','item':'https://YOUR-DOMAIN/'},{'@type':'ListItem','position':2,'name':'ホテル一覧','item':'https://YOUR-DOMAIN/hotels/'}]}]}
    css='''*{box-sizing:border-box}body{margin:0;background:#f5f5f2;color:#222;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;line-height:1.7}a{color:inherit;text-decoration:none}.container{width:min(1080px,calc(100% - 32px));margin:auto}.top{background:#fff;border-bottom:1px solid #ddd}.top:after{content:"";display:block;height:3px;background:linear-gradient(90deg,#111 0 88%,#00a6c8 88% 100%)}.nav{height:66px;display:flex;align-items:center;gap:20px}.logo{font-size:22px;font-weight:950}.nav .back{margin-left:auto;font-size:13px}.crumb{font-size:12px;color:#777;padding:18px 0}.crumb a{text-decoration:underline}.hero{padding:24px 0 10px}.hero h1{font-size:42px;letter-spacing:-.04em;margin:0}.hero p{color:#666}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:18px 0 48px}.card{background:#fff;border:1px solid #cfcfcf;border-left:5px solid #111;padding:20px}.card:hover{border-left-color:#00a6c8;border-color:#8c9da1}.meta{font-size:11px;color:#777;font-weight:800}.card h2{margin:4px 0;font-size:23px}.card h2 a:hover{text-decoration:underline;text-underline-offset:4px}.scope{font-size:12px;font-weight:900}.card p{font-size:13px;color:#666}.more{display:block;margin-top:15px;background:#111;color:#fff;text-align:center;padding:10px;font-weight:900}.footer{background:#111;color:#ddd;padding:24px 0;font-size:12px}@media(max-width:700px){.grid{grid-template-columns:1fr}.hero h1{font-size:32px}.container{width:min(100% - 20px,1080px)}}'''
    page=f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>推し活ホテル一覧｜客室ごとの条件から探す｜推し宿</title><meta name="description" content="本人不在の誕生日、鑑賞会、祭壇・撮影、ライブ遠征など、推し活用途に使いやすいホテルを客室・対応範囲ごとの条件で確認できる一覧ページ。"><link rel="canonical" href="https://YOUR-DOMAIN/hotels/"><meta property="og:type" content="website"><meta property="og:title" content="推し活ホテル一覧｜推し宿"><meta property="og:description" content="推し活用途に使いやすいホテルを、客室・対応範囲ごとの確認情報から探せます。"><meta property="og:url" content="https://YOUR-DOMAIN/hotels/"><style>{css}</style><script type="application/ld+json">{json.dumps(ld,ensure_ascii=False,separators=(',',':'))}</script></head><body><header class="top"><div class="container nav"><a class="logo" href="../index.html">推し宿</a><a class="back" href="../index.html#hotels">条件検索へ戻る</a></div></header><main class="container"><nav class="crumb"><a href="../index.html">推し宿</a> / ホテル一覧</nav><div class="hero"><h1>推し活ホテル一覧</h1><p>ホテル名だけではなく、客室・推し活対応情報ごとに装飾、映像、ケーキ、祭壇・撮影、遠征条件を確認しています。</p></div><div class="grid">{cards}</div></main><footer class="footer"><div class="container">掲載情報は確認日以降に変更される場合があります。予約前に予約サイトの最新情報をご確認ください。</div></footer></body></html>'''
    (outdir/'index.html').write_text(page,encoding='utf-8')

def main():
    records=load_records(); embed_records(records); update_home_featured(records)
    EXPORT.write_text(json.dumps(compact_records(records),ensure_ascii=False,indent=2),encoding='utf-8')
    build_listing(records)
    for r in records: build_detail(r,records)
    print(f'Built site from data/hotels.json: {len(records)} records.')

if __name__=='__main__': main()
