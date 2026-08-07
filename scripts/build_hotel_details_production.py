#!/usr/bin/env python3
import argparse
import json
import re
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

JST = timezone(timedelta(hours=9))


def read_jsonl(path: Path):
    rows = []
    for no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"invalid JSONL line {no}: {exc}") from exc
        if not isinstance(row, dict):
            raise SystemExit(f"JSONL line {no} is not an object")
        rows.append(row)
    return rows


def as_int(value, minimum=0, maximum=240):
    if isinstance(value, bool):
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number if minimum <= number <= maximum else None


def clean_text(value):
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def station_name(value):
    text = clean_text(value)
    if not text:
        return None
    text = text.strip("・/／,，。:：;；()（）[]【】「」『』'\" ")
    text = re.sub(r"^(?:JR|ＪＲ)\s*", "", text, flags=re.I)
    text = text.removesuffix("駅").strip()
    junk = {
        "最寄", "最寄り", "の", "路線", "各", "山麓", "国際通り",
    }
    if text in junk or len(text) > 40:
        return None
    return text or None


def valid_url(value):
    text = clean_text(value)
    if not text:
        return None
    try:
        parsed = urlparse(text)
    except Exception:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return text


def normalize_direct_mode(value):
    text = (clean_text(value) or "").lower()
    if not text:
        return None
    if "徒歩" in text or "walk" in text:
        return "walk"
    if "バス" in text or "bus" in text:
        return "bus"
    if "タクシ" in text or "taxi" in text:
        return "taxi"
    if "電車" in text or "鉄道" in text or "rail" in text or "train" in text:
        return "rail"
    if "車" in text or "car" in text:
        return "taxi"
    return "mixed"


def status_check_labels(hotel):
    labels = []
    for item in hotel.get("statuses") or []:
        if isinstance(item, list):
            label = clean_text(item[0] if item else None)
            state = item[1] if len(item) > 1 else None
        elif isinstance(item, dict):
            label = clean_text(item.get("label"))
            state = item.get("state")
        else:
            continue
        if label and state != "confirmed":
            labels.append(label)
    labels = list(dict.fromkeys(labels))
    if not labels:
        labels.append("宿泊日当日の料金・空室")
    if not any("キャンセル" in label for label in labels):
        labels.append("プランごとのキャンセル条件")
    return labels[:6]


def source_label(kind, source_type):
    official = clean_text(source_type) == "official"
    if kind == "hotel":
        return "ホテル公式" if official else "ホテルアクセス情報"
    if kind == "venue":
        return "会場公式" if official else "会場アクセス情報"
    return "経路確認"


def make_sources(row):
    candidates = [
        ("hotel", row.get("hotel_source_url"), row.get("hotel_source_type")),
        ("venue", row.get("venue_source_url"), row.get("venue_source_type")),
        ("transit", row.get("transit_source_url"), None),
    ]
    seen = set()
    sources = []
    for kind, raw_url, source_type in candidates:
        url = valid_url(raw_url)
        if not url or url in seen:
            continue
        seen.add(url)
        sources.append({"label": source_label(kind, source_type), "url": url})
    return sources


