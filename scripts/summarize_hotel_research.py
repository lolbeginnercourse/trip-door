#!/usr/bin/env python3
import json
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST=timezone(timedelta(hours=9))
RESULT=Path('research/generated/hotel_detail_research_750.jsonl')
PROGRESS=Path('research/generated/research_progress.json')
rows=[]
if RESULT.exists():
    for line in RESULT.read_text(encoding='utf-8').splitlines():
        if line.strip():
            try: rows.append(json.loads(line))
            except Exception: pass
ids={r.get('id') for r in rows if r.get('id')}
status=Counter(r.get('verification_status','needs_review') for r in rows)
warnings=Counter(w for r in rows for w in r.get('warnings',[]))
summary={
    'target_count':750,
    'processed_count':len(ids),
    'remaining_count':750-len(ids),
    'max_research_no':max([r.get('research_no',0) for r in rows] or [0]),
    'status_counts':dict(status),
    'warning_counts':dict(warnings.most_common()),
    'complete':len(ids)==750,
    'updated_at':datetime.now(JST).isoformat(timespec='seconds'),
}
PROGRESS.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
