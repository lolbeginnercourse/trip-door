import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const ORIGIN = "https://mainitiworakunisuru.com";
const HOTEL_FILE = path.join(ROOT, "assets/data/hotels.json");
const META_FILE = path.join(ROOT, "assets/data/seo-venues.json");
const REPORT_DIR = path.join(ROOT, "artifacts/seo-build");
const GENERATED_SIGNATURE = 'data-seo-generated="stayscene"';

const asArray = value => Array.isArray(value) ? value : [];
const text = value => typeof value === "string" ? value.trim() : "";
const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const safeUrl = value => /^https:\/\//.test(text(value)) ? text(value) : "";
const readJson = async file => JSON.parse(await fs.readFile(file, "utf8"));

function categoriesOf(hotel) {
  const categories = asArray(hotel.categories).filter(Boolean);
  return categories.length ? categories : (text(hotel.genre) ? [hotel.genre] : []);
}

function metaMatchesHotel(hotel, meta) {
  if (!categoriesOf(hotel).includes(meta.category)) return false;
  const field = meta.match?.field;
  const value = meta.match?.value;
  if (field === "venues") return asArray(hotel.venues).includes(value);
  return Boolean(field && value && hotel[field] === value);
}

function sortHotels(hotels) {
  return [...hotels].sort((a, b) => {
    const rankA = Number(a.rank) || 999;
    const rankB = Number(b.rank) || 999;
    if (rankA !== rankB) return rankA - rankB;
    const priceA = Number(a.priceNumeric) || Number.MAX_SAFE_INTEGER;
    const priceB = Number(b.priceNumeric) || Number.MAX_SAFE_INTEGER;
    if (priceA !== priceB) return priceA - priceB;
    return text(a.name).localeCompare(text(b.name), "ja");
  });
}

function usableHotel(hotel) {
  return Boolean(text(hotel.name) && text(hotel.station) && (text(hotel.accessEstimate) || asArray(hotel.facts).length));
}

function categoryPath(category) {
  return category === "stage" ? "stage" : "esports";
}

function categoryLabel(category) {
  return category === "stage" ? "舞台・2.5次元" : "ゲームイベント・eスポーツ";
}

function categoryTitle(category) {
  return category === "stage"
    ? "舞台・2.5次元遠征のホテル｜会場から探す｜STAYSCENE"
    : "ゲームイベント・eスポーツ遠征のホテル｜会場から探す｜STAYSCENE";
}

function categoryDescription(category) {
  return category === "stage"
    ? "舞台・2.5次元公演への遠征で泊まりやすいホテルを、会場とホテルのアクセス目安や最寄駅、料金目安から探せます。"
    : "ゲームイベント・eスポーツ遠征で泊まりやすいホテルを、会場への移動や最寄駅、休息条件から探せます。";
}

function venueTitle(venue) {
  return venue.category === "stage"
    ? `${venue.name}周辺のホテル｜舞台・2.5次元遠征に便利な宿｜STAYSCENE`
    : `${venue.name}周辺のホテル｜ゲームイベント遠征に便利な宿｜STAYSCENE`;
}

function venueDescription(venue) {
  const axes = venue.category === "stage"
    ? "会場へのアクセス目安、最寄駅、料金目安"
    : "会場への移動、最寄駅、休息条件";
  return `${venue.name}への遠征で泊まりやすいホテルを、${axes}から比較できます。`;
}