def make_route_steps(row, hotel_name, venue_name, coverage):
    direct_min = as_int(row.get("direct_to_venue_min"), 1, 240)
    direct_mode = normalize_direct_mode(row.get("direct_to_venue_mode"))
    hotel_station = station_name(row.get("hotel_nearest_station"))
    venue_station = station_name(row.get("venue_nearest_station"))
    hotel_walk = as_int(row.get("hotel_to_station_walk_min"), 0, 90)
    venue_walk = as_int(row.get("venue_station_to_venue_walk_min"), 0, 90)
    station_min = as_int(row.get("station_to_station_min"), 0, 240)
    transfers = as_int(row.get("transfer_count"), 0, 8)

    steps = [{"kind": "place", "label": hotel_name}]

    if direct_min is not None:
        mode = direct_mode or "walk"
        labels = {"walk": "徒歩", "bus": "バス", "taxi": "タクシー", "rail": "電車", "mixed": "移動"}
        steps.append({
            "kind": "travel",
            "mode": mode,
            "label": labels.get(mode, "移動"),
            "minutes": direct_min,
            "detail": f"{venue_name}まで",
        })
        steps.append({"kind": "place", "label": venue_name})
        return steps

    if hotel_station:
        if hotel_walk is not None:
            steps.append({
                "kind": "travel", "mode": "walk", "label": "徒歩",
                "minutes": hotel_walk, "detail": f"{hotel_station}駅まで",
            })
        steps.append({"kind": "place", "label": f"{hotel_station}駅"})

    same_station = bool(hotel_station and venue_station and hotel_station == venue_station)
    if same_station:
        steps.append({"kind": "note", "label": "ホテルと会場の最寄り駅は同じです"})
    elif hotel_station and venue_station and station_min is not None:
        detail = f"{hotel_station}駅 → {venue_station}駅"
        if transfers is not None:
            detail += f"・乗換{transfers}回"
        steps.append({
            "kind": "travel", "mode": "rail", "label": "電車",
            "minutes": station_min, "detail": detail,
        })
        steps.append({"kind": "place", "label": f"{venue_station}駅"})
    elif venue_station and venue_station != hotel_station:
        if coverage == "limited":
            steps.append({"kind": "note", "label": "駅間の所要時間は確認できた区間のみ表示しています"})
        steps.append({"kind": "place", "label": f"{venue_station}駅"})

    if venue_walk is not None:
        steps.append({
            "kind": "travel", "mode": "walk", "label": "徒歩",
            "minutes": venue_walk, "detail": f"{venue_name}まで",
        })
    steps.append({"kind": "place", "label": venue_name})

    # Avoid duplicate adjacent place labels and empty travel shells.
    compact = []
    for step in steps:
        if compact and step["kind"] == "place" and compact[-1]["kind"] == "place" and compact[-1]["label"] == step["label"]:
            continue
        compact.append(step)
    return compact


