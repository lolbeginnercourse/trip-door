#!/usr/bin/env python3
import json
from pathlib import Path
from collections import Counter

SRC = Path('assets/data/hotels.json')
OUT = Path('research/generated')
OUT.mkdir(parents=True, exist_ok=True)

with SRC.open(encoding='utf-8') as f:
    data = json.load(f)

def is_record_list(v):
    return isinstance(v, list) and (not v or all(isinstance(x, dict) for x in v[:20]))

candidates = []
if isinstance(data, list):
    candidates.append(('$root', data))
elif isinstance(data, dict):
    for k, v in data.items():
        if is_record_list(v):
            candidates.append((k, v))

if not candidates:
    raise SystemExit('No list-of-dict collection found in hotels.json')

collection_name, records = max(candidates, key=lambda kv: len(kv[1]))

# Union of keys and simple type profile.
key_counts = Counter()
type_counts = {}
for r in records:
    for k, v in r.items():
        key_counts[k] += 1
        type_counts.setdefault(k, Counter())[type(v).__name__] += 1

summary = {
    'source': str(SRC),
    'top_level_type': type(data).__name__,
    'candidate_collections': {k: len(v) for k, v in candidates},
    'selected_collection': collection_name,
    'record_count': len(records),
    'keys': [
        {
            'key': k,
            'present': key_counts[k],
            'types': dict(type_counts[k]),
        }
        for k in sorted(key_counts)
    ],
    'sample_records': records[:3],
}
(OUT / 'hotel_structure.json').write_text(
    json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8'
)

# One source record per line so the GitHub connector can fetch narrow line ranges.
with (OUT / 'hotel_records.jsonl').open('w', encoding='utf-8') as f:
    for i, r in enumerate(records, 1):
        row = {'_row': i, **r}
        f.write(json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n')

# Create a compact key field inventory per row to find identifiers/name/venue/access fields.
with (OUT / 'hotel_key_inventory.jsonl').open('w', encoding='utf-8') as f:
    for i, r in enumerate(records, 1):
        compact = {'_row': i}
        for k, v in r.items():
            lk = k.lower()
            if any(token in lk for token in (
                'id','name','hotel','venue','hall','station','access','walk','minute','time',
                'price','address','area','route','line','transfer','lat','lng','lon','source','url'
            )):
                if isinstance(v, (str, int, float, bool)) or v is None:
                    compact[k] = v
                elif isinstance(v, (list, dict)):
                    # Keep nested values only if modest in size.
                    s = json.dumps(v, ensure_ascii=False, separators=(',', ':'))
                    compact[k] = v if len(s) <= 3000 else f'<nested:{len(s)} chars>'
        f.write(json.dumps(compact, ensure_ascii=False, separators=(',', ':')) + '\n')

print(f'Extracted {len(records)} records from {collection_name}')
