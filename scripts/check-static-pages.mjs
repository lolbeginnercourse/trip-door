import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET = process.argv.includes("--sample") ? path.join(ROOT, ".static-preview") : ROOT;
const manifestPath = path.join(TARGET, ".static-generated.json");
if (!fs.existsSync(manifestPath)) throw new Error("静的ページが未生成です");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const htmlFiles = (manifest.files || []).filter(file => file.endsWith(".html"));
if (!htmlFiles.length) throw new Error("生成HTMLがありません");

const SITE_URL = "https://mainitiworakunisuru.com";
const generatedPaths = new Set(["/", ...htmlFiles.map(file => `/${file.replace(/index\.html$/, "")}`)]);
const seenTitles = new Map();
const seenDescriptions = new Map();
const seenCanonicals = new Map();

function remember(map, value, file, label) {
  if (!value) throw new Error(`${file}: ${label} が空です`);
  if (map.has(value)) throw new Error(`${file}: ${label} が ${map.get(value)} と重複しています (${value})`);
  map.set(value, file);
}

function expectedPath(relative) {
  return `/${relative.replace(/index\.html$/, "")}`;
}

function localPathForHref(href) {
  if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) return null;
  const url = new URL(href, SITE_URL);
  if (url.origin !== SITE_URL) return null;
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/api/")) return null;
  return url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
}

const required = [
  /<h1[^>]*>[^<]+<\/h1>/,
  /<link rel="canonical" href="https:\/\/mainitiworakunisuru\.com\//,
  /<meta name="description" content="[^"]+">/,
  /<meta property="og:url" content="https:\/\/mainitiworakunisuru\.com\//,
  /application\/ld\+json/,
  /<a href="\//
];

for (const relative of htmlFiles) {
  const html = fs.readFileSync(path.join(TARGET, relative), "utf8");
  for (const pattern of required) {
    if (!pattern.test(html)) throw new Error(`${relative}: 必須HTMLが不足しています (${pattern})`);
  }

  const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/g)].map(match => match[1].trim());
  const descriptions = [...html.matchAll(/<meta name="description" content="([^"]+)">/g)].map(match => match[1].trim());
  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map(match => match[1].trim());
  const h1Count = (html.match(/<h1(?:\s[^>]*)?>/g) || []).length;
  if (titles.length !== 1 || descriptions.length !== 1 || canonicals.length !== 1 || h1Count !== 1) {
    throw new Error(`${relative}: title/description/canonical/H1 は各1件必要です`);
  }
  remember(seenTitles, titles[0], relative, "title");
  remember(seenDescriptions, descriptions[0], relative, "description");
  remember(seenCanonicals, canonicals[0], relative, "canonical");

  const expectedCanonical = `${SITE_URL}${expectedPath(relative)}`;
  if (canonicals[0] !== expectedCanonical) {
    throw new Error(`${relative}: canonical が生成先と一致しません (${canonicals[0]})`);
  }

  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      throw new Error(`${relative}: JSON-LDを解析できません (${error.message})`);
    }
  }

  for (const hrefMatch of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)) {
    const href = hrefMatch[1];
    const localPath = localPathForHref(href);
    if (localPath && !generatedPaths.has(localPath) && !(manifest.sample && localPath === "/esports/")) {
      throw new Error(`${relative}: 内部リンク先がありません (${href})`);
    }
    if (/^https?:\/\//.test(href) && /(rakuten|jalan|valuecommerce|afl\.rakuten)/i.test(hrefMatch[0]) && !/rel="[^"]*sponsored/.test(hrefMatch[0])) {
      throw new Error(`${relative}: アフィリエイトリンクに sponsored がありません (${href})`);
    }
  }
}

const venueFile = htmlFiles.find(file => /^stage\/[^/]+\/stage-\d+\/index\.html$/.test(file));
const hotelFile = htmlFiles.find(file => /^hotel\/[^/]+\/index\.html$/.test(file));
if (!venueFile || !hotelFile) throw new Error("代表会場ページまたはホテルページがありません");
const venueHtml = fs.readFileSync(path.join(TARGET, venueFile), "utf8");
const hotelHtml = fs.readFileSync(path.join(TARGET, hotelFile), "utf8");
for (const [name, html, words] of [
  [venueFile, venueHtml, ["掲載ホテル", "料金目安", "ホテルの詳細を見る"]],
  [hotelFile, hotelHtml, ["アクセス", "料金目安", "予約前の確認事項"]]
]) {
  for (const word of words) if (!html.includes(word)) throw new Error(`${name}: ${word} が生HTMLにありません`);
}

const sitemap = fs.readFileSync(path.join(TARGET, "sitemap.xml"), "utf8");
if (!sitemap.includes("/stage/") || !sitemap.includes("/hotel/")) throw new Error("サイトマップに静的URLが不足しています");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const expectedSitemapUrls = new Set([...generatedPaths].map(url => `${SITE_URL}${url}`));
if (sitemapUrls.length !== new Set(sitemapUrls).size) throw new Error("サイトマップに重複URLがあります");
if (sitemapUrls.length !== expectedSitemapUrls.size || sitemapUrls.some(url => !expectedSitemapUrls.has(url))) {
  throw new Error(`サイトマップと生成ページが一致しません (sitemap=${sitemapUrls.length}, expected=${expectedSitemapUrls.size})`);
}

console.log(JSON.stringify({
  checkedHtml: htmlFiles.length,
  checkedInternalPaths: generatedPaths.size,
  checkedSitemapUrls: sitemapUrls.length,
  uniqueTitles: seenTitles.size,
  uniqueDescriptions: seenDescriptions.size,
  venueExample: venueFile,
  hotelExample: hotelFile,
  counts: manifest.counts
}, null, 2));
