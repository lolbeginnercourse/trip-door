#!/usr/bin/env python3
import csv
import html
import json
import re
import time
import random
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import quote_plus, unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

INPUT = Path('exports/booking_urls_750.csv')
OUTPUT = Path('exports/jalan_urls_750_researched.csv')
MAP_OUT = Path('exports/jalan_hotel_url_map.json')
UNRESOLVED = Path('exports/jalan_urls_unresolved.csv')
SUMMARY = Path('exports/jalan_urls_750_research_summary.json')
MAX_WORKERS = 8
TIMEOUT = 18
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'
YAD_RE = re.compile(r'https?://(?:www\.)?jalan\.net/yad(\d+)/?', re.I)


def norm(s):
    s = unicodedata.normalize('NFKC', s or '').lower()
    s = re.sub(r'【[^】]*】|\[[^\]]*\]', '', s)
    s = s.replace('ホテル&リゾーツ', 'ホテルリゾーツ')
    return re.sub(r'[^0-9a-zぁ-んァ-ヶ一-龠ー]', '', s)


def get(url, retries=2):
    for i in range(retries + 1):
        try:
            req = Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.8'})
            with urlopen(req, timeout=TIMEOUT) as r:
                raw = r.read()
                charset = r.headers.get_content_charset() or 'utf-8'
                try:
                    return raw.decode(charset, errors='replace'), r.geturl()
                except LookupError:
                    return raw.decode('utf-8', errors='replace'), r.geturl()
        except (HTTPError, URLError, TimeoutError):
            if i == retries:
                return '', url
            time.sleep(0.7 * (i + 1))
    return '', url


def decode_layers(text):
    vals = [text]
    cur = text
    for _ in range(3):
        nxt = html.unescape(unquote(cur))
        if nxt == cur:
            break
        vals.append(nxt)
        cur = nxt
    return '\n'.join(vals)


def extract_candidates(text):
    out = []
    seen = set()
    expanded = decode_layers(text)
    for m in YAD_RE.finditer(expanded):
        yad = m.group(1)
        url = f'https://www.jalan.net/yad{yad}/'
        if url not in seen:
            seen.add(url)
            out.append(url)
    return out


def search_urls(query):
    urls = []
    engines = [
        ('yahoo', 'https://search.yahoo.co.jp/search?p=' + quote_plus(query)),
        ('bing', 'https://www.bing.com/search?q=' + quote_plus(query)),
        ('ddg', 'https://html.duckduckgo.com/html/?q=' + quote_plus(query)),
    ]
    for engine, u in engines:
        body, _ = get(u, retries=1)
        if body:
            for c in extract_candidates(body):
                if c not in urls:
                    urls.append(c)
        if urls:
            break
    return urls


def page_title(body):
    for pat in [
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']',
        r'<title[^>]*>(.*?)</title>',
    ]:
        m = re.search(pat, body, re.I | re.S)
        if m:
            return re.sub(r'<[^>]+>', '', html.unescape(m.group(1))).strip()
    return ''


def candidate_score(hotel, title, body):
    hn = norm(hotel)
    tn = norm(title)
    if not hn or not tn:
        return 0.0
    if hn in tn:
        return 1.0
    if tn in hn and len(tn) >= max(5, int(len(hn) * 0.65)):
        return 0.96
    seq = SequenceMatcher(None, hn, tn).ratio()
    # page body is only a weak secondary check
    bn = norm(re.sub(r'<[^>]+>', ' ', body[:120000]))
    body_hit = 0.92 if hn and hn in bn else 0.0
    return max(seq, body_hit)


