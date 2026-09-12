#!/usr/bin/env python3
import json, re, subprocess, tempfile
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parent
INDEX=ROOT/'index.html'; DATA=ROOT/'data'/'hotels.json'
ERRORS=[]; WARNS=[]
EXCLUDE={'index.pre-interaction-backup.html'}
VALID_STATUS={'確認済み','条件付き','未確認'}
class AuditParser(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.links=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if d.get('id'): self.ids.append(d['id'])
        if tag=='a' and d.get('href'): self.links.append(d['href'])
def cfg(text,key):
    m=re.search(rf"\b{re.escape(key)}\s*:\s*'([^']*)'",text); return m.group(1) if m else None
def boolcfg(text,key):
    m=re.search(rf"\b{re.escape(key)}\s*:\s*(true|false)",text); return m.group(1)=='true' if m else None
def resolve_internal(html_path,href):
    target=href.split('#',1)[0].split('?',1)[0]
    if not target: return None
    p=(html_path.parent/target).resolve()
    try: p.relative_to(ROOT.resolve())
    except ValueError: return p
    if p.is_dir(): p=p/'index.html'
    return p

def audit_data(records):
    ids=[r.get('id') for r in records]
    if len(ids)!=len(set(ids)): ERRORS.append('data/hotels.json: duplicate record id')
    today=date.today()
    for i,r in enumerate(records,1):
        label=r.get('hotel') or f'record {i}'
        if 'plan' in r: ERRORS.append(f'{label}: root plan field remains; use officialContext/source evidence instead')
        if 'purposes' in r: WARNS.append(f'{label}: manual purposes field remains; purpose matching should be derived')
        if 'capacity' in r: ERRORS.append(f'{label}: legacy capacity field remains; use occupancy')
        occ=r.get('occupancy') or {}
        if 'soloAllowed' not in occ: ERRORS.append(f'{label}: occupancy.soloAllowed missing')
        src_ids={s.get('id') for s in r.get('sources',[]) if s.get('id')}
        if len(src_ids)!=len(r.get('sources',[])): ERRORS.append(f'{label}: every source must have a unique id')
        for key,d in (r.get('details') or {}).items():
            if not isinstance(d,dict): ERRORS.append(f'{label}/{key}: detail must be an object with evidence metadata'); continue
            st=d.get('status','未確認')
            if st not in VALID_STATUS: ERRORS.append(f'{label}/{key}: invalid status {st}')
            if st in {'確認済み','条件付き'}:
                if not d.get('checkedAt'): ERRORS.append(f'{label}/{key}: checkedAt missing')
                if not d.get('sourceIds'): ERRORS.append(f'{label}/{key}: sourceIds missing')
            for sid in d.get('sourceIds',[]):
                if sid not in src_ids: ERRORS.append(f'{label}/{key}: unknown source id {sid}')
            nr=d.get('nextReviewAt')
            if nr:
                try:
                    if date.fromisoformat(nr)<today: WARNS.append(f'{label}/{key}: review overdue ({nr})')
                except ValueError: ERRORS.append(f'{label}/{key}: invalid nextReviewAt {nr}')
        links=r.get('bookingLinks') or {}
        if not links.get('rakuten') or not links.get('jalan'): WARNS.append(f'{label}: affiliate URL missing')
        for provider,url in links.items():
            if url and urlparse(url).scheme not in {'http','https'}: ERRORS.append(f'{label}: invalid {provider} URL')

def main():
    if not DATA.exists(): ERRORS.append('missing canonical data/data/hotels.json'); records=[]
    else:
        try: records=json.loads(DATA.read_text(encoding='utf-8'))
        except Exception as e: ERRORS.append('invalid data/hotels.json: '+str(e)); records=[]
    audit_data(records)
    for r in records:
        verified=sum(1 for d in (r.get('details') or {}).values() if isinstance(d,dict) and d.get('status') in {'確認済み','条件付き'})
        sources=sum(1 for s in r.get('sources',[]) if s.get('url'))
        if verified < 5 or sources < 2 or len((r.get('summary') or '').strip()) < 40:
            WARNS.append(f"{r.get('hotel',r.get('id'))}: SEO detail page stays noindex until quality threshold is met ({verified} verified/conditional fields, {sources} sources)")
    text=INDEX.read_text(encoding='utf-8')
    p=AuditParser(); p.feed(text)
    dup={x for x in p.ids if p.ids.count(x)>1}
    if dup: ERRORS.append('duplicate HTML ids: '+', '.join(sorted(dup)))
    htmls=[p for p in ROOT.rglob('*.html') if p.name not in EXCLUDE]
    for hp in htmls:
        ap=AuditParser(); ap.feed(hp.read_text(encoding='utf-8'))
        for href in ap.links:
            if href.startswith(('#','mailto:','http://','https://','javascript:')): continue
            target=resolve_internal(hp,href)
            if target and not target.exists(): ERRORS.append(f'{hp.relative_to(ROOT)}: missing internal link target {href}')
    ready=boolcfg(text,'publicationReady'); base=cfg(text,'baseUrl') or ''; operator=cfg(text,'operatorName') or ''; email=cfg(text,'contactEmail') or ''; contact=cfg(text,'contactUrl') or ''
    if ready:
        for hp in htmls:
            rel=hp.relative_to(ROOT).as_posix()
            t=hp.read_text(encoding='utf-8')
            if rel not in {'mobile-preview.html','404.html'} and re.search(r'<meta name="robots" content="noindex', t) and 'data-seo-indexable="false"' not in t: ERRORS.append(f'{rel} is still noindex')
            if 'YOUR-DOMAIN' in t: ERRORS.append(f'{rel} still contains YOUR-DOMAIN')
        if not base.startswith('https://'): ERRORS.append('baseUrl must be an https URL')
        if not operator: ERRORS.append('operatorName is empty')
        if not (email or contact): ERRORS.append('contactEmail/contactUrl is empty')
        robots=(ROOT/'robots.txt').read_text(encoding='utf-8') if (ROOT/'robots.txt').exists() else ''
        if 'Disallow: /' in robots: ERRORS.append('robots.txt still blocks all crawling')
        if not (ROOT/'sitemap.xml').exists(): ERRORS.append('sitemap.xml is missing')
    else:
        if 'noindex,nofollow' not in text: WARNS.append('publicationReady=false but index is not noindex,nofollow')
    # Privacy architecture: search/filter state stays in-browser and is never sent by the search UI.
    if 'URLSearchParams(location.search)' in text or 'function syncUrl' in text or 'function parseUrlState' in text: ERRORS.append('search/filter state is coupled to URL query parameters')
    for token,label in [('fetch(', 'fetch'),('XMLHttpRequest','XMLHttpRequest'),('sendBeacon','sendBeacon'),('document.cookie','document.cookie')]:
        if token in text: ERRORS.append(f'client data transmission primitive detected in index: {label}')
    if 'sessionStorage.setItem(STORAGE.search' not in text or 'sessionStorage.getItem(STORAGE.search' not in text: ERRORS.append('search/filter state is not persisted in sessionStorage as expected')
    # Architecture guards from the operations refactor.
    for token,msg in [('r.plan','legacy plan-centric rendering remains'),('r.capacity','legacy capacity logic remains'),('r.purposes','manual purpose filtering remains'),('fit.pct','public percentage fit rendering remains')]:
        if token in text: ERRORS.append(msg)
    if 'some(color=>r.colors?.includes(color))' not in text: WARNS.append('color filter OR-semantics guard not detected')
    if 'purposeEligible(r,state.purpose)' not in text: ERRORS.append('purpose filter is not evidence-derived')
    if 'pruneStoredIds()' not in text: WARNS.append('stored saved/compare IDs are not pruned')
    vercel_text=(ROOT/'vercel.json').read_text(encoding='utf-8') if (ROOT/'vercel.json').exists() else ''
    if "connect-src 'self'" not in vercel_text: WARNS.append("CSP does not restrict connect-src to 'self'")
    scripts=[]
    for m in re.finditer(r'<script(?:\s[^>]*)?>(.*?)</script>',text,flags=re.S):
        if 'application/ld+json' in m.group(0): continue
        scripts.append(m.group(1))
    with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f: f.write('\n'.join(scripts)); tmp=f.name
    try:
        cp=subprocess.run(['node','--check',tmp],capture_output=True,text=True)
        if cp.returncode: ERRORS.append('JavaScript syntax error: '+(cp.stderr.strip().splitlines()[-1] if cp.stderr.strip() else 'unknown'))
    except FileNotFoundError: WARNS.append('node not found; JavaScript syntax check skipped')
    required=['data/hotels.json','build_site.py','robots.txt','robots.production.txt','sitemap.xml.template','vercel.json','terms.html','privacy.html','affiliate-disclosure.html','external-transmission.html','editorial-policy.html','operator.html','404.html','hotels/index.html']
    for name in required:
        if not (ROOT/name).exists(): ERRORS.append(f'missing required file: {name}')
    detail_pages=list((ROOT/'hotels').glob('*/index.html')) if (ROOT/'hotels').exists() else []
    if len(detail_pages)!=len(records): ERRORS.append(f'detail page count ({len(detail_pages)}) does not match canonical records ({len(records)})')
    for hp in detail_pages:
        t=hp.read_text(encoding='utf-8')
        if '<h1>' not in t: ERRORS.append(f'{hp.relative_to(ROOT)} missing h1')
        if 'BreadcrumbList' not in t: ERRORS.append(f'{hp.relative_to(ROOT)} missing BreadcrumbList structured data')
        if '"@type":"Hotel"' not in t: ERRORS.append(f'{hp.relative_to(ROOT)} missing Hotel structured data')
    print('=== 推し宿 production validation ===')
    for w in WARNS: print('WARN:',w)
    for e in ERRORS: print('ERROR:',e)
    if ERRORS:
        print(f'FAIL: {len(ERRORS)} error(s), {len(WARNS)} warning(s)'); raise SystemExit(1)
    print(f'PASS: 0 errors, {len(WARNS)} warning(s)')
if __name__=='__main__': main()
