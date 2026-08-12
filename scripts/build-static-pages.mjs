import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SAMPLE = process.argv.includes("--sample");
const OUTPUT_ROOT = SAMPLE ? path.join(ROOT, ".static-preview") : ROOT;
const SITE_URL = "https://mainitiworakunisuru.com";
const DATA_PATH = path.join(ROOT, "assets", "data", "hotels.json");
const DETAIL_PATH = path.join(ROOT, "assets", "data", "hotel-details.json");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, ".static-generated.json");

const PREFECTURE_SLUGS = {
  "北海道": "hokkaido", "青森県": "aomori", "岩手県": "iwate", "宮城県": "miyagi", "秋田県": "akita", "山形県": "yamagata", "福島県": "fukushima",
  "茨城県": "ibaraki", "栃木県": "tochigi", "群馬県": "gunma", "埼玉県": "saitama", "千葉県": "chiba", "東京都": "tokyo", "神奈川県": "kanagawa",
  "新潟県": "niigata", "富山県": "toyama", "石川県": "ishikawa", "福井県": "fukui", "山梨県": "yamanashi", "長野県": "nagano",
  "岐阜県": "gifu", "静岡県": "shizuoka", "愛知県": "aichi", "三重県": "mie", "滋賀県": "shiga", "京都府": "kyoto",
  "大阪府": "osaka", "兵庫県": "hyogo", "奈良県": "nara", "和歌山県": "wakayama", "鳥取県": "tottori", "島根県": "shimane",
  "岡山県": "okayama", "広島県": "hiroshima", "山口県": "yamaguchi", "徳島県": "tokushima", "香川県": "kagawa", "愛媛県": "ehime",
  "高知県": "kochi", "福岡県": "fukuoka", "佐賀県": "saga", "長崎県": "nagasaki", "熊本県": "kumamoto", "大分県": "oita",
  "宮崎県": "miyazaki", "鹿児島県": "kagoshima", "沖縄県": "okinawa"
};

const CATEGORY_CONFIG = {
  stage: {
    path: "stage",
    label: "舞台・2.5次元",
    short: "舞台遠征",
    title: "舞台・2.5次元遠征のホテル",
    description: "舞台・2.5次元の会場周辺ホテルを、会場までの移動、最寄り駅、料金目安、滞在のしやすさから探せます"
  },
  esports: {
    path: "esports",
    label: "ゲームイベント",
    short: "ゲームイベント遠征",
    title: "ゲームイベント遠征のホテル",
    description: "ゲームイベント会場周辺のホテルを、機材や荷物の移動、食事、休息、料金目安から探せます"
  }
};

const ESPORTS_VENUES = {
  makuhari: { name: "幕張メッセ", prefecture: "千葉県" },
  ariake: { name: "東京ガーデンシアター", prefecture: "東京都" },
  bigsite: { name: "東京ビッグサイト", prefecture: "東京都" }
};

const GENERATED = [];

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function cleanDescription(value, fallback) {
  const text = normalizeText(value || fallback).replace(/\s+/g, " ");
  return text.length > 155 ? `${text.slice(0, 154)}…` : text;
}

