"use strict";

const RAKUTEN_ENDPOINT = "https://openapi.rakuten.co.jp/engine/api/Travel/KeywordHotelSearch/20260731";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const SITE_ORIGIN = "https://mainitiworakunisuru.com";
const cache = new Map();
const requestCounts = new Map();

function sendJson(res, status, body, cacheControl = "no-store") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

function singleQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function integerInRange(value, fallback, min, max) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function cleanKeyword(value) {
  if (typeof value !== "string") return null;
  const keyword = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (keyword.length < 2 || keyword.length > 50) return null;
  if (/[<>\u0000-\u001f\u007f]/.test(keyword)) return null;
  return keyword;
}

function hotelSections(entry) {
  if (Array.isArray(entry?.hotel)) return entry.hotel;
  if (Array.isArray(entry)) return entry;
  if (entry?.hotel && typeof entry.hotel === "object") return [entry.hotel];
  return [entry];
}

function normalizeHotel(entry) {
  const sections = hotelSections(entry).filter(Boolean);
  const basic = sections.find(section => section.hotelBasicInfo)?.hotelBasicInfo
    || entry?.hotelBasicInfo
    || sections[0]
    || {};
  const rating = sections.find(section => section.hotelRatingInfo)?.hotelRatingInfo
    || entry?.hotelRatingInfo
    || {};

  const imageUrl = basic.hotelImageUrl || basic.hotelThumbnailUrl || null;
  const bookingUrl = basic.planListUrl || basic.hotelInformationUrl || null;

  return {
    id: basic.hotelNo ? String(basic.hotelNo) : null,
    name: basic.hotelName || "",
    description: basic.hotelSpecial || "",
    address: [basic.address1, basic.address2].filter(Boolean).join(""),
    access: basic.access || "",
    minimumPrice: Number.isFinite(Number(basic.hotelMinCharge)) ? Number(basic.hotelMinCharge) : null,
    reviewAverage: Number.isFinite(Number(rating.serviceAverage || basic.reviewAverage))
      ? Number(rating.serviceAverage || basic.reviewAverage)
      : null,
    reviewCount: Number.isFinite(Number(basic.reviewCount)) ? Number(basic.reviewCount) : null,
    imageUrl: typeof imageUrl === "string" && imageUrl.startsWith("https://") ? imageUrl : null,
    bookingUrl: typeof bookingUrl === "string" && bookingUrl.startsWith("https://") ? bookingUrl : null,
    latitude: Number.isFinite(Number(basic.latitude)) ? Number(basic.latitude) : null,
    longitude: Number.isFinite(Number(basic.longitude)) ? Number(basic.longitude) : null
  };
}

function pruneCache() {
  const now = Date.now();
  for (const [key, value] of cache) {
    if (value.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > 100) cache.delete(cache.keys().next().value);
}

function clientIdentifier(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(value || req.socket?.remoteAddress || "unknown").split(",")[0].trim().slice(0, 80);
}

function isRateLimited(req) {
  const now = Date.now();
  const key = clientIdentifier(req);
  const current = requestCounts.get(key);
  if (!current || current.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  if (requestCounts.size > 1000) {
    for (const [id, value] of requestCounts) {
      if (value.resetAt <= now) requestCounts.delete(id);
    }
  }
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (isRateLimited(req)) {
    res.setHeader("Retry-After", "60");
    return sendJson(res, 429, { error: "too_many_requests" });
  }

  const applicationId = process.env.RAKUTEN_APPLICATION_ID;
  const accessKey = process.env.RAKUTEN_ACCESS_KEY;
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;
  if (!applicationId || !accessKey) {
    return sendJson(res, 503, { error: "service_not_configured" });
  }

  const keyword = cleanKeyword(singleQueryValue(req.query?.keyword));
  const page = integerInRange(singleQueryValue(req.query?.page), 1, 1, 100);
  const hits = integerInRange(singleQueryValue(req.query?.hits), 10, 1, 20);
  if (!keyword || page === null || hits === null) {
    return sendJson(res, 400, { error: "invalid_parameters" });
  }

  const cacheKey = JSON.stringify([keyword, page, hits]);
  const cached = cache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) {
    return sendJson(res, 200, cached.body, "public, s-maxage=300, stale-while-revalidate=600");
  }

  const url = new URL(RAKUTEN_ENDPOINT);
  url.searchParams.set("applicationId", applicationId);
  url.searchParams.set("accessKey", accessKey);
  if (affiliateId) url.searchParams.set("affiliateId", affiliateId);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("page", String(page));
  url.searchParams.set("hits", String(hits));
  url.searchParams.set("hotelThumbnailSize", "3");
  url.searchParams.set("responseType", "middle");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: "application/json",
        Origin: SITE_ORIGIN,
        Referer: `${SITE_ORIGIN}/`
      },
      signal: controller.signal
    });

    if (!upstream.ok) {
      const status = upstream.status === 429 ? 503 : 502;
      return sendJson(res, status, { error: upstream.status === 429 ? "temporarily_rate_limited" : "upstream_error" });
    }

    const data = await upstream.json();
    const hotels = (Array.isArray(data.hotels) ? data.hotels : [])
      .map(normalizeHotel)
      .filter(hotel => hotel.id && hotel.name && hotel.bookingUrl);
    const paging = data.pagingInfo || {};
    const body = {
      keyword,
      page,
      hits,
      total: Number.isFinite(Number(paging.recordCount)) ? Number(paging.recordCount) : hotels.length,
      pageCount: Number.isFinite(Number(paging.pageCount)) ? Number(paging.pageCount) : 1,
      hotels
    };

    pruneCache();
    cache.set(cacheKey, { body, expiresAt: Date.now() + CACHE_TTL_MS });
    return sendJson(res, 200, body, "public, s-maxage=300, stale-while-revalidate=600");
  } catch (error) {
    const isTimeout = error?.name === "AbortError";
    return sendJson(res, 502, { error: isTimeout ? "upstream_timeout" : "upstream_unavailable" });
  } finally {
    clearTimeout(timeout);
  }
};
