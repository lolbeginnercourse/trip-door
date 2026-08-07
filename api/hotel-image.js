"use strict";

const { findHotelOverride } = require("./_hotel-image-overrides");

const RAKUTEN_KEYWORD_ENDPOINT = "https://openapi.rakuten.co.jp/engine/api/Travel/KeywordHotelSearch/20260731";
const RAKUTEN_SIMPLE_ENDPOINT = "https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20260731";
const SITE_ORIGIN = "https://mainitiworakunisuru.com";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const UPSTREAM_ATTEMPTS = 2;
const cache = new Map();
const requests = new Map();

function sendJson(res, status, body, cacheControl = "no-store") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanText(value, max = 160) {
  if (typeof value !== "string") return null;
  const text = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > max || /[<>\u0000-\u001f\u007f]/.test(text)) return null;
  return text;
}

function cleanIdentifier(value) {
  const text = String(first(value) || "").trim();
  return /^\d{1,12}$/.test(text) ? text : null;
}

function compactText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/びわ湖/g, "琵琶湖")
    .replace(/[\s・･\.·,，、!！'’`´\-‐‑–—―ー_()（）【】\[\]「」『』〈〉《》<>]/g, "");
}

function relaxedComparableName(value) {
  return compactText(value)
    .replace(/ホテル/g, "")
    .replace(/hotel/g, "")
    .replace(/byihg/g, "")
    .replace(/プレミアム/g, "")
    .replace(/プレミア/g, "");
}

function rawLocationParts(value) {
  return String(value || "")
    .normalize("NFKC")
    .split(/[\s・･\/／、,，]+/)
    .map(part => part.trim().replace(/駅(?:周辺|近く|前)?$/u, ""))
    .filter(part => compactText(part).length >= 2);
}

function locationTokens(value) {
  return [...new Set(rawLocationParts(value).map(compactText).filter(token => token.length >= 2))];
}

function containsToken(haystack, tokens) {
  const compact = compactText(haystack);
  return tokens.some(token => compact.includes(token));
}

function safeImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (!(host === "rakuten.co.jp" || host.endsWith(".rakuten.co.jp") || host === "r10s.jp" || host.endsWith(".r10s.jp"))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function clientId(req) {
  const forwarded = first(req.headers?.["x-forwarded-for"]);
  return String(forwarded || req.socket?.remoteAddress || "unknown").split(",")[0].trim().slice(0, 80);
}

function rateLimited(req) {
  const now = Date.now();
  const key = clientId(req);
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 90;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, headers = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= UPSTREAM_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", ...headers },
        signal: controller.signal
      });
      if (response.ok) return response.json();
      lastError = new Error(`upstream_${response.status}`);
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === UPSTREAM_ATTEMPTS) throw lastError;
    } catch (error) {
      lastError = error;
      if (attempt === UPSTREAM_ATTEMPTS) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(350 * attempt);
  }
  throw lastError || new Error("upstream_failed");
}

function rakutenBasicInfo(entry) {
  if (entry?.hotelBasicInfo) return entry.hotelBasicInfo;
  if (Array.isArray(entry?.hotel)) return entry.hotel.find(section => section?.hotelBasicInfo)?.hotelBasicInfo || null;
  if (Array.isArray(entry)) return entry.find(section => section?.hotelBasicInfo)?.hotelBasicInfo || null;
  return null;
}

function deduplicateCandidates(candidates) {
  const unique = new Map();
  for (const candidate of candidates) {
    const key = String(candidate?.hotelNo || "");
    if (key && !unique.has(key)) unique.set(key, candidate);
  }
  return [...unique.values()];
}

function locationScore(candidate, context) {
  const address = `${candidate?.address1 || ""} ${candidate?.address2 || ""}`;
  const access = String(candidate?.access || "");
  const nearestStation = String(candidate?.nearestStation || "");
  const hotelName = String(candidate?.hotelName || "");
  const evidence = [];
  let score = 0;

  if (context.prefecture && compactText(address).includes(compactText(context.prefecture))) {
    score += 6;
    evidence.push("prefecture");
  }

  const stationTokens = locationTokens(context.station);
  if (stationTokens.length && containsToken(`${address} ${access} ${nearestStation} ${hotelName}`, stationTokens)) {
    score += 5;
    evidence.push("station");
  }

  const areaTokens = locationTokens(context.area);
  if (areaTokens.length && containsToken(`${address} ${access} ${nearestStation} ${hotelName}`, areaTokens)) {
    score += 2;
    evidence.push("area");
  }

  const accessTokens = locationTokens(context.accessEstimate).filter(token => token.length >= 3);
  if (accessTokens.length && containsToken(access, accessTokens)) {
    score += 1;
    evidence.push("access");
  }

  return { score, evidence };
}

