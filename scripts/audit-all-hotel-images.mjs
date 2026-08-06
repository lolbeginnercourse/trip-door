import fs from "node:fs";
import path from "node:path";

const ORIGIN = "https://mainitiworakunisuru.com";
const DATA_PATH = "assets/data/hotels.json";
const REPORT_DIR = "reports/all-hotel-image-audit-20260807";
const IMAGE_INTERVAL_MS = Number(process.env.IMAGE_INTERVAL_MS || 1150);
const AFFILIATE_INTERVAL_MS = Number(process.env.AFFILIATE_INTERVAL_MS || 1700);
const AUDIT_TOKEN = `full-${Date.now()}`;

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

async function fetchJsonWithRetry(url, attempts = 5) {
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
      await sleep(retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 2500 * (2 ** (attempt - 1))));
    } catch (error) {
      last = { httpStatus: 0, data: null, error: String(error?.message || error) };
      if (attempt === attempts) return last;
      await sleep(Math.min(30000, 2500 * (2 ** (attempt - 1))));
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
  for (const row of rows) {
    lines.push(headers.map(header => csvCell(row[header])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const hotels = normalizeHotels(payload);
if (hotels.length !== 1256) {
  console.warn(`Expected 1256 records, found ${hotels.length}`);
}

const groups = new Map();
for (let index = 0; index < hotels.length; index += 1) {
  const hotel = hotels[index];
  const key = requestKey(hotel);
  if (!groups.has(key)) groups.set(key, { key, hotel, indexes: [] });
  groups.get(key).indexes.push(index);
}

console.log(`Records: ${hotels.length}; unique request keys: ${groups.size}`);

const uniqueResults = new Map();
const groupList = [...groups.values()];
for (let index = 0; index < groupList.length; index += 1) {
  const group = groupList[index];
  const response = await fetchJsonWithRetry(imageUrlFor(group.hotel));
  const image = summarizeImageResponse(response);
  uniqueResults.set(group.key, { image, affiliate: null });
  if ((index + 1) % 25 === 0 || index + 1 === groupList.length) {
    console.log(`Image audit ${index + 1}/${groupList.length}`);
  }
  await sleep(IMAGE_INTERVAL_MS);
}

const failedGroups = groupList.filter(group => !uniqueResults.get(group.key)?.image?.hasImage);
console.log(`Unique image failures before affiliate comparison: ${failedGroups.length}`);

for (let index = 0; index < failedGroups.length; index += 1) {
  const group = failedGroups[index];
  const response = await fetchJsonWithRetry(affiliateUrlFor(group.hotel));
  uniqueResults.get(group.key).affiliate = summarizeAffiliateResponse(response);
  if ((index + 1) % 20 === 0 || index + 1 === failedGroups.length) {
    console.log(`Affiliate comparison ${index + 1}/${failedGroups.length}`);
  }
  await sleep(AFFILIATE_INTERVAL_MS);
}

const recordResults = hotels.map((hotel, index) => {
  const key = requestKey(hotel);
  const result = uniqueResults.get(key);
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
  sourceCommit: process.env.GITHUB_SHA || null,
  productionOrigin: ORIGIN,
  totalRecords: hotels.length,
  uniqueRequestKeys: groups.size,
  duplicateRecordsSharingRequests: hotels.length - groups.size,
  storedHotelNoRecords: recordResults.filter(row => row.storedRakutenHotelNo).length,
  recordsMatched: recordResults.filter(row => row.image.hasImage).length,
  recordsFailed: recordResults.filter(row => !row.image.hasImage).length,
  recordSuccessRate: Number((recordResults.filter(row => row.image.hasImage).length / Math.max(1, hotels.length) * 100).toFixed(2)),
  uniqueMatched: [...uniqueResults.values()].filter(result => result.image.hasImage).length,
  uniqueFailed: [...uniqueResults.values()].filter(result => !result.image.hasImage).length,
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
  const result = uniqueResults.get(group.key);
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

const uniqueFailures = failedGroups.map(group => {
  const result = uniqueResults.get(group.key);
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
  .map(([code, recordCount]) => {
    const uniqueCount = summary.uniqueCountsByCause[code] || 0;
    return `| ${causeLabels[code] || code} | ${recordCount} | ${uniqueCount} |`;
  });

const matchedByRows = Object.entries(summary.recordCountsByMatchedBy)
  .sort((a, b) => b[1] - a[1])
  .map(([method, recordCount]) => `| ${method} | ${recordCount} | ${summary.uniqueCountsByMatchedBy[method] || 0} |`);

const markdown = `# 全ホテル画像取得監査\n\n` +
  `- 対象レコード: ${summary.totalRecords}件\n` +
  `- API問い合わせ単位: ${summary.uniqueRequestKeys}件\n` +
  `- 重複により共有したレコード: ${summary.duplicateRecordsSharingRequests}件\n` +
  `- 画像取得成功: ${summary.recordsMatched}件\n` +
  `- 画像取得失敗: ${summary.recordsFailed}件\n` +
  `- 成功率: ${summary.recordSuccessRate}%\n` +
  `- ユニーク単位の成功: ${summary.uniqueMatched}件\n` +
  `- ユニーク単位の失敗: ${summary.uniqueFailed}件\n\n` +
  `## 原因別集計\n\n| 原因 | レコード数 | ユニーク数 |\n|---|---:|---:|\n${causeRows.join("\n")}\n\n` +
  `## 成功した照合方法\n\n| 照合方法 | レコード数 | ユニーク数 |\n|---|---:|---:|\n${matchedByRows.join("\n")}\n\n` +
  `## 楽天リンクとの比較\n\n` +
  `- 画像失敗だが楽天リンクは取得できたユニークホテル: ${summary.failedUniqueWithRakutenAffiliateLink}件\n` +
  `- 画像・楽天リンクの両方で見つからなかったユニークホテル: ${summary.failedUniqueWithoutRakutenAffiliateLink}件\n\n` +
  `「現在の楽天検索では施設を見つけられない」は、楽天に存在しないと断定する分類ではありません。名称変更、閉館、楽天未掲載、データ側の名称違い、検索APIの候補不足を含みます。\n`;

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(path.join(REPORT_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(REPORT_DIR, "summary.md"), markdown, "utf8");
fs.writeFileSync(path.join(REPORT_DIR, "unique-failures.json"), `${JSON.stringify(uniqueFailures, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(REPORT_DIR, "record-results.json"), `${JSON.stringify(recordResults, null, 2)}\n`, "utf8");
writeCsv(path.join(REPORT_DIR, "failures.csv"), failureCsvRows);

console.log(markdown);
