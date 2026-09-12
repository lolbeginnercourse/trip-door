#!/usr/bin/env python3
import json
from datetime import date, timedelta
from pathlib import Path
ROOT=Path(__file__).resolve().parent
records=json.loads((ROOT/'data'/'hotels.json').read_text(encoding='utf-8'))
today=date.today(); soon=today+timedelta(days=30)
over=[]; due=[]; missing_aff=[]; route_unknown=[]; occupancy_unknown=[]; seo_thin=[]
for r in records:
    hotel=r.get('hotel',r.get('id','?'))
    b=r.get('bookingLinks') or {}
    if not b.get('rakuten') or not b.get('jalan'): missing_aff.append(hotel)
    o=r.get('occupancy') or {}
    if o.get('minGuests') is None and o.get('maxGuests') is None: occupancy_unknown.append(hotel)
    verified=sum(1 for d in (r.get('details') or {}).values() if isinstance(d,dict) and d.get('status') in {'確認済み','条件付き'})
    sources=sum(1 for s in r.get('sources',[]) if s.get('url'))
    if verified < 5 or sources < 2 or len((r.get('summary') or '').strip()) < 40: seo_thin.append(f'{hotel} / 確認項目{verified} / 情報源{sources}')
    for k,d in (r.get('details') or {}).items():
        nr=d.get('nextReviewAt') if isinstance(d,dict) else None
        if not nr: continue
        day=date.fromisoformat(nr)
        item=f'{hotel} / {k} / {nr}'
        if day<today: over.append(item)
        elif day<=soon: due.append(item)
    for v in r.get('venueRoutes',[]):
        if v.get('status')!='確認済み': route_unknown.append(f"{hotel} / {v.get('venue','?')}")
print('=== 推し宿 運用レポート ===')
print(f'レコード: {len(records)}')
print(f'期限超過: {len(over)} / 30日以内再確認: {len(due)} / アフィリエイト未設定: {len(missing_aff)} / 会場経路未確認: {len(route_unknown)} / 人数条件未確認: {len(occupancy_unknown)} / SEO公開基準未達: {len(seo_thin)}')
for title,items in [('期限超過',over),('30日以内再確認',due),('アフィリエイト未設定',missing_aff),('会場経路未確認',route_unknown),('人数条件未確認',occupancy_unknown),('SEO公開基準未達',seo_thin)]:
    if items:
        print('\n['+title+']')
        for x in items: print('-',x)