function selectByLocation(candidates, context, minimumScore = 4) {
  const ranked = candidates
    .map(candidate => ({ candidate, ...locationScore(candidate, context) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < minimumScore) return null;
  if (second && second.score === best.score) return null;
  return best;
}

function imageFromMatch(match, matchedBy, evidence = []) {
  const src = safeImageUrl(match?.hotelImageUrl) || safeImageUrl(match?.hotelThumbnailUrl);
  if (!src) return null;
  const thumbnail = safeImageUrl(match?.hotelThumbnailUrl) || src;
  return {
    src,
    thumbnail,
    alt: `${match.hotelName || "ホテル"}の施設画像`,
    hotelNo: String(match.hotelNo || ""),
    hotelName: String(match.hotelName || ""),
    matchedBy,
    matchEvidence: evidence,
    source: "rakuten-travel-api"
  };
}

function expectedNames(context) {
  return [...new Set([context.name, ...(context.expectedNames || [])].filter(Boolean))];
}

function matchCandidates(candidates, context) {
  const uniqueCandidates = deduplicateCandidates(candidates);
  const names = expectedNames(context);
  const strictExpected = new Set(names.map(compactText).filter(Boolean));
  const strictMatches = uniqueCandidates.filter(item => strictExpected.has(compactText(item.hotelName)));

  if (strictMatches.length === 1) {
    return { status: "matched", image: imageFromMatch(strictMatches[0], "exactName", []) };
  }
  if (strictMatches.length > 1) {
    const selected = selectByLocation(strictMatches, context, context.prefecture ? 6 : 4);
    if (!selected) return { status: "ambiguous", image: null };
    return { status: "matched", image: imageFromMatch(selected.candidate, "exactNameLocation", selected.evidence) };
  }

  const relaxedExpected = new Set(names.map(relaxedComparableName).filter(value => value.length >= 3));
  const relaxedMatches = uniqueCandidates.filter(item => relaxedExpected.has(relaxedComparableName(item.hotelName)));
  if (relaxedMatches.length === 1) {
    const selected = selectByLocation(relaxedMatches, context, context.prefecture ? 6 : 0) || { candidate: relaxedMatches[0], evidence: [] };
    return { status: "matched", image: imageFromMatch(selected.candidate, "normalizedNameLocation", selected.evidence) };
  }
  if (relaxedMatches.length > 1) {
    const selected = selectByLocation(relaxedMatches, context, context.prefecture ? 6 : 4);
    if (selected) return { status: "matched", image: imageFromMatch(selected.candidate, "normalizedNameLocation", selected.evidence) };
  }

  const strictList = [...strictExpected].filter(value => value.length >= 5);
  const containedMatches = uniqueCandidates.filter(item => {
    const candidateName = compactText(item.hotelName);
    return strictList.some(expected => candidateName.length >= 5 && (candidateName.includes(expected) || expected.includes(candidateName)));
  });
  if (containedMatches.length) {
    const selected = selectByLocation(containedMatches, context, context.prefecture ? 6 : 4);
    if (selected) return { status: "matched", image: imageFromMatch(selected.candidate, "containedNameLocation", selected.evidence) };
    return { status: containedMatches.length > 1 ? "ambiguous" : "location_unverified", image: null };
  }

  return { status: "not_found", image: null };
}

function applyCommonParameters(url, credentials) {
  url.searchParams.set("applicationId", credentials.applicationId);
  url.searchParams.set("accessKey", credentials.accessKey);
  if (credentials.affiliateId) url.searchParams.set("affiliateId", credentials.affiliateId);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");
  url.searchParams.set("responseType", "middle");
  url.searchParams.set("hotelThumbnailSize", "3");
}

async function fetchHotelByNumber(hotelNo, credentials) {
  const url = new URL(RAKUTEN_SIMPLE_ENDPOINT);
  applyCommonParameters(url, credentials);
  url.searchParams.set("hits", "1");
  url.searchParams.set("hotelNo", hotelNo);
  const data = await fetchJson(url, { Origin: SITE_ORIGIN, Referer: `${SITE_ORIGIN}/` });
  return (Array.isArray(data.hotels) ? data.hotels : []).map(rakutenBasicInfo).filter(Boolean);
}

async function searchHotels(keyword, credentials) {
  const url = new URL(RAKUTEN_KEYWORD_ENDPOINT);
  applyCommonParameters(url, credentials);
  url.searchParams.set("hits", "30");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("searchField", "1");
  const data = await fetchJson(url, { Origin: SITE_ORIGIN, Referer: `${SITE_ORIGIN}/` });
  return (Array.isArray(data.hotels) ? data.hotels : []).map(rakutenBasicInfo).filter(Boolean);
}

function buildSearchQueries(context, override) {
  const original = String(context.name || "").normalize("NFKC").trim();
  const variants = [original, ...(override?.expectedNames || [])];
  if (original) {
    variants.push(
      original.replace(/&/g, "＆"),
      original.replace(/[〈〉<>【】\[\]「」『』()（）]/g, " "),
      original.replace(/[!！'’`´]/g, " "),
      original.replace(/[\-‐‑–—―ー]/g, " "),
      original.replace(/\s+/g, ""),
      original.replace(/びわ湖/g, "琵琶湖"),
      original.replace(/東横INN/gi, "東横イン"),
      original.replace(/The OneFive/gi, "ワンファイブ"),
      original.replace(/X\s*wave/gi, "クロスウェーブ"),
      original.replace(/ホテルウィングインターナショナル/g, "ホテルウィング"),
      original.replace(/JR東日本ホテルメッツ\s*プレミア/gi, "JR東日本ホテルメッツ")
    );
  }
  return [...new Set(variants.map(value => String(value || "").replace(/\s+/g, " ").trim()).filter(value => value.length >= 2))].slice(0, 12);
}

async function findImage(inputContext) {
  const credentials = {
    applicationId: process.env.RAKUTEN_APPLICATION_ID,
    accessKey: process.env.RAKUTEN_ACCESS_KEY,
    affiliateId: process.env.RAKUTEN_AFFILIATE_ID
  };
  if (!credentials.applicationId || !credentials.accessKey) return { status: "not_configured", image: null };

  const override = findHotelOverride(inputContext);
  const context = {
    ...inputContext,
    hotelNo: inputContext.hotelNo || override?.hotelNo || null,
    expectedNames: override?.expectedNames || []
  };

  if (context.hotelNo) {
    const candidates = await fetchHotelByNumber(context.hotelNo, credentials);
    const match = candidates.find(item => String(item.hotelNo) === context.hotelNo);
    return {
      status: match ? "matched" : "not_found",
      image: match ? imageFromMatch(match, override ? "hotelNoOverride" : "hotelNo", [override ? "override" : "hotelNo"]) : null
    };
  }

  const allCandidates = [];
  let successfulSearches = 0;
  for (const query of buildSearchQueries(context, override)) {
    try {
      const candidates = await searchHotels(query, credentials);
      successfulSearches += 1;
      allCandidates.push(...candidates);
      const currentMatch = matchCandidates(allCandidates, context);
      if (currentMatch.image) return currentMatch;
    } catch {
      // Continue with the next conservative name variant.
    }
  }

  if (!successfulSearches) throw new Error("all_upstreams_failed");
  return matchCandidates(allCandidates, context);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (rateLimited(req)) {
    res.setHeader("Retry-After", "60");
    return sendJson(res, 429, { error: "too_many_requests" });
  }

  const context = {
    name: cleanText(first(req.query?.name)),
    hotelNo: cleanIdentifier(req.query?.rakutenHotelNo),
    prefecture: cleanText(first(req.query?.prefecture), 40),
    area: cleanText(first(req.query?.area), 100),
    station: cleanText(first(req.query?.station), 100),
    accessEstimate: cleanText(first(req.query?.accessEstimate), 160)
  };
  if (!context.name && !context.hotelNo) return sendJson(res, 400, { error: "invalid_parameters" });

  const cacheKey = JSON.stringify([
    context.name || "",
    context.hotelNo || "",
    context.prefecture || "",
    context.station || "",
    context.area || "",
    "resolution-v3"
  ]);
  const cached = cache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) {
    return sendJson(res, cached.statusCode, cached.body, cached.cacheControl);
  }

  try {
    const result = await findImage(context);
    if (result.status === "not_configured") return sendJson(res, 503, { image: null, status: result.status });
    const found = Boolean(result.image);
    const statusCode = found ? 200 : 404;
    const cacheControl = found
      ? "public, s-maxage=604800, stale-while-revalidate=2592000"
      : "public, s-maxage=21600, stale-while-revalidate=86400";
    const body = { image: result.image, status: result.status };
    cache.set(cacheKey, {
      body,
      statusCode,
      cacheControl,
      expiresAt: Date.now() + (found ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS)
    });
    while (cache.size > 2000) cache.delete(cache.keys().next().value);
    return sendJson(res, statusCode, body, cacheControl);
  } catch {
    return sendJson(res, 502, { image: null, error: "upstream_unavailable" });
  }
};

module.exports.findImage = findImage;