function jsonLd(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function pageShell({ title, description, canonical, robots = "index,follow", body, structuredData }) {
  return `<!doctype html>
<html lang="ja" ${GENERATED_SIGNATURE}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#f7f7f5">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="stylesheet" href="/assets/css/seo-pages.css">
  <title>${escapeHtml(title)}</title>
  ${structuredData ? `<script type="application/ld+json">${jsonLd(structuredData)}</script>` : ""}
</head>
<body>
  <a class="skip-link" href="#main">本文へ移動</a>
  <div class="disclosure">本サイトにはアフィリエイト広告が含まれます。料金・空室・設備は予約前に各サイトでご確認ください。</div>
  <header class="seo-header">
    <div class="seo-container seo-header__inner">
      <a class="seo-brand" href="/" aria-label="STAYSCENE トップページ"><span>SS</span><strong>STAYSCENE</strong></a>
      <nav aria-label="メインナビゲーション"><a href="/stage/">舞台・2.5次元</a><a href="/esports/">ゲームイベント</a></nav>
    </div>
  </header>
  ${body}
  <footer class="seo-footer"><div class="seo-container"><strong>STAYSCENE</strong><p>イベント遠征のホテル選びを、会場からの動きと滞在条件で整理するガイドです。</p><p><a href="/">ホテル検索へ戻る</a></p></div></footer>
</body>
</html>`;
}

function buildDiscoveredVenues(hotels, metadata) {
  const overrides = new Map();
  for (const meta of metadata) overrides.set(`${meta.category}:${meta.match?.field}:${meta.match?.value}`, meta);

  const stageGroups = new Map();
  for (const hotel of hotels.filter(hotel => categoriesOf(hotel).includes("stage"))) {
    if (!text(hotel.venueId) || !text(hotel.venueLabel)) continue;
    const group = stageGroups.get(hotel.venueId) || [];
    group.push(hotel);
    stageGroups.set(hotel.venueId, group);
  }

  const venues = [];
  for (const [venueId, group] of stageGroups) {
    const sorted = sortHotels(group);
    const first = sorted[0];
    const override = overrides.get(`stage:venueId:${venueId}`) || {};
    const usableCount = sorted.filter(usableHotel).length;
    venues.push({
      category: "stage",
      matchKey: venueId,
      slug: override.slug || venueId,
      name: override.name || first.venueLabel,
      prefecture: override.prefecture || first.prefecture || "地域未設定",
      city: override.city || "",
      address: override.address || "",
      nearestStation: override.nearestStation || "",
      stationAccess: override.stationAccess || first.venueMemo || "",
      selectionNote: override.selectionNote || `${first.venueLabel}への移動を基準に、最寄駅とアクセス目安、料金目安を比較します。`,
      sourceUrl: safeUrl(override.sourceUrl) || safeUrl(first.venueOfficialUrl),
      hotels: sorted,
      indexable: (override.indexable ?? true) && sorted.length >= 3 && usableCount >= 3,
      configuredIndexable: override.indexable ?? true
    });
  }

  for (const meta of metadata.filter(meta => meta.category === "esports")) {
    const matched = sortHotels(hotels.filter(hotel => metaMatchesHotel(hotel, meta)));
    venues.push({
      ...meta,
      matchKey: meta.match.value,
      hotels: matched,
      indexable: meta.indexable === true && matched.length >= 3 && matched.filter(usableHotel).length >= 3,
      configuredIndexable: meta.indexable === true
    });
  }

  return venues.sort((a, b) => a.category.localeCompare(b.category) || a.prefecture.localeCompare(b.prefecture, "ja") || a.name.localeCompare(b.name, "ja"));
}

function breadcrumbLd(venue) {
  const base = `${ORIGIN}/${categoryPath(venue.category)}/`;
  const self = `${base}${venue.slug}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "STAYSCENE", item: `${ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: categoryLabel(venue.category), item: base },
          { "@type": "ListItem", position: 3, name: venue.name, item: self }
        ]
      },
      {
        "@type": "ItemList",
        name: `${venue.name}周辺のホテル候補`,
        itemListElement: venue.hotels.slice(0, 5).map((hotel, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: hotel.name
        }))
      }
    ]
  };
}

function bookingLinks(hotel) {
  const links = [
    ["楽天トラベルで確認", safeUrl(hotel.rakuten)],
    ["じゃらんで確認", safeUrl(hotel.jalan)]
  ].filter(([, url]) => url);
  if (!links.length) return '<span class="seo-muted">予約リンクは準備中です</span>';
  return links.map(([label, url]) => `<a class="seo-button seo-button--sub" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer sponsored">${escapeHtml(label)}</a>`).join("");
}

