#!/usr/bin/env python3
import argparse
import json
import math
from datetime import datetime
from pathlib import Path

from parallel_verify_hotel_details import JST, load_jsonl, recompute, verify_entity
from research_hotel_details import RESULT, SRC


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shard-index', type=int, required=True)
    ap.add_argument('--shards', type=int, required=True)
    ap.add_argument('--output', required=True)
    args = ap.parse_args()

    baseline = load_jsonl(RESULT)
    if len(baseline) != 750:
        raise SystemExit(f'Expected 750 baseline rows, got {len(baseline)}')

    review_rows = [r for r in baseline if r.get('verification_status') == 'needs_review']
    review_rows.sort(key=lambda x: x.get('research_no', 999999))

    srcdata = json.loads(SRC.read_text(encoding='utf-8'))
    records = srcdata['hotels'] if isinstance(srcdata, dict) else srcdata
    source_by_id = {r.get('id'): r for r in records if r.get('id')}

    chunk = math.ceil(len(review_rows) / args.shards) if review_rows else 0
    lo = args.shard_index * chunk
    hi = min(len(review_rows), (args.shard_index + 1) * chunk)
    selected = review_rows[lo:hi] if chunk else []

    hotel_cache = {}
    venue_cache = {}
    updated = []

    for pos, row in enumerate(selected, lo + 1):
        src = source_by_id.get(row.get('id'), {})
        candidate = src.get('station') or row.get('hotel_nearest_station')
        hkey = row.get('hotel_name')
        vkey = row.get('venueId')

        need_hotel = (
            row.get('hotel_to_station_walk_min') is None
            or 'hotel_station_differs_from_existing' in (row.get('warnings') or [])
        )
        need_venue = (
            not row.get('venue_nearest_station')
            or row.get('venue_station_to_venue_walk_min') is None
        )

        hcheck = None
        if need_hotel:
            if hkey not in hotel_cache:
                hotel_cache[hkey] = verify_entity(
                    hkey,
                    'hotel',
                    candidate,
                    src.get('prefecture') or row.get('prefecture'),
                    row.get('hotel_source_url'),
                )
            hcheck = hotel_cache[hkey]

        vcheck = None
        if need_venue:
            if vkey not in venue_cache:
                venue_cache[vkey] = verify_entity(
                    row.get('venue_name'),
                    'venue',
                    row.get('venue_nearest_station'),
                    src.get('prefecture') or row.get('prefecture'),
                    row.get('venue_source_url'),
                )
            vcheck = venue_cache[vkey]

        out = recompute(row, src, hcheck, vcheck)
        out['needs_review_rechecked_at'] = datetime.now(JST).isoformat(timespec='seconds')
        updated.append(out)

        print(
            f'[{pos}/{len(review_rows)} needs_review] {out.get("hotel_name")} -> {out.get("venue_name")}: '
            f'{row.get("verification_status")} => {out.get("verification_status")} '
            f'hotelwalk={out.get("hotel_to_station_walk_min")} '
            f'venue={out.get("venue_nearest_station")} '
            f'venuewalk={out.get("venue_station_to_venue_walk_min")} '
            f'route={out.get("station_to_station_min")}',
            flush=True,
        )

    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        ''.join(json.dumps(x, ensure_ascii=False, separators=(',', ':')) + '\n' for x in updated),
        encoding='utf-8',
    )

    counts = {}
    for x in updated:
        s = x.get('verification_status', 'unknown')
        counts[s] = counts.get(s, 0) + 1

    summary = {
        'shard_index': args.shard_index,
        'shards': args.shards,
        'baseline_needs_review_count': len(review_rows),
        'selected_count': len(updated),
        'hotel_entities_checked': len(hotel_cache),
        'venue_entities_checked': len(venue_cache),
        'status_counts': counts,
        'finished_at': datetime.now(JST).isoformat(timespec='seconds'),
    }
    Path(str(path) + '.summary.json').write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
