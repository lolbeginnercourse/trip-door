#!/usr/bin/env python3
import argparse
import json
from datetime import datetime
from pathlib import Path

from research_hotel_details import JST, RESULT


def load_jsonl(path):
    rows=[]
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            if line.strip():
                try: rows.append(json.loads(line))
                except Exception: pass
    return rows


def counts(rows):
    out={}
    for row in rows:
        s=row.get('verification_status','unknown')
        out[s]=out.get(s,0)+1
    return out


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--input-dir',required=True)
    args=ap.parse_args()

    baseline=load_jsonl(RESULT)
    if len(baseline)!=750:
        raise SystemExit(f'Expected 750 baseline rows, got {len(baseline)}')
    before={r['id']:r for r in baseline}
    merged=dict(before)

    shard_files=sorted(Path(args.input_dir).rglob('*.jsonl'))
    patch_count=0
    for path in shard_files:
        for row in load_jsonl(path):
            if row.get('id') in merged:
                merged[row['id']]=row
                patch_count+=1

    rows=sorted(merged.values(),key=lambda x:x.get('research_no',999999))
    if len(rows)!=750 or len({x.get('id') for x in rows})!=750:
        raise SystemExit('Merged result does not contain exactly 750 unique rows')

    RESULT.write_text(''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n' for x in rows),encoding='utf-8')

    improved_verified=0
    improved_partial=0
    remaining_review=0
    changed=0
    for row in rows:
        old=before[row['id']]
        if row!=old: changed+=1
        if old.get('verification_status')!='verified' and row.get('verification_status')=='verified': improved_verified+=1
        if old.get('verification_status')=='needs_review' and row.get('verification_status')=='partial': improved_partial+=1
        if row.get('verification_status')=='needs_review': remaining_review+=1

    report={
        'target_count':750,
        'shard_file_count':len(shard_files),
        'patch_rows_read':patch_count,
        'changed_rows':changed,
        'before_status_counts':counts(baseline),
        'after_status_counts':counts(rows),
        'upgraded_to_verified':improved_verified,
        'upgraded_needs_review_to_partial':improved_partial,
        'remaining_needs_review':remaining_review,
        'merged_at':datetime.now(JST).isoformat(timespec='seconds'),
    }
    Path('research/generated/parallel_verification_summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