function formatDate(value) {
  const text = normalizeText(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : text || "情報未確認";
}

function validHotelNo(value) {
  const text = normalizeText(value);
  return /^\d{1,12}$/.test(text) ? text : "";
}

function hotelKey(hotel) {
  const rakuten = validHotelNo(hotel.rakutenHotelNo);
  if (rakuten) return `rakuten:${rakuten}`;
  const jalan = normalizeText(hotel.jalanYadNo);
  if (/^\d{1,12}$/.test(jalan)) return `jalan:${jalan}`;
  return `name:${[
    normalizeText(hotel.name).toLowerCase(),
    normalizeText(hotel.prefecture).toLowerCase(),
    normalizeText(hotel.station || hotel.area).toLowerCase()
  ].join("|")}`;
}

function hotelSlug(hotel) {
  const key = hotelKey(hotel);
  if (key.startsWith("rakuten:")) return `rakuten-${key.slice(8)}`;
  if (key.startsWith("jalan:")) return `jalan-${key.slice(6)}`;
  return `hotel-${crypto.createHash("sha256").update(key).digest("hex").slice(0, 12)}`;
}

function categoryUrl(category) {
  return `/${CATEGORY_CONFIG[category].path}/`;
}

function prefectureUrl(category, prefecture) {
  return `/${CATEGORY_CONFIG[category].path}/${PREFECTURE_SLUGS[prefecture]}/`;
}

function venueUrl(venue) {
  return `${prefectureUrl(venue.category, venue.prefecture)}${venue.slug}/`;
}

function hotelUrl(group) {
  return `/hotel/${group.slug}/`;
}

function relativeOutputPath(urlPath) {
  return path.join(urlPath.replace(/^\//, ""), "index.html");
}

function removePreviousGenerated() {
  if (!fs.existsSync(MANIFEST_PATH)) return;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    throw new Error(`生成マニフェストを読み込めません: ${MANIFEST_PATH}`);
  }
  for (const relative of manifest.files || []) {
    const target = path.resolve(OUTPUT_ROOT, relative);
    if (!target.startsWith(path.resolve(OUTPUT_ROOT) + path.sep)) continue;
    if (fs.existsSync(target) && fs.statSync(target).isFile()) fs.rmSync(target);
  }
}

function writeGenerated(relativePath, content) {
  const normalized = relativePath.replaceAll("\\", "/");
  const destination = path.join(OUTPUT_ROOT, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content, "utf8");
  GENERATED.push(normalized);
}

function copyPreviewAssets() {
  if (!SAMPLE) return;
  for (const relative of ["assets/css/style.css", "assets/css/static-pages.css", "assets/js/static-pages.js", "assets/js/hotel-images.js", "assets/images/og-default.png", "404.html", "robots.txt"]) {
    const source = path.join(ROOT, relative);
    const destination = path.join(OUTPUT_ROOT, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

function nav(category) {
  return `<header class="static-header">
    <div class="container static-header__inner">
      <a class="brand" href="/" aria-label="STAYSCENE トップページ"><span class="brand-mark">SS</span><span class="brand-copy">STAYSCENE<small>EVENT STAY GUIDE</small></span></a>
      <nav class="static-nav" aria-label="メインナビゲーション">
        <a href="/stage/"${category === "stage" ? ' aria-current="page"' : ""}>舞台・2.5次元</a>
        <a href="/esports/"${category === "esports" ? ' aria-current="page"' : ""}>ゲームイベント</a>
        <a href="/?category=${escapeHtml(category || "stage")}#finder-heading">条件検索</a>
      </nav>
    </div>
  </header>`;
}

function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="パンくず"><ol>${items.map((item, index) => {
    const label = escapeHtml(item.label);
    return `<li>${item.url && index < items.length - 1 ? `<a href="${escapeHtml(item.url)}">${label}</a>` : label}</li>`;
  }).join("")}</ol></nav>`;
}

function footer() {
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div><a class="brand" href="/"><span class="brand-mark">SS</span><span class="brand-copy">STAYSCENE<small>EVENT STAY GUIDE</small></span></a><p>会場までの移動と、滞在中の過ごし方からホテルを選べるイベント遠征ガイドです</p></div>
      <div><h2>情報確認</h2><p>確認済みの情報と、予約前に再確認が必要な項目を分けて掲載しています</p></div>
      <div><h2>予約について</h2><p>料金・空室・設備の最新情報は、予約前に各予約サイトまたは宿泊施設の公式サイトでご確認ください</p></div>
    </div>
    <div class="container footer-bottom"><span>© 2026 STAYSCENE</span></div>
  </footer>`;
}

function layout({ title, description, canonicalPath, category, body, structuredData }) {
  const canonical = `${SITE_URL}${canonicalPath}`;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(cleanDescription(description, "STAYSCENEのイベント遠征ホテルガイド"));
  const jsonLd = structuredData ? `<script type="application/ld+json">${escapeJson(structuredData)}</script>` : "";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#f7f7f5">
  <meta name="description" content="${safeDescription}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="STAYSCENE">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${SITE_URL}/assets/images/og-default.png">
  <meta name="twitter:card" content="summary_large_image">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="/assets/css/style.css?v=20260808-2">
  <link rel="stylesheet" href="/assets/css/static-pages.css?v=20260813-1">
  ${jsonLd}
</head>
<body data-static-category="${escapeHtml(category || "stage")}">
  <a class="skip-link" href="#main">本文へ移動</a>
  <div class="disclosure">本サイトにはアフィリエイト広告が含まれます 料金・空室・設備の最新状況は、予約前に各サイトでご確認ください</div>
  ${nav(category)}
  <main id="main" class="static-main"><div class="container">${body}</div></main>
  ${footer()}
  <script src="/assets/js/static-pages.js?v=20260813-1" defer></script>
  <script src="/assets/js/hotel-images.js?v=20260813-1" defer></script>
</body>
</html>`;
}

function breadcrumbSchema(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: `${SITE_URL}${item.url || "/"}`
    }))
  };
}

function graphSchema(items, extra) {
  return { "@context": "https://schema.org", "@graph": [breadcrumbSchema(items), extra] };
}

function hotelCard(record, hotelGroup, categoryLabel) {
  const facts = (record.facts || []).slice(0, 3).map(fact => `<li>${escapeHtml(fact)}</li>`).join("");
  const links = [
    record.rakuten && { label: "楽天トラベルで確認", url: record.rakuten },
    record.jalan && { label: "じゃらんで確認", url: record.jalan }
  ].filter(Boolean).map(link => `<a class="button button--secondary" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer sponsored">${escapeHtml(link.label)}</a>`).join("");
  return `<article class="hotel-card" data-hotel-id="${escapeHtml(record.id)}">
    <div class="hotel-card__image"><span>HOTEL STAY</span></div>
    <div class="hotel-card__body">
      <p class="hotel-card__label">${escapeHtml(categoryLabel)}</p>
      <h2><a href="${hotelUrl(hotelGroup)}">${escapeHtml(record.name)}</a></h2>
      <p class="hotel-card__location">${escapeHtml([record.area, record.station || record.nearestStation].filter(Boolean).join("・") || "アクセス情報未確認")}</p>
      <p class="hotel-card__role">${escapeHtml(record.role || record.summary || "イベント遠征の宿泊候補")}</p>
      ${record.priceEstimate ? `<p class="hotel-card__price">料金目安 ${escapeHtml(record.priceEstimate)}</p>` : ""}
      ${facts ? `<ul class="hotel-card__features">${facts}</ul>` : ""}
      <div class="hotel-card__actions">
        <a class="button button--primary" href="${hotelUrl(hotelGroup)}">ホテルの詳細を見る</a>
        ${links ? `<div class="external-links">${links}</div>` : ""}
      </div>
    </div>
  </article>`;
}

function buildVenueModels(records) {
  const venues = new Map();
  for (const hotel of records) {
    if (hotel.genre === "stage" && hotel.venueId && hotel.venueLabel && PREFECTURE_SLUGS[hotel.prefecture]) {
      if (!venues.has(hotel.venueId)) venues.set(hotel.venueId, {
        key: hotel.venueId,
        slug: hotel.venueId,
        name: hotel.venueLabel,
        prefecture: hotel.prefecture,
        area: hotel.area || "",
        category: "stage",
        hotels: []
      });
      venues.get(hotel.venueId).hotels.push(hotel);
    }
    if (hotel.genre === "esports") {
      for (const venueId of hotel.venues || []) {
        const meta = ESPORTS_VENUES[venueId];
        if (!meta) continue;
        const key = `esports-${venueId}`;
        if (!venues.has(key)) venues.set(key, {
          key,
          slug: venueId,
          name: meta.name,
          prefecture: meta.prefecture,
          area: hotel.area || "",
          category: "esports",
          hotels: []
        });
        venues.get(key).hotels.push(hotel);
      }
    }
  }
  return [...venues.values()];
}

function buildHotelGroups(records, venueByRecordId) {
  const groups = new Map();
  for (const record of records) {
    const key = hotelKey(record);
    if (!groups.has(key)) groups.set(key, { key, slug: hotelSlug(record), records: [], venues: new Map() });
    const group = groups.get(key);
    group.records.push(record);
    for (const venue of venueByRecordId.get(record.id) || []) group.venues.set(venue.key, venue);
  }
  for (const group of groups.values()) {
    group.primary = [...group.records].sort((a, b) => {
      const score = item => [item.summary, item.role, item.priceEstimate, item.rakuten, item.jalan].filter(Boolean).length;
      return score(b) - score(a);
    })[0];
  }
  return groups;
}

function buildCategoryPage(category, venues) {
  const config = CATEGORY_CONFIG[category];
  const groups = new Map();
  for (const venue of venues) {
    if (!groups.has(venue.prefecture)) groups.set(venue.prefecture, []);
    groups.get(venue.prefecture).push(venue);
  }
  const cards = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "ja")).map(([prefecture, items]) => `<article class="static-card">
    <h2><a href="${prefectureUrl(category, prefecture)}">${escapeHtml(prefecture)}</a></h2>
    <p>${escapeHtml(items.slice(0, 3).map(item => item.name).join("、"))}${items.length > 3 ? " ほか" : ""}</p>
    <p class="static-card__meta">${items.length}会場</p>
  </article>`).join("");
  const crumbItems = [{ label: "ホーム", url: "/" }, { label: config.label, url: categoryUrl(category) }];
  const body = `${breadcrumbs(crumbItems)}
    <section class="static-hero"><p class="eyebrow">${escapeHtml(config.short)}</p><h1>${escapeHtml(config.title)}</h1><p>${escapeHtml(config.description)}</p></section>
    <section class="static-section"><div class="static-section__head"><div><h2>都道府県から探す</h2><p>${venues.length}会場を掲載しています</p></div><a class="button button--secondary" href="/?category=${category}#finder-heading">条件を指定して探す</a></div><div class="static-grid">${cards}</div></section>`;
  const itemList = { "@type": "ItemList", numberOfItems: groups.size, itemListElement: [...groups.keys()].map((name, index) => ({ "@type": "ListItem", position: index + 1, name, url: `${SITE_URL}${prefectureUrl(category, name)}` })) };
  writeGenerated(relativeOutputPath(categoryUrl(category)), layout({
    title: `${config.title}｜STAYSCENE`, description: config.description, canonicalPath: categoryUrl(category), category, body,
    structuredData: graphSchema(crumbItems, itemList)
  }));
}

function buildPrefecturePage(category, prefecture, venues) {
  const config = CATEGORY_CONFIG[category];
  const cards = venues.sort((a, b) => a.name.localeCompare(b.name, "ja", { numeric: true })).map(venue => `<article class="static-card">
    <div><h2><a href="${venueUrl(venue)}">${escapeHtml(venue.name)}</a></h2><p>${escapeHtml(venue.area || prefecture)}で利用しやすいホテル候補を掲載しています</p></div>
    <p class="static-card__meta">${venue.hotels.length}件</p>
  </article>`).join("");
  const url = prefectureUrl(category, prefecture);
  const crumbItems = [{ label: "ホーム", url: "/" }, { label: config.label, url: categoryUrl(category) }, { label: prefecture, url }];
  const body = `${breadcrumbs(crumbItems)}
    <section class="static-hero"><p class="eyebrow">${escapeHtml(config.short)}</p><h1>${escapeHtml(prefecture)}の${escapeHtml(config.label)}会場とホテル</h1><p>${escapeHtml(prefecture)}の掲載会場から、イベント遠征に使いやすいホテルを確認できます</p></section>
    <section class="static-section"><div class="static-section__head"><div><h2>掲載会場</h2><p>${venues.length}会場</p></div></div><div class="static-list">${cards}</div></section>`;
  const itemList = { "@type": "ItemList", numberOfItems: venues.length, itemListElement: venues.map((venue, index) => ({ "@type": "ListItem", position: index + 1, name: venue.name, url: `${SITE_URL}${venueUrl(venue)}` })) };
  writeGenerated(relativeOutputPath(url), layout({
    title: `${prefecture}の${config.label}会場周辺ホテル｜STAYSCENE`,
    description: `${prefecture}の${config.label}会場周辺ホテルを、会場までの移動、最寄り駅、料金目安から探せます`,
    canonicalPath: url, category, body, structuredData: graphSchema(crumbItems, itemList)
  }));
}

function buildVenuePage(venue, hotelGroups) {
  const config = CATEGORY_CONFIG[venue.category];
  const cards = venue.hotels.map(record => hotelCard(record, hotelGroups.get(hotelKey(record)), config.short)).join("");
  const url = venueUrl(venue);
  const crumbItems = [
    { label: "ホーム", url: "/" },
    { label: config.label, url: categoryUrl(venue.category) },
    { label: venue.prefecture, url: prefectureUrl(venue.category, venue.prefecture) },
    { label: venue.name, url }
  ];
  const body = `${breadcrumbs(crumbItems)}
    <section class="static-hero"><p class="eyebrow">${escapeHtml(config.short)}</p><h1>${escapeHtml(venue.name)}周辺のホテル</h1><p>${escapeHtml(venue.name)}周辺でイベント遠征に使いやすいホテルを、会場までの移動、最寄り駅、料金目安、滞在のしやすさから比較できます</p></section>
    <section class="static-section"><div class="static-section__head"><div><h2>掲載ホテル</h2><p>${venue.hotels.length}件 料金と空室は予約前に各サイトでご確認ください</p></div></div><div class="hotel-list static-hotel-list">${cards}</div></section>
    <nav class="static-back-links" aria-label="関連ページ"><a href="${prefectureUrl(venue.category, venue.prefecture)}">${escapeHtml(venue.prefecture)}の会場一覧</a><a href="${categoryUrl(venue.category)}">${escapeHtml(config.label)}トップ</a></nav>`;
  const itemList = { "@type": "ItemList", numberOfItems: venue.hotels.length, itemListElement: venue.hotels.map((record, index) => ({ "@type": "ListItem", position: index + 1, name: record.name, url: `${SITE_URL}${hotelUrl(hotelGroups.get(hotelKey(record)))}` })) };
  writeGenerated(relativeOutputPath(url), layout({
    title: `${venue.name}周辺のホテル｜${venue.prefecture}の${config.short}｜STAYSCENE`,
    description: `${venue.prefecture}の${venue.name}周辺にある${config.short}向けホテルを、会場までの移動、最寄り駅、料金目安、滞在のしやすさから比較できます`,
    canonicalPath: url, category: venue.category, body, structuredData: graphSchema(crumbItems, itemList)
  }));
}

function detailFor(group, detailRecords) {
  for (const record of group.records) {
    const detail = detailRecords[record.id];
    if (detail) return detail;
  }
  return null;
}

function detailSection(title, content) {
  if (!content) return "";
  return `<section class="hotel-detail__section"><h2>${escapeHtml(title)}</h2>${content}</section>`;
}

function buildHotelPage(group, detailRecords) {
  const hotel = group.primary;
  const detail = detailFor(group, detailRecords);
  const relatedVenues = [...group.venues.values()];
  const categories = [...new Set(relatedVenues.map(venue => venue.category))];
  const category = categories[0] || hotel.genre || "stage";
  const url = hotelUrl(group);
  const crumbItems = [{ label: "ホーム", url: "/" }, { label: "ホテル", url: "/hotel/" }, { label: hotel.name, url }];
  const facts = (hotel.facts || []).map(fact => `<li>${escapeHtml(fact)}</li>`).join("");
  const checks = (detail?.bookingChecks || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const venueLinks = relatedVenues.map(venue => `<li><a href="${venueUrl(venue)}">${escapeHtml(venue.name)}</a>（${escapeHtml(venue.prefecture)}）</li>`).join("");
  const sources = (detail?.sources || []).filter(source => /^https:\/\//.test(source.url || "")).map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a></li>`).join("");
  const bookingLinks = [
    hotel.rakuten && { label: "楽天トラベルで空室・料金を見る", url: hotel.rakuten },
    hotel.jalan && { label: "じゃらんで空室・料金を見る", url: hotel.jalan }
  ].filter(Boolean).map(link => `<a class="button button--primary" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer sponsored">${escapeHtml(link.label)}</a>`).join("");
  const movement = detail?.access?.routeSteps?.map(step => step.label || step.detail).filter(Boolean).join(" → ") || hotel.accessEstimate || relatedVenues.map(venue => venue.name).join("、");
  const checkedAt = formatDate(detail?.checkedAt || hotel.researchedAt);
  const hotelLocation = hotel.area || hotel.prefecture || hotel.station || "イベント会場周辺";
  const body = `${breadcrumbs(crumbItems)}
    <section class="static-hero"><p class="eyebrow">HOTEL STAY</p><h1>${escapeHtml(hotel.name)}</h1><p>${escapeHtml(hotel.summary || hotel.role || "イベント遠征の宿泊候補として掲載しています")}</p></section>
    <section class="static-section hotel-detail">
      <div class="hotel-detail__main">
        ${detailSection("アクセス", `<p>${escapeHtml(movement || "情報未確認")}</p><p>${escapeHtml(hotel.station || "最寄り駅情報未確認")}</p>`)}
        ${detailSection("料金目安", `<p><strong>${escapeHtml(detail?.stay?.priceEstimate || hotel.priceEstimate || "情報未確認")}</strong></p>${detail?.stay?.priceRange ? `<p>${escapeHtml(detail.stay.priceRange)}</p>` : ""}`)}
        ${detailSection("このホテルが向いている人", `<p>${escapeHtml(detail?.fit?.role || hotel.role || "情報未確認")}</p>`)}
        ${detailSection("ホテルでの過ごし方", `<p>${escapeHtml(detail?.fit?.summary || hotel.summary || "情報未確認")}</p>`)}
        ${facts ? detailSection("特徴", `<ul>${facts}</ul>`) : ""}
        ${checks ? detailSection("予約前の確認事項", `<ul>${checks}</ul>`) : ""}
        ${venueLinks ? detailSection("このホテルから行きやすい掲載会場", `<ul>${venueLinks}</ul>`) : ""}
        ${sources ? detailSection("確認先", `<ul>${sources}</ul>`) : ""}
      </div>
      <aside class="hotel-detail__aside">
        <div class="hotel-detail__image-wrap" data-hotel-image-id="${escapeHtml(hotel.id)}"><div class="hotel-detail__image"><span>HOTEL STAY</span></div></div>
        <div class="static-card"><h2>基本情報</h2><p>${escapeHtml(hotel.area || hotel.prefecture || "エリア情報未確認")}</p><p>${escapeHtml(hotel.station || "最寄り駅情報未確認")}</p><p class="static-card__meta">情報確認 ${escapeHtml(checkedAt)}</p></div>
        ${bookingLinks ? `<div class="static-card"><h2>予約サイト</h2><div class="booking-links">${bookingLinks}</div></div>` : ""}
      </aside>
    </section>
    <nav class="static-back-links" aria-label="関連ページ">${relatedVenues.slice(0, 4).map(venue => `<a href="${venueUrl(venue)}">${escapeHtml(venue.name)}へ戻る</a>`).join("")}<a href="/">トップへ戻る</a></nav>`;
  const hotelSchema = {
    "@type": "Hotel",
    name: hotel.name,
    description: hotel.summary || hotel.role || undefined,
    address: hotel.prefecture || hotel.area ? { "@type": "PostalAddress", addressRegion: hotel.prefecture || undefined, addressLocality: hotel.area || undefined, addressCountry: "JP" } : undefined,
    url: `${SITE_URL}${url}`
  };
  Object.keys(hotelSchema).forEach(key => hotelSchema[key] === undefined && delete hotelSchema[key]);
  writeGenerated(relativeOutputPath(url), layout({
    title: `${hotel.name}｜${hotelLocation}のアクセス・料金目安｜STAYSCENE`,
    description: `${hotelLocation}にある${hotel.name}の最寄り駅、会場までのアクセス、料金目安、向いている人、予約前の確認事項を掲載しています`,
    canonicalPath: url, category, body, structuredData: graphSchema(crumbItems, hotelSchema)
  }));
}

function buildHotelIndex(hotelGroups) {
  const groups = [...hotelGroups.values()].sort((a, b) => a.primary.name.localeCompare(b.primary.name, "ja", { numeric: true }));
  const cards = groups.map(group => `<article class="static-card"><h2><a href="${hotelUrl(group)}">${escapeHtml(group.primary.name)}</a></h2><p>${escapeHtml(group.primary.area || group.primary.prefecture || "エリア情報未確認")}</p><p class="static-card__meta">関連会場 ${group.venues.size}件</p></article>`).join("");
  const url = "/hotel/";
  const crumbItems = [{ label: "ホーム", url: "/" }, { label: "ホテル", url }];
  const body = `${breadcrumbs(crumbItems)}<section class="static-hero"><p class="eyebrow">HOTEL INDEX</p><h1>掲載ホテル一覧</h1><p>STAYSCENEに掲載しているホテルを確認できます</p></section><section class="static-section"><div class="static-grid">${cards}</div></section>`;
  writeGenerated(relativeOutputPath(url), layout({
    title: "掲載ホテル一覧｜STAYSCENE", description: "STAYSCENEに掲載しているイベント遠征向けホテルの一覧です", canonicalPath: url, category: "stage", body,
    structuredData: graphSchema(crumbItems, { "@type": "ItemList", numberOfItems: groups.length })
  }));
}

function buildSitemap(urls) {
  const body = urls.map(url => `  <url><loc>${escapeHtml(`${SITE_URL}${url}`)}</loc></url>`).join("\n");
  writeGenerated("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}

function main() {
  const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const detailPayload = JSON.parse(fs.readFileSync(DETAIL_PATH, "utf8"));
  let records = (Array.isArray(payload) ? payload : payload.hotels || [])
    .filter(hotel => hotel && hotel.isPublished !== false && CATEGORY_CONFIG[hotel.genre]);

  if (SAMPLE) {
    const sampleVenueIds = new Set(["stage-001", "stage-002", "stage-003"]);
    records = records.filter(hotel => hotel.genre === "stage" && hotel.prefecture === "東京都" && sampleVenueIds.has(hotel.venueId));
  }

  removePreviousGenerated();
  copyPreviewAssets();

  const venues = buildVenueModels(records);
  const venueByRecordId = new Map();
  for (const venue of venues) {
    for (const record of venue.hotels) {
      if (!venueByRecordId.has(record.id)) venueByRecordId.set(record.id, []);
      venueByRecordId.get(record.id).push(venue);
    }
  }
  const hotelGroups = buildHotelGroups(records, venueByRecordId);
  const categories = [...new Set(venues.map(venue => venue.category))];

  for (const category of categories) {
    const categoryVenues = venues.filter(venue => venue.category === category);
    buildCategoryPage(category, categoryVenues);
    const byPrefecture = new Map();
    for (const venue of categoryVenues) {
      if (!byPrefecture.has(venue.prefecture)) byPrefecture.set(venue.prefecture, []);
      byPrefecture.get(venue.prefecture).push(venue);
    }
    for (const [prefecture, prefectureVenues] of byPrefecture) buildPrefecturePage(category, prefecture, prefectureVenues);
  }
  for (const venue of venues) buildVenuePage(venue, hotelGroups);
  buildHotelIndex(hotelGroups);
  for (const group of hotelGroups.values()) buildHotelPage(group, detailPayload.records || {});

  const urls = ["/", ...GENERATED.filter(file => file.endsWith("/index.html")).map(file => `/${file.replace(/index\.html$/, "")}`)];
  buildSitemap([...new Set(urls)].sort());
  writeGenerated(".static-generated.json", `${JSON.stringify({ sample: SAMPLE, files: GENERATED, counts: {
    categories: categories.length,
    prefectures: new Set(venues.map(venue => `${venue.category}:${venue.prefecture}`)).size,
    venues: venues.length,
    hotels: hotelGroups.size,
    htmlPages: GENERATED.filter(file => file.endsWith(".html")).length
  } }, null, 2)}\n`);

  console.log(JSON.stringify({
    mode: SAMPLE ? "sample" : "full",
    outputRoot: OUTPUT_ROOT,
    records: records.length,
    categories: categories.length,
    prefectures: new Set(venues.map(venue => `${venue.category}:${venue.prefecture}`)).size,
    venues: venues.length,
    hotels: hotelGroups.size,
    htmlPages: GENERATED.filter(file => file.endsWith(".html")).length,
    sitemapUrls: new Set(urls).size
  }, null, 2));
}

main();
