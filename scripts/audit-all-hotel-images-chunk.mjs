import fs from "node:fs";
import path from "node:path";

const ORIGIN = "https://mainitiworakunisuru.com";
const DATA_PATH = "assets/data/hotels.json";
const REPORT_DIR = "reports/all-hotel-image-audit-20260807";
const PROGRESS_PATH = path.join(REPORT_DIR, "progress.json");
const UNIQUE_RESULTS_PATH = path.join(REPORT_DIR, "unique-results.json");
const IMAGE_CHUNK_SIZE = Number(process.env.IMAGE_CHUNK_SIZE || 50);
const AFFILIATE_CHUNK_SIZE = Number(process.env.AFFILIATE_CHUNK_SIZE || 25);
const IMAGE_INTERVAL_MS = Number(process.env.IMAGE_INTERVAL_MS || 1150);
const AFFILIATE_INTERVAL_MS = Number(process.env.AFFILIATE_INTERVAL_MS || 1700);
const AUDIT_TOKEN = `chunk-${Date.now()}`;

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

async function fetchJsonWithRetry(url, attempts = 4) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Origin: ORIGIN,
          Referer: `${ORIGIN}/`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36"
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
        contentType: response.headers.get("content-type") || "",
        rawExcerpt: data ? null : raw.slice(0, 300)
      };
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts) return last;
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await sleep(retryAfter > 0 ? retryAfter * 1000 : Math.min(15000, 1500 * (2 ** (attempt - 1))));
    } catch (error) {
      last = { httpStatus: 0, data: null, error: String(error?.message || error) };
      if (attempt === attempts) return last;
      await sleep(Math.min(15000, 1500 * (2 ** (attempt - 1))));
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
    matchEvidence: Array.isArray(image?.matchEvidence) ? image.matchEvidence.map(text).filter(Boolean) : [],
    transportError: text(response?.error),
    rawExcerpt: text(response?.rawExcerpt)
  };
}

