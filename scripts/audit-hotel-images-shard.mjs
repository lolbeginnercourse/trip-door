import fs from "node:fs";
import path from "node:path";

const ORIGIN = process.env.AUDIT_ORIGIN || "https://mainitiworakunisuru.com";
const DATA_PATH = process.env.DATA_PATH || "assets/data/hotels.json";
const REPORT_DIR = process.env.REPORT_DIR || "reports/all-hotel-image-audit-v2-20260807";
const SHARD_INDEX = Number(process.env.SHARD_INDEX);
const SHARD_SIZE = Number(process.env.SHARD_SIZE || 25);
const REQUEST_INTERVAL_MS = Number(process.env.REQUEST_INTERVAL_MS || 1300);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
const AUDIT_PHASE = String(process.env.AUDIT_PHASE || "first-pass").trim().toLowerCase();
const RETRY_ATTEMPTS = AUDIT_PHASE === "retry"
  ? Number(process.env.RETRY_ATTEMPTS || 5)
  : 1;
const AUDIT_TOKEN = `${AUDIT_PHASE}-${SHARD_INDEX}-${Date.now()}`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalizeHotels(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.hotels)) return payload.hotels;
  return [];
}

function text(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function keyPart(value) {
  return text(value).toLowerCase();
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
    keyPart(hotel?.name),
    keyPart(hotel?.prefecture),
    keyPart(location)
  ].join("|")}`;
}

function addParam(params, key, value) {
  const cleaned = text(value);
  if (cleaned) params.set(key, cleaned);
}

function imageUrlFor(hotel) {
  const params = new URLSearchParams();
  addParam(params, "name", hotel?.name);
  addParam(params, "prefecture", hotel?.prefecture);
  addParam(params, "area", hotel?.area);
  addParam(params, "station", hotel?.station);
  addParam(params, "accessEstimate", hotel?.accessEstimate);
  const hotelNo = validHotelNo(hotel?.rakutenHotelNo);
  if (hotelNo) params.set("rakutenHotelNo", hotelNo);
  params.set("audit", AUDIT_TOKEN);
  return `${ORIGIN}/api/hotel-image?${params}`;
}

function affiliateUrlFor(hotel) {
  const params = new URLSearchParams();
  addParam(params, "name", hotel?.name);
  const hotelNo = validHotelNo(hotel?.rakutenHotelNo);
  if (hotelNo) params.set("rakutenHotelNo", hotelNo);
  const jalanYadNo = text(hotel?.jalanYadNo);
  if (/^\d{1,12}$/.test(jalanYadNo)) params.set("jalanYadNo", jalanYadNo);
  params.set("audit", AUDIT_TOKEN);
  return `${ORIGIN}/api/affiliate-links?${params}`;
}

async function fetchJsonWithRetry(url) {
  let last = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Origin: ORIGIN,
          Referer: `${ORIGIN}/`,
          "User-Agent": `trip-door-hotel-image-audit/3.0-${AUDIT_PHASE}`
        }
      });
      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      last = {
        httpStatus: response.status,
        data,
        rawExcerpt: data ? "" : raw.slice(0, 300),
        attemptsUsed: attempt
      };

      if (![429, 500, 502, 503, 504].includes(response.status)) return last;
      if (attempt === RETRY_ATTEMPTS) return last;

      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await sleep(retryAfter > 0
        ? retryAfter * 1000
        : Math.min(30000, 1500 * (2 ** (attempt - 1))));
    } catch (error) {
      last = {
        httpStatus: 0,
        data: null,
        error: error?.name === "AbortError"
          ? `timeout_after_${REQUEST_TIMEOUT_MS}ms`
          : String(error?.message || error),
        attemptsUsed: attempt
      };
      if (attempt === RETRY_ATTEMPTS) return last;
      await sleep(Math.min(30000, 1500 * (2 ** (attempt - 1))));
    } finally {
      clearTimeout(timeout);
    }
  }

  return last;
}

function summarizeImageResponse(response) {
  const data = response?.data || {};
  const image = data?.image || null;
  return {
    httpStatus: Number(response?.httpStatus || 0),
    status: text(data?.status || data?.error || (response?.httpStatus ? `http_${response.httpStatus}` : "network_error")),
    hasImage: Boolean(image?.src),
    hotelNo: text(image?.hotelNo),
    hotelName: text(image?.hotelName),
    matchedBy: text(image?.matchedBy),
    matchEvidence: Array.isArray(image?.matchEvidence)
      ? image.matchEvidence.map(text).filter(Boolean)
      : [],
    transportError: text(response?.error),
    rawExcerpt: text(response?.rawExcerpt),
    attemptsUsed: Number(response?.attemptsUsed || 0)
  };
}

function summarizeAffiliateResponse(response) {
  const links = Array.isArray(response?.data?.links) ? response.data.links : [];
  const rakuten = links.find(link => link?.provider === "楽天トラベル") || null;
  return {
    httpStatus: Number(response?.httpStatus || 0),
    hasRakuten: Boolean(rakuten),
    rakutenHotelNo: text(rakuten?.hotelNo),
    providers: links.map(link => text(link?.provider)).filter(Boolean),
    transportError: text(response?.error),
    rawExcerpt: text(response?.rawExcerpt),
    attemptsUsed: Number(response?.attemptsUsed || 0)
  };
}

function causeCode(image, affiliate) {
  if (image.hasImage) return "matched";
  if (image.status === "matched") return "matched_but_no_image_url";
  if (image.status === "ambiguous") return "multiple_candidates";
  if (image.status === "location_unverified") return "location_unverified";
  if (image.status === "not_configured") return "rakuten_credentials_missing";
  if (image.status === "not_found" && affiliate?.hasRakuten) return "image_match_gap_affiliate_found";
  if (image.status === "not_found") return "not_found_by_current_rakuten_search";
  if (image.httpStatus === 429 || image.status === "too_many_requests") return "rate_limited";
  if ([500, 502, 503, 504].includes(image.httpStatus) || image.status === "upstream_unavailable") {
    return "temporary_upstream_error";
  }
  if (image.httpStatus === 403) return "request_blocked";
  if (image.httpStatus === 0) return "network_error";
  return "other_error";
}

async function auditGroup(group, previousResult = null) {
  const imageResponse = await fetchJsonWithRetry(imageUrlFor(group.hotel));
  const image = summarizeImageResponse(imageResponse);
  await sleep(REQUEST_INTERVAL_MS);

  let affiliate = null;
  if (!image.hasImage) {
    const affiliateResponse = await fetchJsonWithRetry(affiliateUrlFor(group.hotel));
    affiliate = summarizeAffiliateResponse(affiliateResponse);
    await sleep(REQUEST_INTERVAL_MS);
  }

  const row = {
    requestKey: group.key,
    sourceHotel: {
      name: text(group.hotel?.name),
      prefecture: text(group.hotel?.prefecture),
      station: text(group.hotel?.station),
      area: text(group.hotel?.area),
      storedRakutenHotelNo: validHotelNo(group.hotel?.rakutenHotelNo)
    },
    recordIndexes: group.recordIndexes,
    duplicateGroupSize: group.recordIndexes.length,
    image,
    affiliate,
    causeCode: causeCode(image, affiliate)
  };

  if (AUDIT_PHASE === "retry") {
    row.retry = {
      attempted: true,
      attemptedAt: new Date().toISOString(),
      previousCauseCode: text(previousResult?.causeCode || "missing_first_pass_result"),
      previousHasImage: Boolean(previousResult?.image?.hasImage),
      attemptsPerRequest: RETRY_ATTEMPTS
    };
  }

  return row;
}

if (!Number.isInteger(SHARD_INDEX) || SHARD_INDEX < 0) {
  throw new Error(`Invalid SHARD_INDEX: ${SHARD_INDEX}`);
}
if (!Number.isInteger(SHARD_SIZE) || SHARD_SIZE < 1 || SHARD_SIZE > 100) {
  throw new Error(`Invalid SHARD_SIZE: ${SHARD_SIZE}`);
}
if (!Number.isInteger(RETRY_ATTEMPTS) || RETRY_ATTEMPTS < 1 || RETRY_ATTEMPTS > 10) {
  throw new Error(`Invalid RETRY_ATTEMPTS: ${RETRY_ATTEMPTS}`);
}
if (!["first-pass", "retry"].includes(AUDIT_PHASE)) {
  throw new Error(`Invalid AUDIT_PHASE: ${AUDIT_PHASE}`);
}

const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const hotels = normalizeHotels(payload);
if (hotels.length === 0) throw new Error("No hotel records found.");

const groups = new Map();
for (let index = 0; index < hotels.length; index += 1) {
  const hotel = hotels[index];
  const key = requestKey(hotel);
  if (!groups.has(key)) groups.set(key, { key, hotel, recordIndexes: [] });
  groups.get(key).recordIndexes.push(index);
}

const groupList = [...groups.values()];
const start = SHARD_INDEX * SHARD_SIZE;
const end = Math.min(groupList.length, start + SHARD_SIZE);
const shardGroups = groupList.slice(start, end);

if (shardGroups.length === 0) {
  throw new Error(`Shard ${SHARD_INDEX} is outside total unique groups ${groupList.length}.`);
}

const shardDir = path.join(REPORT_DIR, "shards");
fs.mkdirSync(shardDir, { recursive: true });
const outputPath = path.join(shardDir, `shard-${String(SHARD_INDEX).padStart(2, "0")}.json`);

let previousPayload = null;
if (AUDIT_PHASE === "retry") {
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Retry requires an existing first-pass shard: ${outputPath}`);
  }
  previousPayload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  if (!Array.isArray(previousPayload?.results)) {
    throw new Error(`Invalid first-pass shard: ${outputPath}`);
  }
}