def research_one(hotel):
    queries = [
        f'site:jalan.net/yad "{hotel}"',
        f'site:jalan.net/yad {hotel} じゃらん',
        f'じゃらん {hotel}',
    ]
    candidates = []
    for q in queries:
        for u in search_urls(q):
            if u not in candidates:
                candidates.append(u)
        if candidates:
            break
        time.sleep(random.uniform(0.15, 0.45))

    scored = []
    for u in candidates[:6]:
        body, final_url = get(u, retries=1)
        if not body:
            continue
        title = page_title(body)
        score = candidate_score(hotel, title, body)
        canonical = extract_candidates(final_url + '\n' + body[:50000])
        url = canonical[0] if canonical else u
        scored.append((score, url, title))

    scored.sort(reverse=True, key=lambda x: x[0])
    if scored:
        best = scored[0]
        second = scored[1][0] if len(scored) > 1 else 0.0
        # strict enough to avoid silently assigning a wrong chain hotel
        if best[0] >= 0.90 and (best[0] >= 0.97 or best[0] - second >= 0.06):
            return {
                'hotel_name': hotel,
                'jalan_url': best[1],
                'status': 'verified_search',
                'score': round(best[0], 3),
                'matched_title': best[2],
            }
    return {
        'hotel_name': hotel,
        'jalan_url': '',
        'status': 'unresolved',
        'score': round(scored[0][0], 3) if scored else 0,
        'matched_title': scored[0][2] if scored else '',
    }


def main():
    with INPUT.open(encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    if len(rows) != 750:
        raise SystemExit(f'expected 750 rows, got {len(rows)}')

    existing = {}
    unique = []
    for r in rows:
        h = r['hotel_name'].strip()
        if h not in unique:
            unique.append(h)
        if r.get('jalan_url', '').strip():
            existing[h] = {
                'hotel_name': h,
                'jalan_url': r['jalan_url'].strip(),
                'status': 'existing_yad_no',
                'score': 1.0,
                'matched_title': '',
            }

    todo = [h for h in unique if h not in existing]
    print(f'rows={len(rows)} unique_hotels={len(unique)} existing={len(existing)} todo={len(todo)}', flush=True)

    results = dict(existing)
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(research_one, h): h for h in todo}
        done = 0
        for fut in as_completed(futures):
            h = futures[fut]
            try:
                result = fut.result()
            except Exception as e:
                result = {'hotel_name': h, 'jalan_url': '', 'status': 'error', 'score': 0, 'matched_title': str(e)[:200]}
            results[h] = result
            done += 1
            if done % 20 == 0 or done == len(todo):
                found = sum(1 for v in results.values() if v.get('jalan_url'))
                print(f'progress {done}/{len(todo)} researched, unique URLs found={found}/{len(unique)}', flush=True)

    # Duplicate rows inherit the same researched hotel URL.
    out_fields = ['no', 'id', 'hotel_name', 'venue_name', 'venue_id', 'venue_number', 'rank', 'jalan_yad_no', 'jalan_url', 'jalan_url_source', 'jalan_match_score', 'jalan_matched_title']
    out_rows = []
    for r in rows:
        m = results[r['hotel_name'].strip()]
        u = m.get('jalan_url', '')
        yad_m = re.search(r'/yad(\d+)/', u)
        out_rows.append({
            'no': r['no'], 'id': r['id'], 'hotel_name': r['hotel_name'], 'venue_name': r['venue_name'],
            'venue_id': r['venue_id'], 'venue_number': r['venue_number'], 'rank': r['rank'],
            'jalan_yad_no': yad_m.group(1) if yad_m else r.get('jalan_yad_no', ''),
            'jalan_url': u,
            'jalan_url_source': m.get('status', ''),
            'jalan_match_score': m.get('score', ''),
            'jalan_matched_title': m.get('matched_title', ''),
        })

    with OUTPUT.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=out_fields)
        w.writeheader(); w.writerows(out_rows)

    MAP_OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    unresolved = [v for v in results.values() if not v.get('jalan_url')]
    with UNRESOLVED.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['hotel_name', 'status', 'score', 'matched_title'])
        w.writeheader()
        for v in unresolved:
            w.writerow({k: v.get(k, '') for k in ['hotel_name', 'status', 'score', 'matched_title']})

    rows_with_url = sum(1 for r in out_rows if r['jalan_url'])
    unique_with_url = sum(1 for v in results.values() if v.get('jalan_url'))
    summary = {
        'rows': len(rows),
        'unique_hotels': len(unique),
        'rows_with_jalan_url': rows_with_url,
        'rows_missing_jalan_url': len(rows) - rows_with_url,
        'unique_hotels_with_jalan_url': unique_with_url,
        'unique_hotels_missing_jalan_url': len(unique) - unique_with_url,
        'mode': 'ordinary_web_search_search_engines_plus_jalan_page_title_verification',
    }
    SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