function summarizeAffiliateResponse(response) {
  const links = Array.isArray(response?.data?.links) ? response.data.links : [];
  const rakuten = links.find(link => link?.provider === "楽天トラベル") || null;
  return {
    httpStatus: Number(response?.httpStatus || 0),
    providers: links.map(link => text(link?.provider)).filter(Boolean),
    hasRakuten: Boolean(rakuten),
    rakutenHotelNo: text(rakuten?.hotelNo),
    transportError: text(response?.error),
    rawExcerpt: text(response?.rawExcerpt)
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
  if ([500, 502, 503, 504].includes(image.httpStatus) || image.status === "upstream_unavailable") return "temporary_upstream_error";
  if (image.httpStatus === 403) return "request_blocked";
  if (image.httpStatus === 0) return "network_error";
  return "other_error";
}

const causeLabels = {
  matched: "画像取得成功",
  matched_but_no_image_url: "楽天施設は一致したが画像URLがない",
  multiple_candidates: "同名候補が複数あり一意に決められない",
  location_unverified: "名称候補はあるが所在地を確認できない",
  rakuten_credentials_missing: "楽天API認証情報が使えない",
  image_match_gap_affiliate_found: "楽天リンクは取れるが画像照合で不一致",
  not_found_by_current_rakuten_search: "現在の楽天検索では施設を見つけられない",
  rate_limited: "APIのアクセス制限",
  temporary_upstream_error: "楽天またはVercelの一時エラー",
  request_blocked: "リクエストが拒否された",
  network_error: "通信エラー",
  other_error: "その他のエラー"
};

function increment(object, key, amount = 1) {
  object[key] = (object[key] || 0) + amount;
}

function csvCell(value) {
  const valueText = String(value ?? "");
  return /[",\n\r]/.test(valueText) ? `"${valueText.replace(/"/g, '""')}"` : valueText;
}

function writeCsv(filePath, rows) {
  const headers = [
    "id", "name", "prefecture", "station", "area", "venueId", "rakutenHotelNo",
    "imageStatus", "causeCode", "cause", "httpStatus", "affiliateRakuten",
    "affiliateHotelNo", "matchedHotelName", "matchedHotelNo", "matchedBy"
  ];
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map(header => csvCell(row[header])).join(","));
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function saveJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

fs.mkdirSync(REPORT_DIR, { recursive: true });
const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const hotels = normalizeHotels(payload);
const groups = new Map();
for (let index = 0; index < hotels.length; index += 1) {
  const hotel = hotels[index];
  const key = requestKey(hotel);
  if (!groups.has(key)) groups.set(key, { key, hotel, indexes: [] });
  groups.get(key).indexes.push(index);
}
const groupList = [...groups.values()];

let progress = fs.existsSync(PROGRESS_PATH)
  ? JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"))
  : {
      phase: "images",
      totalRecords: hotels.length,
      totalUnique: groupList.length,
      nextImageIndex: 0,
      nextAffiliateIndex: 0,
      runs: 0,
      startedAt: new Date().toISOString()
    };
let uniqueResults = fs.existsSync(UNIQUE_RESULTS_PATH)
  ? JSON.parse(fs.readFileSync(UNIQUE_RESULTS_PATH, "utf8"))
  : {};

progress.runs = Number(progress.runs || 0) + 1;
progress.updatedAt = new Date().toISOString();

if (progress.phase === "images") {
  const start = Number(progress.nextImageIndex || 0);
  const end = Math.min(groupList.length, start + IMAGE_CHUNK_SIZE);
  console.log(`Image chunk ${start}-${end} / ${groupList.length}`);
  for (let index = start; index < end; index += 1) {
    const group = groupList[index];
    const response = await fetchJsonWithRetry(imageUrlFor(group.hotel));
    uniqueResults[group.key] = {
      image: summarizeImageResponse(response),
      affiliate: uniqueResults[group.key]?.affiliate || null
    };
    progress.nextImageIndex = index + 1;
    progress.updatedAt = new Date().toISOString();
    if ((index + 1) % 10 === 0 || index + 1 === end) {
      saveJson(PROGRESS_PATH, progress);
      saveJson(UNIQUE_RESULTS_PATH, uniqueResults);
      console.log(`Image progress ${index + 1}/${groupList.length}`);
    }
    await sleep(IMAGE_INTERVAL_MS);
  }
  if (progress.nextImageIndex >= groupList.length) {
    progress.phase = "affiliates";
    progress.nextAffiliateIndex = 0;
  }
}

if (progress.phase === "affiliates") {
  const failedGroups = groupList.filter(group => !uniqueResults[group.key]?.image?.hasImage);
  const start = Number(progress.nextAffiliateIndex || 0);
  const end = Math.min(failedGroups.length, start + AFFILIATE_CHUNK_SIZE);
  console.log(`Affiliate chunk ${start}-${end} / ${failedGroups.length}`);
  for (let index = start; index < end; index += 1) {
    const group = failedGroups[index];
    const response = await fetchJsonWithRetry(affiliateUrlFor(group.hotel));
    uniqueResults[group.key].affiliate = summarizeAffiliateResponse(response);
    progress.nextAffiliateIndex = index + 1;
    progress.updatedAt = new Date().toISOString();
    if ((index + 1) % 5 === 0 || index + 1 === end) {
      saveJson(PROGRESS_PATH, progress);
      saveJson(UNIQUE_RESULTS_PATH, uniqueResults);
      console.log(`Affiliate progress ${index + 1}/${failedGroups.length}`);
    }
    await sleep(AFFILIATE_INTERVAL_MS);
  }
  if (progress.nextAffiliateIndex >= failedGroups.length) progress.phase = "finalize";
}

if (progress.phase === "finalize") {
  const recordResults = hotels.map((hotel, index) => {
    const key = requestKey(hotel);
    const result = uniqueResults[key];
    const cause = causeCode(result.image, result.affiliate);
    return {
      index,
      id: text(hotel?.id),
      name: text(hotel?.name),
      prefecture: text(hotel?.prefecture),
      station: text(hotel?.station),
      area: text(hotel?.area),
      venueId: text(hotel?.venueId),
      requestKey: key,
      duplicateGroupSize: groups.get(key)?.indexes?.length || 1,
      storedRakutenHotelNo: validHotelNo(hotel?.rakutenHotelNo),
      image: result.image,
      affiliate: result.affiliate,
      causeCode: cause,
      cause: causeLabels[cause] || cause
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    totalRecords: hotels.length,
    uniqueRequestKeys: groups.size,
    duplicateRecordsSharingRequests: hotels.length - groups.size,
    storedHotelNoRecords: recordResults.filter(row => row.storedRakutenHotelNo).length,
    recordsMatched: recordResults.filter(row => row.image.hasImage).length,
    recordsFailed: recordResults.filter(row => !row.image.hasImage).length,
    recordSuccessRate: Number((recordResults.filter(row => row.image.hasImage).length / Math.max(1, hotels.length) * 100).toFixed(2)),
    uniqueMatched: Object.values(uniqueResults).filter(result => result.image.hasImage).length,
    uniqueFailed: Object.values(uniqueResults).filter(result => !result.image.hasImage).length,
    recordCountsByCause: {},
    uniqueCountsByCause: {},
    recordCountsByStatus: {},
    uniqueCountsByStatus: {},
    recordCountsByMatchedBy: {},
    uniqueCountsByMatchedBy: {},
    failedUniqueWithRakutenAffiliateLink: 0,
    failedUniqueWithoutRakutenAffiliateLink: 0
  };

  for (const row of recordResults) {
    increment(summary.recordCountsByCause, row.causeCode);
    increment(summary.recordCountsByStatus, row.image.status || "unknown");
    if (row.image.hasImage) increment(summary.recordCountsByMatchedBy, row.image.matchedBy || "unknown");
  }
  for (const group of groupList) {
    const result = uniqueResults[group.key];
    const cause = causeCode(result.image, result.affiliate);
    increment(summary.uniqueCountsByCause, cause);
    increment(summary.uniqueCountsByStatus, result.image.status || "unknown");
    if (result.image.hasImage) increment(summary.uniqueCountsByMatchedBy, result.image.matchedBy || "unknown");
    else if (result.affiliate?.hasRakuten) summary.failedUniqueWithRakutenAffiliateLink += 1;
    else summary.failedUniqueWithoutRakutenAffiliateLink += 1;
  }

  const failures = recordResults.filter(row => !row.image.hasImage);
  const failureCsvRows = failures.map(row => ({
    id: row.id,
    name: row.name,
    prefecture: row.prefecture,
    station: row.station,
    area: row.area,
    venueId: row.venueId,
    rakutenHotelNo: row.storedRakutenHotelNo,
    imageStatus: row.image.status,
    causeCode: row.causeCode,
    cause: row.cause,
    httpStatus: row.image.httpStatus,
    affiliateRakuten: row.affiliate?.hasRakuten ? "yes" : "no",
    affiliateHotelNo: row.affiliate?.rakutenHotelNo || "",
    matchedHotelName: row.image.hotelName,
    matchedHotelNo: row.image.hotelNo,
    matchedBy: row.image.matchedBy
  }));

  const uniqueFailures = groupList
    .filter(group => !uniqueResults[group.key]?.image?.hasImage)
    .map(group => {
      const result = uniqueResults[group.key];
      const cause = causeCode(result.image, result.affiliate);
      return {
        requestKey: group.key,
        affectedRecordCount: group.indexes.length,
        sampleRecordIds: group.indexes.slice(0, 10).map(index => text(hotels[index]?.id)),
        hotel: {
          name: text(group.hotel?.name),
          prefecture: text(group.hotel?.prefecture),
          station: text(group.hotel?.station),
          area: text(group.hotel?.area),
          rakutenHotelNo: validHotelNo(group.hotel?.rakutenHotelNo)
        },
        image: result.image,
        affiliate: result.affiliate,
        causeCode: cause,
        cause: causeLabels[cause] || cause
      };
    });

  const causeRows = Object.entries(summary.recordCountsByCause)
    .sort((a, b) => b[1] - a[1])
    .map(([code, recordCount]) => `| ${causeLabels[code] || code} | ${recordCount} | ${summary.uniqueCountsByCause[code] || 0} |`);

  const markdown = [
    "# 全ホテル画像取得監査",
    "",
    `- 全レコード: ${summary.totalRecords}`,
    `- 重複除外施設: ${summary.uniqueRequestKeys}`,
    `- 画像取得成功レコード: ${summary.recordsMatched}`,
    `- 画像取得失敗レコード: ${summary.recordsFailed}`,
    `- 成功率: ${summary.recordSuccessRate}%`,
    "",
    "## 原因別件数",
    "",
    "| 原因 | レコード数 | 重複除外施設数 |",
    "|---|---:|---:|",
    ...causeRows,
    ""
  ].join("\n");

  saveJson(path.join(REPORT_DIR, "summary.json"), summary);
  saveJson(path.join(REPORT_DIR, "unique-failures.json"), uniqueFailures);
  saveJson(path.join(REPORT_DIR, "record-results.json"), recordResults);
  writeCsv(path.join(REPORT_DIR, "failures.csv"), failureCsvRows);
  fs.writeFileSync(path.join(REPORT_DIR, "summary.md"), markdown, "utf8");
  progress.phase = "complete";
  progress.completedAt = new Date().toISOString();
}

saveJson(PROGRESS_PATH, progress);
saveJson(UNIQUE_RESULTS_PATH, uniqueResults);
console.log(JSON.stringify({
  phase: progress.phase,
  nextImageIndex: progress.nextImageIndex,
  totalUnique: groupList.length,
  nextAffiliateIndex: progress.nextAffiliateIndex,
  runs: progress.runs
}));
