"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "assets", "data", "hotels.json");
const ENV_PATH = path.join(ROOT, ".env.local");
const REPORT_PATH = path.join(__dirname, "rakuten-sync-report.json");
const OVERRIDES_PATH = path.join(__dirname, "rakuten-hotel-overrides.json");
const CACHE_PATH = path.join(os.tmpdir(), "stayscene-rakuten-sync-cache.json");
const KEYWORD_ENDPOINT = "https://openapi.rakuten.co.jp/engine/api/Travel/KeywordHotelSearch/20260731";
const SIMPLE_ENDPOINT = "https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20260731";
const SITE_ORIGIN = "https://mainitiworakunisuru.com";
const REQUEST_TIMEOUT_MS = 15_000;
const REQUEST_INTERVAL_MS = 750;
const CONCURRENCY = 3;
const MAX_RETRIES = 5;

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/(?:株式会社|有限会社|合同会社|（旧[^）]+）|\(旧[^)]+\))/g, "")
    .replace(/[\s\u3000・･·\.。,:：;；'’`´\-‐‑‒–—―ー_\/\\()（）\[\]【】「」『』〈〉《》]/g, "");
}

function searchName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/（旧[^）]+）|\(旧[^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryName(value) {
  return normalizeName(String(value || "").replace(/[（(][^）)]*[）)]/g, ""));
}

function alternateSearchNames(value) {
  const source = searchName(value);
  const plain = source.replace(/[!！'’・･\.。,&＆()（）〈〉]/g, " ").replace(/\s+/g, " ").trim();
  const withoutBrand = plain
    .replace(/^(?:ホテル)?ウィングインターナショナル(?:プレミアム|セレクト)?/i, "")
    .replace(/^アパホテル\s*リゾート/i, "")
    .replace(/^東横inn(?:北海道|東京|大阪|沖縄)?/i, "")
    .replace(/^(?:the\s+)?onefive/i, "")
    .replace(/^ホテルリブマックス/i, "")
    .replace(/^カンデオホテルズ/i, "")
    .replace(/^コンフォートホテル/i, "")
    .replace(/^ダイワロイネットホテル/i, "")
    .replace(/^フレックステイイン/i, "")
    .trim();
  const distinctive = plain
    .replace(/(?:ホテル|ｈｏｔｅｌ|hotel|インターナショナル|プレミアム|セレクト|リゾート|東横|inn|アパ|マイステイズ|ワシントン|クラウンパレス|ダイワロイネット|コンフォート|フレックステイ|ウィング)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...new Set([source, plain, withoutBrand, distinctive].filter(item => item.length >= 2))];
}

function parseEntry(entry) {
  const sections = Array.isArray(entry?.hotel) ? entry.hotel : Array.isArray(entry) ? entry : [entry];
  return sections.find(section => section?.hotelBasicInfo)?.hotelBasicInfo || entry?.hotelBasicInfo || null;
}

function validAffiliateUrl(value) {
  try {
    const url = new URL(value);
    const validHost = url.hostname === "rakuten.co.jp" || url.hostname.endsWith(".rakuten.co.jp");
    return url.protocol === "https:" && validHost ? url.toString() : null;
  } catch {
    return null;
  }
}

function prefectureMatches(candidate, expectedPrefecture) {
  if (!expectedPrefecture) return true;
  const address = `${candidate.address1 || ""}${candidate.address2 || ""}`;
  return address.includes(expectedPrefecture);
}

function nameScore(expectedName, candidateName) {
  const expected = normalizeName(expectedName);
  const actual = normalizeName(candidateName);
  if (!expected || !actual) return 0;
  if (expected === actual) return 120;
  const shorter = Math.min(expected.length, actual.length);
  const longer = Math.max(expected.length, actual.length);
  const ratio = longer ? shorter / longer : 0;
  if (shorter >= 6 && (expected.includes(actual) || actual.includes(expected))) return 82 + Math.round(ratio * 18);

  const expectedPairs = new Set(Array.from({ length: Math.max(0, expected.length - 1) }, (_, index) => expected.slice(index, index + 2)));
  const actualPairs = new Set(Array.from({ length: Math.max(0, actual.length - 1) }, (_, index) => actual.slice(index, index + 2)));
  if (!expectedPairs.size || !actualPairs.size) return 0;
  let overlap = 0;
  for (const pair of expectedPairs) if (actualPairs.has(pair)) overlap += 1;
  return Math.round((2 * overlap / (expectedPairs.size + actualPairs.size)) * 80);
}

function chooseCandidate(group, candidates) {
  const hotelNo = group.hotelNo;
  const ranked = candidates.map(candidate => {
    const exactId = hotelNo && String(candidate.hotelNo) === String(hotelNo);
    const samePrefecture = prefectureMatches(candidate, group.prefecture);
    const exactName = normalizeName(group.name) === normalizeName(candidate.hotelName);
    const exactPrimaryName = primaryName(group.name) === primaryName(candidate.hotelName);
    const score = exactId ? 300 : exactName ? 250 : exactPrimaryName ? 220 : nameScore(group.name, candidate.hotelName) + (samePrefecture ? 25 : -80);
    return { candidate, exactId, exactName, exactPrimaryName, samePrefecture, score };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  if (!best) return { match: null, reason: "no_candidates", ranked };
  if (!best.samePrefecture && !best.exactId && !best.exactName && !best.exactPrimaryName) return { match: null, reason: "prefecture_mismatch", ranked };
  if (!best.exactId && best.score < 112) return { match: null, reason: "low_score", ranked };
  if (!best.exactId && second && best.score - second.score < 8) return { match: null, reason: "ambiguous", ranked };

  const url = validAffiliateUrl(best.candidate.planListUrl || best.candidate.hotelInformationUrl);
  if (!url) return { match: null, reason: "missing_affiliate_url", ranked };
  return {
    match: {
      hotelNo: String(best.candidate.hotelNo),
      hotelName: best.candidate.hotelName,
      address: `${best.candidate.address1 || ""}${best.candidate.address2 || ""}`,
      url,
      score: best.score
    },
    reason: best.exactId ? "hotel_no" : best.exactName ? "exact_name" : best.exactPrimaryName ? "exact_primary_name" : "name_and_prefecture",
    ranked
  };
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Origin: SITE_ORIGIN,
          Referer: `${SITE_ORIGIN}/`
        },
        signal: controller.signal
      });
      if (response.ok) return response.json();
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) {
        const error = new Error(`Rakuten API returned HTTP ${response.status}`);
        error.nonRetryable = true;
        throw error;
      }
      lastError = new Error(`Rakuten API temporarily returned HTTP ${response.status}`);
    } catch (error) {
      if (error?.nonRetryable) throw error;
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(1_500 * (attempt + 1));
  }
  throw lastError || new Error("Rakuten API request failed");
}

async function queryRakuten(group, credentials) {
  const queries = group.hotelNo ? [null] : alternateSearchNames(group.name);
  const found = new Map();
  let lastError = null;
  for (const query of queries) {
    const url = new URL(group.hotelNo ? SIMPLE_ENDPOINT : KEYWORD_ENDPOINT);
    url.searchParams.set("applicationId", credentials.applicationId);
    url.searchParams.set("accessKey", credentials.accessKey);
    url.searchParams.set("affiliateId", credentials.affiliateId);
    url.searchParams.set("format", "json");
    url.searchParams.set("formatVersion", "2");
    url.searchParams.set("responseType", "middle");
    url.searchParams.set("hits", group.hotelNo ? "1" : "30");
    if (group.hotelNo) url.searchParams.set("hotelNo", group.hotelNo);
    else url.searchParams.set("keyword", query);
    try {
      const data = await fetchJson(url);
      for (const candidate of (Array.isArray(data.hotels) ? data.hotels : []).map(parseEntry).filter(Boolean)) {
        if (candidate.hotelNo) found.set(String(candidate.hotelNo), candidate);
      }
    } catch (error) {
      lastError = error;
      if (group.hotelNo || !/HTTP (400|404)/.test(error.message)) throw error;
    }
  }
  if (!found.size && lastError) throw lastError;
  return [...found.values()];
}

function readCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");
}

