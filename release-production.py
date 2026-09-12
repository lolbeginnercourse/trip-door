#!/usr/bin/env python3
import argparse, json, re, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'/'hotels.json'
EXCLUDE={'mobile-preview.html','404.html','index.pre-interaction-backup.html'}

def js_string(v:str)->str: return v.replace('\\','\\\\').replace("'","\\'")
def replace_field(text,key,value):
    pat=rf"({re.escape(key)}\s*:\s*)'[^']*'"
    return re.sub(pat,lambda m:m.group(1)+"'"+js_string(value)+"'",text,count=1)
def set_bool(text,key,value): return re.sub(rf"({re.escape(key)}\s*:\s*)(true|false)",rf"\g<1>{str(value).lower()}",text,count=1)
def page_url(base,path):
    rel=path.relative_to(ROOT).as_posix()
    if rel=='index.html': return base+'/'
    if rel.endswith('/index.html'): return base+'/'+rel[:-10]
    return base+'/'+rel

def main():
    ap=argparse.ArgumentParser(description='推し宿を公開設定へ切り替えます')
    ap.add_argument('--domain',required=True,help='https://example.com の形式')
    ap.add_argument('--operator',required=True,help='運営者名または屋号')
    group=ap.add_mutually_exclusive_group(required=True)
    group.add_argument('--contact-email'); group.add_argument('--contact-url')
    ap.add_argument('--allow-missing-affiliate',action='store_true',help='アフィリエイトURL未設定でも公開処理を続行（通常は非推奨）')
    args=ap.parse_args(); base=args.domain.rstrip('/')
    if not base.startswith('https://'): raise SystemExit('ERROR: --domain は https:// で指定してください')

    records=json.loads(DATA.read_text(encoding='utf-8'))
    missing=[r.get('hotel',r.get('id','?')) for r in records if not (r.get('bookingLinks',{}).get('rakuten') and r.get('bookingLinks',{}).get('jalan'))]
    if missing and not args.allow_missing_affiliate:
        raise SystemExit('ERROR: 公開前に data/hotels.json の楽天・じゃらんURLを設定してください: '+', '.join(missing))

    # Canonical data -> generated index/list/detail pages. Affiliate URLs must be present before this step.
    subprocess.run([sys.executable,str(ROOT/'build_site.py')],check=True)

    htmls=[p for p in ROOT.rglob('*.html') if p.name not in EXCLUDE]
    for path in htmls:
        text=path.read_text(encoding='utf-8')
        if 'window.OSHIYADO_CONFIG' in text:
            text=replace_field(text,'baseUrl',base); text=replace_field(text,'operatorName',args.operator)
            text=replace_field(text,'contactEmail',args.contact_email or ''); text=replace_field(text,'contactUrl',args.contact_url or '')
            text=set_bool(text,'publicationReady',True)
        text=text.replace('https://YOUR-DOMAIN',base)
        if 'data-seo-indexable="false"' not in text:
            text=text.replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow">',1)
            text=text.replace('<meta name="robots" content="noindex,nofollow" data-seo-indexable="true">','<meta name="robots" content="index,follow" data-seo-indexable="true">',1)
            text=text.replace('<meta name="robots" content="noindex,follow" data-seo-indexable="true">','<meta name="robots" content="index,follow" data-seo-indexable="true">',1)
        url=page_url(base,path)
        if re.search(r'<link rel="canonical"[^>]*>',text):
            text=re.sub(r'<link rel="canonical"[^>]*>',f'<link rel="canonical" href="{url}">',text,count=1)
        else:
            text=text.replace('</head>',f'<link rel="canonical" href="{url}">\n</head>',1)
        text=re.sub(r'<meta property="og:url" content="[^"]*">',f'<meta property="og:url" content="{url}">',text,count=1)
        path.write_text(text,encoding='utf-8')

    (ROOT/'robots.txt').write_text((ROOT/'robots.production.txt').read_text().replace('{{BASE_URL}}',base),encoding='utf-8')
    sitemap_pages=[]
    for path in htmls:
        rel=path.relative_to(ROOT).as_posix()
        if rel in {'mobile-preview.html','404.html'}: continue
        if re.search(r'<meta name="robots" content="noindex', path.read_text(encoding='utf-8')): continue
        sitemap_pages.append(page_url(base,path))
    sitemap_pages=sorted(set(sitemap_pages),key=lambda u:(u.count('/'),u))
    rows='\n'.join(f'  <url><loc>{u}</loc></url>' for u in sitemap_pages)
    (ROOT/'sitemap.xml').write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{rows}\n</urlset>\n',encoding='utf-8')
    print(f'Production settings applied to {len(htmls)} HTML files.')
    print('Next: run validate-production.py. Do not edit generated hotel HTML directly.')
if __name__=='__main__': main()
