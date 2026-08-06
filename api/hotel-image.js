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

function cleanText(value, max = 140) {
  if (typeof value !== "string") return null;
  const text = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > max || /[<>\u0000-\u001f\u007f]/.test(text)) return null;
  return text;
}

function cleanIdentifier(value) {
  const text = String(first(value) || "").trim();
  return /^\d{1,12}$/.test(text) ? text : null;
}

function comparableName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(?:ホテル|hotel|byihg)/g, "")
    .replace(/[\s・･\-―ー_()（）【】\[\]「」『』]/g, "");
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
  return current.count > 60;
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

function imageFromMatch(match, matchedBy) {
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
    source: "rakuten-travel-api"
  };
}

async function findImage(name, hotelNo) {
  const applicationId = process.env.RAKUTEN_APPLICATION_ID;
  const accessKey = process.env.RAKUTEN_ACCESS_KEY;
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;
  if (!applicationId || !accessKey) return { status: "not_configured", image: null };

  const url = new URL(hotelNo ? RAKUTEN_SIMPLE_ENDPOINT : RAKUTEN_KEYWORD_ENDPOINT);
  url.searchParams.set("applicationId", applicationId);
  url.searchParams.set("accessKey", accessKey);
  if (affiliateId) url.searchParams.set("affiliateId", affiliateId);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");
  url.searchParams.set("responseType", "middle");
  url.searchParams.set("hotelThumbnailSize", "3");
  url.searchParams.set("hits", hotelNo ? "1" : "10");
  if (hotelNo) {
    url.searchParams.set("hotelNo", hotelNo);
  } else {
    url.searchParams.set("keyword", name);
    url.searchParams.set("searchField", "1");
  }

  const data = await fetchJson(url, { Origin: SITE_ORIGIN, Referer: `${SITE_ORIGIN}/` });
  const candidates = (Array.isArray(data.hotels) ? data.hotels : []).map(rakutenBasicInfo).filter(Boolean);

  if (hotelNo) {
    const match = candidates.find(item => String(item.hotelNo) === hotelNo);
    return { status: match ? "matched" : "not_found", image: match ? imageFromMatch(match, "hotelNo") : null };
  }

  const expected = comparableName(name);
  const exactMatches = candidates.filter(item => expected && comparableName(item.hotelName) === expected);
  if (exactMatches.length !== 1) {
    return { status: exactMatches.length > 1 ? "ambiguous" : "not_found", image: null };
  }
  return { status: "matched", image: imageFromMatch(exactMatches[0], "exactName") };
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

  const name = cleanText(first(req.query?.name));
  const hotelNo = cleanIdentifier(req.query?.rakutenHotelNo);
  if (!name && !hotelNo) return sendJson(res, 400, { error: "invalid_parameters" });

  const cacheKey = JSON.stringify([name || "", hotelNo || ""]);
  const cached = cache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) {
    return sendJson(res, cached.statusCode, cached.body, cached.cacheControl);
  }

  try {
    const result = await findImage(name, hotelNo);
    if (result.status === "not_configured") {
      return sendJson(res, 503, { image: null, status: result.status });
    }
    const found = Boolean(result.image);
    const statusCode = found ? 200 : 404;
    const cacheControl = found
      ? "public, s-maxage=604800, stale-while-revalidate=2592000"
      : "public, s-maxage=86400, stale-while-revalidate=604800";
    const body = { image: result.image, status: result.status };
    cache.set(cacheKey, { body, statusCode, cacheControl, expiresAt: Date.now() + CACHE_TTL_MS });
    while (cache.size > 2000) cache.delete(cache.keys().next().value);
    return sendJson(res, statusCode, body, cacheControl);
  } catch (error) {
    return sendJson(res, 502, { image: null, error: "upstream_unavailable" });
  }
};