function hotelCard(hotel, venue, index) {
  const access = text(hotel.accessEstimate) || asArray(hotel.facts)[0] || "アクセス詳細は移動前にご確認ください";
  const station = text(hotel.station) || "最寄駅情報は要確認";
  const price = text(hotel.priceEstimate) || "料金は予約サイトで確認";
  const facts = asArray(hotel.facts).filter(Boolean).slice(0, 3);
  const researched = text(hotel.researchedAt);
  return `<article class="hotel-seo-card">
    <div class="hotel-seo-card__head"><span class="hotel-seo-card__rank">候補 ${index + 1}</span><h2>${escapeHtml(hotel.name)}</h2></div>
    <p class="hotel-seo-card__role">${escapeHtml(hotel.role || `${venue.name}周辺のホテル候補`)}</p>
    <dl class="hotel-seo-card__facts">
      <div><dt>会場アクセス目安</dt><dd>${escapeHtml(access)}</dd></div>
      <div><dt>ホテル最寄駅</dt><dd>${escapeHtml(station)}</dd></div>
      <div><dt>料金目安</dt><dd>${escapeHtml(price)}</dd></div>
      ${text(hotel.priceRangeEstimate) ? `<div><dt>料金幅目安</dt><dd>${escapeHtml(hotel.priceRangeEstimate)}</dd></div>` : ""}
      ${text(hotel.planEstimate) ? `<div><dt>プラン目安</dt><dd>${escapeHtml(hotel.planEstimate)}</dd></div>` : ""}
      ${text(hotel.roomTypeEstimate) ? `<div><dt>部屋タイプ目安</dt><dd>${escapeHtml(hotel.roomTypeEstimate)}</dd></div>` : ""}
    </dl>
    ${facts.length ? `<ul class="hotel-seo-card__tags">${facts.map(fact => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>` : ""}
    ${text(hotel.summary) ? `<p class="hotel-seo-card__summary">${escapeHtml(hotel.summary)}</p>` : ""}
    ${researched ? `<p class="seo-note">情報確認日：${escapeHtml(researched)}</p>` : ""}
    <div class="hotel-seo-card__actions">${bookingLinks(hotel)}</div>
  </article>`;
}

function venuePage(venue) {
  const basePath = categoryPath(venue.category);
  const canonical = `${ORIGIN}/${basePath}/${venue.slug}/`;
  const hotels = venue.hotels.slice(0, 5);
  const robots = venue.indexable ? "index,follow" : "noindex,follow";
  const source = venue.sourceUrl ? `<a href="${escapeHtml(venue.sourceUrl)}" target="_blank" rel="noopener noreferrer">会場公式のアクセス情報を確認</a>` : "";
  const routeNote = venue.category === "stage"
    ? "現在の登録データでは、全会場について数値の総移動時間・乗換回数までは統一収録していません。推測値は表示せず、登録済みのアクセス目安と最寄駅を掲載しています。"
    : "会場やイベント規模によって混雑状況が変わるため、当日の経路と所要時間は出発前に確認してください。";
  const searchValue = encodeURIComponent(venue.matchKey);
  const body = `<main id="main">
    <div class="seo-container">
      <nav class="breadcrumbs" aria-label="パンくず"><a href="/">トップ</a><span>›</span><a href="/${basePath}/">${escapeHtml(categoryLabel(venue.category))}</a><span>›</span><span>${escapeHtml(venue.name)}</span></nav>
    </div>
    <section class="venue-hero"><div class="seo-container venue-hero__grid"><div><p class="seo-kicker">${escapeHtml(categoryLabel(venue.category))}遠征</p><h1>${escapeHtml(venue.name)}周辺のホテル</h1><p class="venue-lead">${escapeHtml(venueDescription(venue))}</p><a class="seo-button" href="/?category=${venue.category}&area=${searchValue}" rel="nofollow">STAYSCENEの条件検索で絞り込む</a></div><div class="venue-summary"><strong>${escapeHtml(venue.name)}</strong><dl>${venue.prefecture ? `<div><dt>地域</dt><dd>${escapeHtml([venue.prefecture, venue.city].filter(Boolean).join(" "))}</dd></div>` : ""}${venue.address ? `<div><dt>所在地</dt><dd>${escapeHtml(venue.address)}</dd></div>` : ""}${venue.nearestStation ? `<div><dt>代表的な最寄駅</dt><dd>${escapeHtml(venue.nearestStation)}</dd></div>` : ""}${venue.stationAccess ? `<div><dt>会場アクセス</dt><dd>${escapeHtml(venue.stationAccess)}</dd></div>` : ""}</dl>${source}</div></div></section>
    <section class="seo-section"><div class="seo-container seo-reading"><p class="seo-kicker">ホテル選びの基準</p><h2>${escapeHtml(venue.name)}遠征で確認したいこと</h2><p>${escapeHtml(venue.selectionNote)}</p><p class="data-policy">${escapeHtml(routeNote)}</p></div></section>
    <section class="seo-section seo-section--soft"><div class="seo-container"><div class="section-heading"><p class="seo-kicker">HOTEL OPTIONS</p><h2>${escapeHtml(venue.name)}周辺のホテル候補</h2><p>登録データから${hotels.length}件を掲載しています。料金は目安で、空室・プラン・キャンセル条件は予約先で最新情報をご確認ください。</p></div><div class="hotel-seo-list">${hotels.map((hotel, index) => hotelCard(hotel, venue, index)).join("")}</div></div></section>
    <section class="seo-section"><div class="seo-container seo-reading"><h2>予約前の最終確認</h2><ul class="check-list"><li>公演・イベント終了時刻からホテルまでの当日経路</li><li>チェックイン可能時刻と荷物預かり条件</li><li>表示料金の対象日・人数・部屋タイプ</li><li>終演後に利用できる飲食店や館内設備</li></ul></div></section>
  </main>`;
  return pageShell({ title: venueTitle(venue), description: venueDescription(venue), canonical, robots, body, structuredData: breadcrumbLd(venue) });
}

function categoryPage(category, venues) {
  const basePath = categoryPath(category);
  const canonical = `${ORIGIN}/${basePath}/`;
  const grouped = new Map();
  for (const venue of venues) {
    const key = venue.prefecture || "地域未設定";
    const list = grouped.get(key) || [];
    list.push(venue);
    grouped.set(key, list);
  }
  const groups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "ja"));
  const listHtml = groups.map(([prefecture, items]) => `<section class="venue-group"><h2>${escapeHtml(prefecture)}</h2><ul>${items.map(venue => `<li><a href="/${basePath}/${escapeHtml(venue.slug)}/"><strong>${escapeHtml(venue.name)}</strong><span>${venue.hotels.length}件のホテル候補${venue.indexable ? "" : "・情報拡充中"}</span></a></li>`).join("")}</ul></section>`).join("");
  const body = `<main id="main"><section class="category-hero"><div class="seo-container seo-reading"><p class="seo-kicker">VENUE INDEX</p><h1>${category === "stage" ? "舞台・2.5次元遠征のホテルを会場から探す" : "ゲームイベント遠征のホテルを会場から探す"}</h1><p>${escapeHtml(categoryDescription(category))}</p><a class="seo-button" href="/?category=${category}" rel="nofollow">条件検索を使う</a></div></section><section class="seo-section"><div class="seo-container"><p class="venue-count">登録会場 ${venues.length}会場</p><div class="venue-groups">${listHtml}</div></div></section></main>`;
  return pageShell({ title: categoryTitle(category), description: categoryDescription(category), canonical, body, structuredData: { "@context": "https://schema.org", "@type": "ItemList", name: `${categoryLabel(category)}の会場一覧`, itemListElement: venues.map((venue, index) => ({ "@type": "ListItem", position: index + 1, name: venue.name, url: `${ORIGIN}/${basePath}/${venue.slug}/` })) } });
}

