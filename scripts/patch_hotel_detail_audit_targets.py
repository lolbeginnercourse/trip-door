#!/usr/bin/env python3
import json
import re
from pathlib import Path

DATA = Path('assets/data/hotel-details.json')
VALIDATION = Path('research/generated/hotel_details_production_validation.json')

STATION_FIXES = {
    'stage-053-3': ('は三鷹', '三鷹'),
    'stage-094-1': ('｢平塚', '平塚'),
    'stage-094-2': ('｢平塚', '平塚'),
    'stage-094-3': ('｢平塚', '平塚'),
    'stage-126-3': ('札駅から大通', '大通'),
    'stage-187-3': ('｢大阪梅田', '大阪梅田'),
}

TRANSFER_HIDE = {
    'stage-026-2','stage-027-2','stage-101-1','stage-101-2','stage-101-3',
    'stage-137-3','stage-183-1','stage-183-2','stage-183-3','stage-205-1',
    'stage-205-2','stage-205-3','stage-212-1','stage-212-2','stage-212-3',
    'stage-222-1','stage-222-2','stage-222-3','stage-244-1',
}

HERO_GUARD = {
    'stage-002-1','stage-002-2','stage-002-3','stage-010-3','stage-043-2',
    'stage-043-3','stage-053-1','stage-053-2','stage-060-1','stage-060-2',
    'stage-060-3','stage-063-1','stage-063-2','stage-063-3','stage-077-1',
    'stage-077-2','stage-085-1','stage-107-1','stage-119-1','stage-119-2',
    'stage-119-3','stage-123-1','stage-123-2','stage-123-3','stage-187-1',
    'stage-187-2','stage-228-1','stage-228-2','stage-232-1','stage-232-2',
    'stage-232-3',
}

TARGETS = set(STATION_FIXES) | TRANSFER_HIDE | HERO_GUARD
assert len(TARGETS) == 56

payload = json.loads(DATA.read_text(encoding='utf-8'))
records = payload.get('records') or {}
assert len(records) == 750
assert len(set(records)) == 750
missing = sorted(TARGETS - set(records))
assert not missing, missing

before = {rid: json.dumps(records[rid], ensure_ascii=False, sort_keys=True) for rid in records}

for rid, (old, new) in STATION_FIXES.items():
    rec = records[rid]
    access = rec.setdefault('access', {})
    if access.get('venueStation') == old:
        access['venueStation'] = new
    for step in access.get('routeSteps') or []:
        for key in ('label', 'detail'):
            value = step.get(key)
            if isinstance(value, str) and old in value:
                step[key] = value.replace(old, new)

for rid in TRANSFER_HIDE:
    rec = records[rid]
    access = rec.setdefault('access', {})
    access['transferCount'] = None
    for step in access.get('routeSteps') or []:
        detail = step.get('detail')
        if isinstance(detail, str):
            detail = re.sub(r'・?乗換\s*\d+回', '', detail).strip(' ・')
            step['detail'] = detail or None
    note = access.get('note')
    audit_note = '乗換回数は経路候補の再確認が必要なため表示していません'
    if not note:
        access['note'] = audit_note
    elif audit_note not in note:
        access['note'] = f'{note}。{audit_note}'

for rid in HERO_GUARD:
    rec = records[rid]
    access = rec.setdefault('access', {})
    assert access.get('heroMin') is None, (rid, access.get('heroMin'))
    rec['coverage'] = 'limited'
    note = access.get('note')
    guard_note = '確認できた区間のみ表示しています。未確認区間は合算していません'
    if not note:
        access['note'] = guard_note
    elif guard_note not in note:
        access['note'] = f'{note}。{guard_note}'

changed = {rid for rid in records if before[rid] != json.dumps(records[rid], ensure_ascii=False, sort_keys=True)}
assert changed == TARGETS, {'expected': sorted(TARGETS - changed), 'unexpected': sorted(changed - TARGETS)}

# Target-only validation
for rid, (_, expected) in STATION_FIXES.items():
    assert records[rid]['access'].get('venueStation') == expected
for rid in TRANSFER_HIDE:
    assert records[rid]['access'].get('transferCount') is None
    route_text = json.dumps(records[rid]['access'].get('routeSteps') or [], ensure_ascii=False)
    assert not re.search(r'乗換\s*[5-9]\d*回', route_text)
for rid in HERO_GUARD:
    assert records[rid].get('coverage') == 'limited'
    assert records[rid]['access'].get('heroMin') is None

payload['recordCount'] = 750
DATA.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

validation = json.loads(VALIDATION.read_text(encoding='utf-8'))
coverage = {'complete': 0, 'limited': 0}
for rec in records.values():
    coverage[rec.get('coverage', 'limited')] = coverage.get(rec.get('coverage', 'limited'), 0) + 1
validation['coverageCounts'] = coverage
validation['recordsWithHeroMinutes'] = sum(1 for rec in records.values() if rec.get('access', {}).get('heroMin') is not None)
validation['targetedAuditPatch'] = {
    'changedRecordCount': len(changed),
    'stationFixes': len(STATION_FIXES),
    'transferCountsHidden': len(TRANSFER_HIDE),
    'missingHeroDowngradedToLimited': len(HERO_GUARD),
    'scope': 'only_fast_audit_flagged_records'
}
validation['complete'] = len(records) == 750
VALIDATION.write_text(json.dumps(validation, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print(json.dumps({
    'changed': len(changed),
    'stationFixes': len(STATION_FIXES),
    'transferHidden': len(TRANSFER_HIDE),
    'heroGuard': len(HERO_GUARD),
    'coverage': coverage,
}, ensure_ascii=False))