const previousByKey = new Map(
  Array.isArray(previousPayload?.results)
    ? previousPayload.results.map(row => [row.requestKey, row])
    : []
);

const results = [];
let retriedUnique = 0;
let skippedMatchedUnique = 0;

for (let offset = 0; offset < shardGroups.length; offset += 1) {
  const group = shardGroups[offset];
  const previousResult = previousByKey.get(group.key) || null;

  if (AUDIT_PHASE === "retry" && previousResult?.causeCode === "matched" && previousResult?.image?.hasImage) {
    results.push(previousResult);
    skippedMatchedUnique += 1;
    console.log(`Shard ${SHARD_INDEX}: ${offset + 1}/${shardGroups.length} skip_matched`);
    continue;
  }

  const row = await auditGroup(group, previousResult);
  if (AUDIT_PHASE === "retry") retriedUnique += 1;
  results.push(row);
  console.log(`Shard ${SHARD_INDEX}: ${offset + 1}/${shardGroups.length} ${AUDIT_PHASE} ${row.causeCode}`);
}

fs.writeFileSync(outputPath, `${JSON.stringify({
  schemaVersion: 3,
  complete: true,
  phase: AUDIT_PHASE,
  generatedAt: new Date().toISOString(),
  shardIndex: SHARD_INDEX,
  shardSize: SHARD_SIZE,
  start,
  end,
  totalRecords: hotels.length,
  totalUnique: groupList.length,
  processedUnique: results.length,
  retriedUnique,
  skippedMatchedUnique,
  retryAttemptsPerRequest: RETRY_ATTEMPTS,
  results
}, null, 2)}\n`, "utf8");

console.log(`Saved ${outputPath}`);
