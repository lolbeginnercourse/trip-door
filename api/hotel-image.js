"use strict";

const RAKUTEN_KEYWORD_ENDPOINT = "https://openapi.rakuten.co.jp/engine/api/Travel/KeywordHotelSearch/20260731";
const RAKUTEN_SIMPLE_ENDPOINT = "https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20260731";
const SITE_ORIGIN = "https://mainitiworakunisuru.com";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
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
    .replace(/[\s・･\.·,，、\-‐‑–—―ー_()（）【】\[\]「」『』〈〉《》<>]/g, "");
}

function strictComparableName(value) {
  return compactText(value);
}

function relaxedComparableName(value) {
  return compactText(value)
    .replace(/ホテル/g, "")
    .replace(/hotel/g, "")
    .replace(/byihg/g, "");
}

function rawLocationParts(value) {
  return String(value || "")
    .normalize("NFKC")
    .split(/[\s・･\/／、,，]+/)
    .map(part => part.trim().replace(/駅(?:周辺|近く|前)?$/u, ""))
    .filter(part => compactText(part).length >= 2);
}

function locationTokens(value) {
  const tokens = new Set();
  for (const part of rawLocationParts(value)) {
    const compact = compactText(part);
    if (compact.length >= 2) tokens.add(compact);
  }
  return [...tokens];
}

function containsToken(haystack, tokens) {
  const compact = compactText(haystack);
  return tokens.some(token => token.length >= 2 && compact.includes(token));
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

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`upstream_${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
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
    score += 4;
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

function selectByLocation(candidates, context, minimumScore) {
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

function matchCandidates(candidates, context) {
  const uniqueCandidates = deduplicateCandidates(candidates);
  const strictExpected = strictComparableName(context.name);
  const strictMatches = uniqueCandidates.filter(item => strictExpected && strictComparableName(item.hotelName) === strictExpected);
  if (strictMatches.length === 1) {
    return { status: "matched", image: imageFromMatch(strictMatches[0], "exactName", []) };
  }
  if (strictMatches.length > 1) {
    const selected = selectByLocation(strictMatches, context, 4);
    if (!selected) return { status: "ambiguous", image: null };
    return { status: "matched", image: imageFromMatch(selected.candidate, "exactNameLocation", selected.evidence) };
  }

  const relaxedExpected = relaxedComparableName(context.name);
  const relaxedMatches = uniqueCandidates.filter(item => relaxedExpected && relaxedComparableName(item.hotelName) === relaxedExpected);
  if (relaxedMatches.length) {
    const selected = selectByLocation(relaxedMatches, context, 4);
    if (selected) {
      return { status: "matched", image: imageFromMatch(selected.candidate, "normalizedNameLocation", selected.evidence) };
    }
  }

  const containedMatches = uniqueCandidates.filter(item => {
    const candidateName = strictComparableName(item.hotelName);
    return strictExpected.length >= 5 && candidateName.length >= 5
      && (candidateName.includes(strictExpected) || strictExpected.includes(candidateName));
  });
  if (containedMatches.length) {
    const selected = selectByLocation(containedMatches, context, 4);
    if (selected) {
      return { status: "matched", image: imageFromMatch(selected.candidate, "containedNameLocation", selected.evidence) };
    }
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

async function findImage(context) {
  const credentials = {
    applicationId: process.env.RAKUTEN_APPLICATION_ID,
    accessKey: process.env.RAKUTEN_ACCESS_KEY,
    affiliateId: process.env.RAKUTEN_AFFILIATE_ID
  };
  if (!credentials.applicationId || !credentials.accessKey) return { status: "not_configured", image: null };

  if (context.hotelNo) {
    const candidates = await fetchHotelByNumber(context.hotelNo, credentials);
    const match = candidates.find(item => String(item.hotelNo) === context.hotelNo);
    return { status: match ? "matched" : "not_found", image: match ? imageFromMatch(match, "hotelNo", ["hotelNo"]) : null };
  }

  const allCandidates = [];
  let successfulSearches = 0;
  const queries = [context.name, ...rawLocationParts(context.station).slice(0, 2)];
  const uniqueQueries = [...new Set(queries.filter(Boolean))];

  for (const query of uniqueQueries) {
    try {
      const candidates = await searchHotels(query, credentials);
      successfulSearches += 1;
      allCandidates.push(...candidates);
      const currentMatch = matchCandidates(allCandidates, context);
      if (currentMatch.image) return currentMatch;
    } catch {
      // Try the next conservative query. A result is returned only after strict local matching.
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
    "fallback-v2"
  ]);
  const cached = cache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) {
    return sendJson(res, cached.statusCode, cached.body, cached.cacheControl);
  }

  try {
    const result = await findImage(context);
    if (result.status === "not_configured") {
      return sendJson(res, 503, { image: null, status: result.status });
    }
    const found = Boolean(result.image);
    const statusCode = found ? 200 : 404;
    const cacheControl = found
      ? "public, s-maxage=604800, stale-while-revalidate=2592000"
      : "public, s-maxage=21600, stale-while-revalidate=86400";
    const body = { image: result.image, status: result.status };
    cache.set(cacheKey, { body, statusCode, cacheControl, expiresAt: Date.now() + CACHE_TTL_MS });
    while (cache.size > 2000) cache.delete(cache.keys().next().value);
    return sendJson(res, statusCode, body, cacheControl);
  } catch {
    return sendJson(res, 502, { image: null, error: "upstream_unavailable" });
  }
};

module.exports.findImage = findImage;