async function prepareOwnedDirectory(name) {
  const dir = path.join(ROOT, name);
  try {
    const index = await fs.readFile(path.join(dir, "index.html"), "utf8");
    if (!index.includes(GENERATED_SIGNATURE)) throw new Error(`${name}/ exists but is not owned by the SEO generator`);
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function writePage(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${content}\n`, "utf8");
}

async function patchTopPage() {
  const file = path.join(ROOT, "index.html");
  const original = await fs.readFile(file, "utf8");
  const oldStageMatches = (original.match(/href="\/\?category=stage"/g) || []).length;
  const oldEsportsMatches = (original.match(/href="\/\?category=esports"/g) || []).length;
  const staticStageMatches = (original.match(/href="\/stage\/"/g) || []).length;
  const staticEsportsMatches = (original.match(/href="\/esports\/"/g) || []).length;
  if (!oldStageMatches && !staticStageMatches) throw new Error("No stage category links were found in index.html");
  if (!oldEsportsMatches && !staticEsportsMatches) throw new Error("No esports category links were found in index.html");
  const updated = original
    .replaceAll('href="/?category=stage"', 'href="/stage/"')
    .replaceAll('href="/?category=esports"', 'href="/esports/"');
  await fs.writeFile(file, updated, "utf8");
  return {
    oldStageMatches,
    oldEsportsMatches,
    staticStageMatchesAfter: (updated.match(/href="\/stage\/"/g) || []).length,
    staticEsportsMatchesAfter: (updated.match(/href="\/esports\/"/g) || []).length
  };
}

function sitemapXml(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url>\n    <loc>${escapeHtml(url)}</loc>\n  </url>`).join("\n")}\n</urlset>\n`;
}

const hotelData = await readJson(HOTEL_FILE);
const metaData = await readJson(META_FILE);
const hotels = asArray(hotelData.hotels).filter(hotel => hotel?.isPublished !== false);
const metadata = asArray(metaData.venues);
const venues = buildDiscoveredVenues(hotels, metadata);
const stageVenues = venues.filter(venue => venue.category === "stage");
const esportsVenues = venues.filter(venue => venue.category === "esports");

if (!stageVenues.length) throw new Error("No stage venues discovered");
if (!esportsVenues.length) throw new Error("No esports venues configured");

const stageDir = await prepareOwnedDirectory("stage");
const esportsDir = await prepareOwnedDirectory("esports");
await writePage(path.join(stageDir, "index.html"), categoryPage("stage", stageVenues));
await writePage(path.join(esportsDir, "index.html"), categoryPage("esports", esportsVenues));

for (const venue of venues) {
  const baseDir = venue.category === "stage" ? stageDir : esportsDir;
  await writePage(path.join(baseDir, venue.slug, "index.html"), venuePage(venue));
}

const urls = [
  `${ORIGIN}/`,
  `${ORIGIN}/stage/`,
  `${ORIGIN}/esports/`,
  ...venues.filter(venue => venue.indexable).map(venue => `${ORIGIN}/${categoryPath(venue.category)}/${venue.slug}/`)
];
await fs.writeFile(path.join(ROOT, "sitemap.xml"), sitemapXml(urls), "utf8");
const topPatch = await patchTopPage();

const report = {
  generatedAt: new Date().toISOString(),
  hotels: hotels.length,
  stageVenues: stageVenues.length,
  stageIndexable: stageVenues.filter(venue => venue.indexable).length,
  esportsVenues: esportsVenues.length,
  esportsIndexable: esportsVenues.filter(venue => venue.indexable).length,
  sitemapUrls: urls.length,
  topPatch,
  noindexVenues: venues.filter(venue => !venue.indexable).map(venue => ({ category: venue.category, slug: venue.slug, name: venue.name, hotels: venue.hotels.length }))
};
await fs.mkdir(REPORT_DIR, { recursive: true });
await fs.writeFile(path.join(REPORT_DIR, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