function publicCandidate(item) {
  if (!item) return null;
  return {
    hotelNo: item.candidate?.hotelNo ? String(item.candidate.hotelNo) : null,
    hotelName: item.candidate?.hotelName || null,
    address: item.candidate ? `${item.candidate.address1 || ""}${item.candidate.address2 || ""}` : null,
    score: item.score
  };
}

async function main() {
  loadEnv(ENV_PATH);
  const credentials = {
    applicationId: process.env.RAKUTEN_APPLICATION_ID,
    accessKey: process.env.RAKUTEN_ACCESS_KEY,
    affiliateId: process.env.RAKUTEN_AFFILIATE_ID
  };
  if (!credentials.applicationId || !credentials.accessKey || !credentials.affiliateId) {
    throw new Error("RAKUTEN_APPLICATION_ID, RAKUTEN_ACCESS_KEY and RAKUTEN_AFFILIATE_ID are required in .env.local");
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const hotelNumberOverrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
  if (!Array.isArray(data.hotels)) throw new Error("assets/data/hotels.json does not contain a hotels array");

  const groups = new Map();
  for (const hotel of data.hotels) {
    if (!hotel?.name) continue;
    const key = `${normalizeName(hotel.name)}|${hotel.prefecture || ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: hotel.name,
        prefecture: hotel.prefecture || "",
        hotelNo: hotel.rakutenHotelNo ? String(hotel.rakutenHotelNo) : hotelNumberOverrides[hotel.name] || null,
        ids: []
      });
    }
    const group = groups.get(key);
    group.ids.push(hotel.id);
    if (!group.hotelNo && hotel.rakutenHotelNo) group.hotelNo = String(hotel.rakutenHotelNo);
  }

  const cache = readCache();
  const allGroups = [...groups.values()];
  const pendingGroups = allGroups.filter(group => !cache[group.key]);
  let nextIndex = 0;
  let processed = allGroups.length - pendingGroups.length;
  let matched = allGroups.filter(group => cache[group.key]?.status === "matched").length;
  let failed = processed - matched;
  console.log(`楽天トラベル照合開始: ${allGroups.length}施設 / ${data.hotels.length}掲載行`);

  if (processed) console.log(`途中結果から再開: ${processed}/${allGroups.length}（一致 ${matched} / 未一致 ${failed}）`);

  async function worker() {
    while (nextIndex < pendingGroups.length) {
      const group = pendingGroups[nextIndex];
      nextIndex += 1;
      try {
        const candidates = await queryRakuten(group, credentials);
        const chosen = chooseCandidate(group, candidates);
        cache[group.key] = {
          status: chosen.match ? "matched" : "unmatched",
          reason: chosen.reason,
          match: chosen.match,
          candidates: chosen.ranked.slice(0, 3).map(publicCandidate)
        };
      } catch (error) {
        cache[group.key] = { status: "error", reason: error.message, match: null, candidates: [] };
      }
      writeCache(cache);
      await sleep(REQUEST_INTERVAL_MS);

      processed += 1;
      if (cache[group.key].status === "matched") matched += 1;
      else failed += 1;
      if (processed === 1 || processed % 25 === 0 || processed === allGroups.length) {
        console.log(`[${processed}/${allGroups.length}] 一致 ${matched} / 未一致 ${failed}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pendingGroups.length) }, worker));

  let updatedRows = 0;
  for (const hotel of data.hotels) {
    const key = `${normalizeName(hotel.name)}|${hotel.prefecture || ""}`;
    const result = cache[key];
    if (result?.status !== "matched" || !result.match) continue;
    hotel.rakutenHotelNo = result.match.hotelNo;
    hotel.rakuten = result.match.url;
    updatedRows += 1;
  }

  const unmatched = allGroups.filter(group => cache[group.key]?.status !== "matched").map(group => ({
    name: group.name,
    prefecture: group.prefecture,
    listingRows: group.ids.length,
    reason: cache[group.key]?.reason || "unknown",
    candidates: cache[group.key]?.candidates || []
  }));
  const report = {
    generatedAt: new Date().toISOString(),
    totalListingRows: data.hotels.length,
    uniqueFacilities: allGroups.length,
    matchedFacilities: allGroups.length - unmatched.length,
    unmatchedFacilities: unmatched.length,
    updatedListingRows: updatedRows,
    unmatched
  };

  fs.writeFileSync(DATA_PATH, JSON.stringify(data), "utf8");
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`反映完了: ${report.matchedFacilities}/${report.uniqueFacilities}施設、${updatedRows}掲載行`);
  console.log(`未一致レポート: ${REPORT_PATH}`);
}

main().catch(error => {
  console.error(`同期失敗: ${error.message}`);
  process.exitCode = 1;
});
