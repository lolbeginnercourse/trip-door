"use strict";

const RAKUTEN_KEYWORD_ENDPOINT = "https://openapi.rakuten.co.jp/engine/api/Travel/KeywordHotelSearch/20260731";
const RAKUTEN_SIMPLE_ENDPOINT = "https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20260731";
const VALUECOMMERCE_ENDPOINT = "https://webservice.valuecommerce.ne.jp/productdb/search";
const SITE_ORIGIN = "https://mainitiworakunisuru.com";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
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

function cleanText(value, max = 120) {
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

function safeUrl(value, providers) {
  try {
    const url = new URL(value);
    if (!providers.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
    if (url.protocol === "http:" && url.hostname === "ck.jp.ap.valuecommerce.com") url.protocol = "https:";
    return url.protocol === "https:" ? url.toString() : null;
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
  return current.count > 40;
}

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: controller.signal });
    if (!response.ok) throw new Error(`upstream_${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function rakutenBasicInfo(entry) {
  if (entry?.hotelBasicInfo) return entry.hotelBasicInfo;
  if (Array.isArray(entry?.hotel)) {
    return entry.hotel.find(section => section?.hotelBasicInfo)?.hotelBasicInfo || null;
  }
  if (Array.isArray(entry)) {
    return entry.find(section => section?.hotelBasicInfo)?.hotelBasicInfo || null;
  }
  return null;
}

async function findRakuten(name, hotelNo) {
  const applicationId = process.env.RAKUTEN_APPLICATION_ID;
  const accessKey = process.env.RAKUTEN_ACCESS_KEY;
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID;
  if (!applicationId || !accessKey || !affiliateId) return null;

  const url = new URL(hotelNo ? RAKUTEN_SIMPLE_ENDPOINT : RAKUTEN_KEYWORD_ENDPOINT);
  url.searchParams.set("applicationId", applicationId);
  url.searchParams.set("accessKey", accessKey);
  url.searchParams.set("affiliateId", affiliateId);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");
  url.searchParams.set("hits", hotelNo ? "1" : "10");
  if (hotelNo) url.searchParams.set("hotelNo", hotelNo);
  else url.searchParams.set("keyword", name);

  const data = await fetchJson(url, { Origin: SITE_ORIGIN, Referer: `${SITE_ORIGIN}/` });
  const expected = comparableName(name);
  const candidates = (Array.isArray(data.hotels) ? data.hotels : []).map(rakutenBasicInfo).filter(Boolean);
  const match = candidates.find(item => {
    if (hotelNo && String(item.hotelNo) === hotelNo) return true;
    return expected && comparableName(item.hotelName) === expected;
  });
  if (!match) return null;
  const link = safeUrl(match.planListUrl || match.hotelInformationUrl, ["rakuten.co.jp"]);
  return link ? { provider: "楽天トラベル", url: link, hotelNo: String(match.hotelNo) } : null;
}

async function findJalan(name, yadNo) {
  const token = process.env.VALUECOMMERCE_PRODUCT_TOKEN;
  if (!token) return null;

  const url = new URL(VALUECOMMERCE_ENDPOINT);
  url.searchParams.set("token", token);
  url.searchParams.set("serv_type", "1");
  url.searchParams.set("keyword", name);
  url.searchParams.set("format", "json");
  url.searchParams.set("results_per_page", "20");
  const data = await fetchJson(url);
  if (data.status !== "OK" || !Array.isArray(data.items)) return null;

  const expected = comparableName(name);
  const match = data.items.find(item => {
    const merchant = `${item.merchantName || ""} ${item.subStoreName || ""}`;
    if (!/じゃらん/i.test(merchant)) return false;
    const combined = `${item.guid || ""} ${item.link || ""}`;
    if (yadNo && new RegExp(`(?:yad|yadNo(?:=|%3D))${yadNo}`, "i").test(combined)) return true;
    return expected && comparableName(item.title).includes(expected);
  });
  if (!match) return null;
  const link = safeUrl(match.link, ["valuecommerce.com"]);
  return link ? { provider: "じゃらん", url: link, yadNo: yadNo || null } : null;
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
  const rakutenHotelNo = cleanIdentifier(req.query?.rakutenHotelNo);
  const jalanYadNo = cleanIdentifier(req.query?.jalanYadNo);
  if (!name) return sendJson(res, 400, { error: "invalid_parameters" });

  const cacheKey = JSON.stringify([name, rakutenHotelNo, jalanYadNo]);
  const cached = cache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) {
    return sendJson(res, 200, cached.body, "public, s-maxage=86400, stale-while-revalidate=604800");
  }

  const [rakuten, jalan] = await Promise.allSettled([
    findRakuten(name, rakutenHotelNo),
    findJalan(name, jalanYadNo)
  ]);
  const links = [rakuten.status === "fulfilled" ? rakuten.value : null, jalan.status === "fulfilled" ? jalan.value : null].filter(Boolean);
  const body = { links };
  cache.set(cacheKey, { body, expiresAt: Date.now() + CACHE_TTL_MS });
  while (cache.size > 1500) cache.delete(cache.keys().next().value);
  return sendJson(res, 200, body, "public, s-maxage=86400, stale-while-revalidate=604800");
};

module.exports.findRakuten = findRakuten;
