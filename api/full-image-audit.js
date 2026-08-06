"use strict";

const fs = require("node:fs");
const path = require("node:path");
const hotelImageModule = require("./hotel-image");
const affiliateModule = require("./affiliate-links");

const findImage = hotelImageModule.findImage;
const findRakuten = affiliateModule.findRakuten;
const DATA_PATH = path.join(process.cwd(), "assets", "data", "hotels.json");
const AUDIT_KEY = "full-20260807";

function text(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function validHotelNo(value) {
  const valueText = text(value);
  return /^\d{1,12}$/.test(valueText) ? valueText : "";
}

function requestKey(hotel) {
  const hotelNo = validHotelNo(hotel?.rakutenHotelNo);
  if (hotelNo) return `hotelNo:${hotelNo}`;
  const location = hotel?.station || hotel?.area || "";
  return `name:${[
    text(hotel?.name).toLowerCase(),
    text(hotel?.prefecture).toLowerCase(),
    text(location).toLowerCase()
  ].join("|")}`;
}

function normalizeHotels(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.hotels)) return payload.hotels;
  return [];
}

function contextFor(hotel) {
  return {
    name: text(hotel?.name) || null,
    hotelNo: validHotelNo(hotel?.rakutenHotelNo) || null,
    prefecture: text(hotel?.prefecture) || null,
    area: text(hotel?.area) || null,
    station: text(hotel?.station) || null,
    accessEstimate: text(hotel?.accessEstimate) || null
  };
}

function causeCode(imageResult, affiliate, error) {
  if (error) return "temporary_upstream_error";
  if (imageResult?.image?.src) return "matched";
  if (imageResult?.status === "matched") return "matched_but_no_image_url";
  if (imageResult?.status === "ambiguous") return "multiple_candidates";
  if (imageResult?.status === "location_unverified") return "location_unverified";
  if (imageResult?.status === "not_configured") return "rakuten_credentials_missing";
  if (imageResult?.status === "not_found" && affiliate) return "image_match_gap_affiliate_found";
  if (imageResult?.status === "not_found") return "not_found_by_current_rakuten_search";
  return "other_error";
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return { value: await fn(), error: null };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(700 * attempt);
    }
  }
  return { value: null, error: String(lastError?.message || lastError || "unknown_error") };
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function increment(object, key, amount = 1) {
  object[key] = (object[key] || 0) + amount;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }
  if (text(req.query?.audit) !== AUDIT_KEY) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: "not_found" }));
  }
  if (typeof findImage !== "function" || typeof findRakuten !== "function") {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "audit_helpers_unavailable" }));
  }

  const startedAt = Date.now();
  const start = Math.max(0, Number.parseInt(req.query?.start, 10) || 0);
  const requestedLimit = Number.parseInt(req.query?.limit, 10) || 20;
  const limit = Math.max(1, Math.min(20, requestedLimit));

  const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const hotels = normalizeHotels(payload);
  const groups = new Map();
  hotels.forEach((hotel, index) => {
    const key = requestKey(hotel);
    if (!groups.has(key)) groups.set(key, { key, hotel, indexes: [] });
    groups.get(key).indexes.push(index);
  });

  const allGroups = [...groups.values()];
  const selected = allGroups.slice(start, start + limit);

  const imageChecks = await mapLimit(selected, 3, async group => {
    const context = contextFor(group.hotel);
    const attempt = await withRetry(() => findImage(context), 3);
    return {
      group,
      context,
      imageResult: attempt.value,
      imageError: attempt.error,
      affiliate: null,
      affiliateError: null
    };
  });

  const failures = imageChecks.filter(item => !item.imageResult?.image?.src);
  await mapLimit(failures, 2, async item => {
    const affiliateAttempt = await withRetry(
      () => findRakuten(item.context.name, item.context.hotelNo),
      2
    );
    item.affiliate = affiliateAttempt.value;
    item.affiliateError = affiliateAttempt.error;
    return item;
  });

  const uniqueCountsByCause = {};
  const recordCountsByCause = {};
  const uniqueCountsByStatus = {};
  const recordCountsByStatus = {};
  const uniqueCountsByMatchedBy = {};
  const recordCountsByMatchedBy = {};
  let affectedRecords = 0;
  let matchedRecords = 0;
  let failedRecords = 0;
  let matchedUnique = 0;
  let failedUnique = 0;

  const results = imageChecks.map(item => {
    const affected = item.group.indexes.length;
    const status = text(item.imageResult?.status) || (item.imageError ? "upstream_error" : "unknown");
    const cause = causeCode(item.imageResult, item.affiliate, item.imageError);
    const matchedBy = text(item.imageResult?.image?.matchedBy);
    const hasImage = Boolean(item.imageResult?.image?.src);

    affectedRecords += affected;
    increment(uniqueCountsByCause, cause);
    increment(recordCountsByCause, cause, affected);
    increment(uniqueCountsByStatus, status);
    increment(recordCountsByStatus, status, affected);

    if (hasImage) {
      matchedUnique += 1;
      matchedRecords += affected;
      increment(uniqueCountsByMatchedBy, matchedBy || "unknown");
      increment(recordCountsByMatchedBy, matchedBy || "unknown", affected);
    } else {
      failedUnique += 1;
      failedRecords += affected;
    }

    return {
      requestKey: item.group.key,
      affectedRecordCount: affected,
      sampleRecordIds: item.group.indexes.slice(0, 8).map(index => text(hotels[index]?.id)),
      hotel: {
        name: item.context.name,
        prefecture: item.context.prefecture,
        station: item.context.station,
        area: item.context.area,
        storedRakutenHotelNo: item.context.hotelNo
      },
      hasImage,
      status,
      cause,
      matchedHotelNo: text(item.imageResult?.image?.hotelNo),
      matchedHotelName: text(item.imageResult?.image?.hotelName),
      matchedBy,
      matchEvidence: Array.isArray(item.imageResult?.image?.matchEvidence)
        ? item.imageResult.image.matchEvidence
        : [],
      affiliateRakutenFound: Boolean(item.affiliate),
      affiliateHotelNo: text(item.affiliate?.hotelNo),
      imageError: item.imageError,
      affiliateError: item.affiliateError
    };
  });

  const response = {
    generatedAt: new Date().toISOString(),
    totalRecords: hotels.length,
    totalUniqueRequestKeys: allGroups.length,
    duplicateRecordsSharingRequests: hotels.length - allGroups.length,
    start,
    limit,
    processedUnique: selected.length,
    affectedRecords,
    nextStart: start + selected.length,
    done: start + selected.length >= allGroups.length,
    durationMs: Date.now() - startedAt,
    summary: {
      matchedRecords,
      failedRecords,
      matchedUnique,
      failedUnique,
      recordCountsByCause,
      uniqueCountsByCause,
      recordCountsByStatus,
      uniqueCountsByStatus,
      recordCountsByMatchedBy,
      uniqueCountsByMatchedBy
    },
    failures: results.filter(result => !result.hasImage),
    results
  };

  res.statusCode = 200;
  return res.end(JSON.stringify(response));
};