def build_record(row, hotel):
    raw_status = row.get("verification_status")
    if raw_status not in {"verified", "partial"}:
        raise SystemExit(f"unsupported verification status for {row.get('id')}: {raw_status}")
    coverage = "complete" if raw_status == "verified" else "limited"
    warnings = set(row.get("warnings") or [])
    availability = "closed" if "hotel_closed_since_2025-08-31" in warnings else "active"

    direct_min = as_int(row.get("direct_to_venue_min"), 1, 240)
    direct_mode = normalize_direct_mode(row.get("direct_to_venue_mode"))
    total_min = as_int(row.get("total_access_min"), 1, 240)
    hero_min = (direct_min if direct_min is not None else total_min) if coverage == "complete" else None
    station_min = as_int(row.get("station_to_station_min"), 0, 240)
    transfers = as_int(row.get("transfer_count"), 0, 8)
    hotel_station = station_name(row.get("hotel_nearest_station"))
    venue_station = station_name(row.get("venue_nearest_station"))
    hotel_walk = as_int(row.get("hotel_to_station_walk_min"), 0, 90)
    venue_walk = as_int(row.get("venue_station_to_venue_walk_min"), 0, 90)

    if direct_mode:
        mode = direct_mode
    elif station_min is not None and station_min > 0:
        mode = "rail"
    elif hotel_station and venue_station and hotel_station == venue_station:
        mode = "walk"
    else:
        mode = "unknown"

    access_note = None
    if "non_rail_access_taxi_recommended" in warnings:
        access_note = "鉄道だけでなく、タクシーなどの移動手段も実用的な候補です"
    elif coverage == "limited":
        access_note = "一部区間は合計せず、確認できた情報だけを表示しています"

    hotel_name = clean_text(row.get("hotel_name")) or clean_text(hotel.get("name")) or "ホテル"
    venue_name = clean_text(row.get("venue_name")) or clean_text(hotel.get("venueLabel")) or "会場"

    record = {
        "id": row.get("id"),
        "hotelName": hotel_name,
        "venueName": venue_name,
        "venueId": row.get("venueId") or hotel.get("venueId"),
        "venueNumber": row.get("venueNumber") if row.get("venueNumber") is not None else hotel.get("venueNumber"),
        "rank": row.get("rank") if row.get("rank") is not None else hotel.get("rank"),
        "genre": row.get("genre") or hotel.get("genre"),
        "prefecture": clean_text(row.get("prefecture") or hotel.get("prefecture")),
        "area": clean_text(row.get("area") or hotel.get("area")),
        "coverage": coverage,
        "availability": availability,
        "access": {
            "heroMin": hero_min,
            "mode": mode,
            "directMin": direct_min,
            "hotelStation": hotel_station,
            "hotelWalkMin": hotel_walk,
            "stationMin": station_min,
            "transferCount": transfers,
            "venueStation": venue_station,
            "venueWalkMin": venue_walk,
            "routeSteps": make_route_steps(row, hotel_name, venue_name, coverage),
            "note": access_note,
        },
        "stay": {
            "priceEstimate": clean_text(row.get("price_estimate") or hotel.get("priceEstimate")),
            "priceRange": clean_text(row.get("price_range_estimate") or hotel.get("priceRangeEstimate")),
            "plan": clean_text(row.get("plan_estimate") or hotel.get("planEstimate")),
            "roomType": clean_text(row.get("room_type_estimate") or hotel.get("roomTypeEstimate")),
            "cancellation": clean_text(row.get("cancellation_estimate") or hotel.get("cancellationEstimate")),
        },
        "fit": {
            "role": clean_text(hotel.get("role")),
            "summary": clean_text(hotel.get("summary")),
        },
        "bookingChecks": status_check_labels(hotel),
        "checkedAt": clean_text(row.get("checked_at")),
        "sources": make_sources(row),
    }
    return record


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--research", required=True, type=Path)
    parser.add_argument("--hotels", default="assets/data/hotels.json", type=Path)
    parser.add_argument("--output", default="assets/data/hotel-details.json", type=Path)
    parser.add_argument("--validation", default="research/generated/hotel_details_production_validation.json", type=Path)
    args = parser.parse_args()

    research = read_jsonl(args.research)
    if len(research) != 750:
        raise SystemExit(f"expected 750 research rows, got {len(research)}")
    ids = [row.get("id") for row in research]
    if any(not isinstance(item, str) or not item for item in ids):
        raise SystemExit("research contains missing/invalid ids")
    if len(set(ids)) != 750:
        raise SystemExit(f"expected 750 unique research ids, got {len(set(ids))}")

    status_counts = Counter(row.get("verification_status", "needs_review") for row in research)
    if status_counts.get("needs_review", 0):
        raise SystemExit(f"needs_review must be zero, got {status_counts['needs_review']}")
    unexpected = set(status_counts) - {"verified", "partial"}
    if unexpected:
        raise SystemExit(f"unexpected verification statuses: {sorted(unexpected)}")

    base = json.loads(args.hotels.read_text(encoding="utf-8"))
    hotels = base.get("hotels") if isinstance(base, dict) else base
    if not isinstance(hotels, list):
        raise SystemExit("hotels.json does not contain a hotels array")
    hotel_by_id = {item.get("id"): item for item in hotels if isinstance(item, dict) and item.get("id")}

    records = {}
    missing_base = []
    for row in sorted(research, key=lambda item: (item.get("venueNumber") or 999999, item.get("rank") or 99, item.get("id"))):
        hotel = hotel_by_id.get(row["id"])
        if not hotel:
            missing_base.append(row["id"])
            hotel = {}
        record = build_record(row, hotel)
        records[row["id"]] = record

    if len(records) != 750:
        raise SystemExit(f"expected 750 production records, got {len(records)}")

    generated_at = datetime.now(JST).isoformat(timespec="seconds")
    payload = {
        "version": 1,
        "generatedAt": generated_at,
        "recordCount": len(records),
        "records": records,
    }
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    if '"warnings"' in serialized or '"verification_status"' in serialized:
        raise SystemExit("internal research fields leaked into production JSON")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(serialized + "\n", encoding="utf-8")

    coverage_counts = Counter(record["coverage"] for record in records.values())
    availability_counts = Counter(record["availability"] for record in records.values())
    validation = {
        "generatedAt": generated_at,
        "researchRows": len(research),
        "researchUniqueIds": len(set(ids)),
        "researchStatusCounts": dict(status_counts),
        "productionRecords": len(records),
        "productionUniqueIds": len(set(records)),
        "coverageCounts": dict(coverage_counts),
        "availabilityCounts": dict(availability_counts),
        "recordsWithHeroMinutes": sum(1 for record in records.values() if record["access"]["heroMin"] is not None),
        "recordsWithSources": sum(1 for record in records.values() if record["sources"]),
        "missingBaseHotelIds": missing_base,
        "internalFieldsExcluded": True,
        "complete": len(records) == 750 and not status_counts.get("needs_review", 0),
    }
    args.validation.parent.mkdir(parents=True, exist_ok=True)
    args.validation.write_text(json.dumps(validation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(validation, ensure_ascii=False))


if __name__ == "__main__":
    main()
