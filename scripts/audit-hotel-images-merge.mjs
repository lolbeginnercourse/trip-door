import fs from "node:fs";
import path from "node:path";

const DATA_PATH = process.env.DATA_PATH || "assets/data/hotels.json";
const REPORT_DIR = process.env.REPORT_DIR || "reports/all-hotel-image-audit-v2-20260807";
const SHARD_DIR = path.join(REPORT_DIR, "shards");
const EXPECTED_TOTAL_UNIQUE = Number(process.env.EXPECTED_TOTAL_UNIQUE || 0);

function normalizeHotels(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.hotels)) return payload.hotels;
  return [];
}

function text(value) {
  return String(value ?? "").normalize("NFKC").trim();
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
    text(hotel?.name).toLowerCase(),
    text(hotel?.prefecture).toLowerCase(),
    text(location).toLowerCase()
  ].join("|")}`;
}

function increment(object, key, amount = 1) {
  object[key] = (object[key] || 0) + amount;
}

function csvCell(value) {
  const valueText = String(value ?? "");
  return /[",\n\r]/.test(valueText)
    ? `"${valueText.replace(/"/g, '""')}"`
    : valueText;
}

function writeCsv(filePath, rows) {
  const headers = [
    "id", "name", "prefecture", "station", "area", "venueId",
    "storedRakutenHotelNo", "imageStatus", "causeCode", "httpStatus",
    "affiliateRakuten", "affiliateHotelNo", "matchedHotelName",
    "matchedHotelNo", "matchedBy"
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map(header => csvCell(row[header])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function solutionText(summary) {
  const causes = summary.uniqueCountsByCause;
  const count = key => Number(causes[key] || 0);
  return `# 全ホテル画像表示の解決方針

生成日時: ${summary.generatedAt}

## 集計結果

- 対象レコード: ${summary.totalRecords}
- 重複除外施設: ${summary.uniqueRequestKeys}
- 画像取得成功施設: ${summary.uniqueMatched}
- 画像取得失敗施設: ${summary.uniqueFailed}
- レコード換算成功率: ${summary.recordSuccessRate}%

## 失敗原因

- 楽天リンクは取れるが画像照合で不一致: ${count("image_match_gap_affiliate_found")}
- 現在の楽天検索では未検出: ${count("not_found_by_current_rakuten_search")}
- 同名候補が複数: ${count("multiple_candidates")}
- 所在地を確認できない: ${count("location_unverified")}
- 楽天施設は一致したが画像URLなし: ${count("matched_but_no_image_url")}
- 一時的な楽天・Vercelエラー: ${count("temporary_upstream_error")}
- レート制限: ${count("rate_limited")}
- 通信エラー: ${count("network_error")}
- その他: ${count("other_error")}

## 全件表示へ向けた実装順

1. 楽天施設番号が判明している施設は、施設番号完全一致で画像を取得する。
2. 楽天リンクは取得できるのに画像照合で失敗した施設は、リンク側が返した施設番号をサーバー側の非公開対応表または永続K/Vへ保存し、次回から番号検索に切り替える。
3. 名称検索で未検出の施設は、ホテル名の表記差を正規化し、都道府県・駅・エリアを組み合わせた候補検索を行う。
4. 同名候補・所在地未確認は自動採用せず、住所または施設番号を手動確認して対応表へ追加する。
5. 楽天側に画像URLがない施設は、利用許可を確認したホテル公式画像を用意する。許可確認ができない施設は共通フォールバック画像を表示する。
6. APIの一時エラーとレート制限は再試行対象とし、恒久的な未検出とは分離する。
7. 公開JSONへ楽天画像URL一覧を固定保存せず、施設番号または内部対応キーからサーバー側で動的取得し、CDNキャッシュを利用する。

## 誤画像防止条件

- 施設番号がある場合は完全一致以外を不採用。
- 施設番号がない場合は、名称と都道府県が一致し、駅・エリア・住所候補のいずれかで一意に決まる場合だけ採用。
- 候補が複数残る場合は画像を表示せず、手動確認対象にする。
- 対応表を更新した施設は、施設名・都道府県・楽天施設番号を再照合してから本番へ反映する。
`;
}

if (!fs.existsSync(SHARD_DIR)) {
  throw new Error(`Shard directory not found: ${SHARD_DIR}`);
}

const shardFiles = fs.readdirSync(SHARD_DIR)
  .filter(name => /^shard-\d+\.json$/.test(name))
  .sort();

if (shardFiles.length === 0) throw new Error("No shard files found.");

const shardPayloads = shardFiles.map(name => {
  const payload = JSON.parse(fs.readFileSync(path.join(SHARD_DIR, name), "utf8"));
  if (payload?.complete !== true) throw new Error(`Incomplete shard: ${name}`);
  if (!Array.isArray(payload?.results)) throw new Error(`Invalid shard results: ${name}`);
  if (payload.results.length !== payload.processedUnique) {
    throw new Error(`Processed count mismatch: ${name}`);
  }
  return payload;
});

const shardIndexes = shardPayloads.map(payload => payload.shardIndex);
if (new Set(shardIndexes).size !== shardIndexes.length) {
  throw new Error("Duplicate shard indexes detected.");
}

const uniqueResults = {};
for (const shard of shardPayloads) {
  for (const result of shard.results) {
    if (uniqueResults[result.requestKey]) {
      throw new Error(`Duplicate request key across shards: ${result.requestKey}`);
    }
    uniqueResults[result.requestKey] = result;
  }
}

const actualTotalUnique = Object.keys(uniqueResults).length;
if (EXPECTED_TOTAL_UNIQUE > 0 && actualTotalUnique !== EXPECTED_TOTAL_UNIQUE) {
  throw new Error(`Expected ${EXPECTED_TOTAL_UNIQUE} unique results, got ${actualTotalUnique}.`);
}

const dataPayload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const hotels = normalizeHotels(dataPayload);
const recordResults = hotels.map((hotel, index) => {
  const key = requestKey(hotel);
  const result = uniqueResults[key];
  if (!result) throw new Error(`Missing result for record ${index}: ${key}`);
  return {
    index,
    id: text(hotel?.id),
    name: text(hotel?.name),
    prefecture: text(hotel?.prefecture),
    station: text(hotel?.station),
    area: text(hotel?.area),
    venueId: text(hotel?.venueId),
    storedRakutenHotelNo: validHotelNo(hotel?.rakutenHotelNo),
    requestKey: key,
    image: result.image,
    affiliate: result.affiliate,
    causeCode: result.causeCode
  };
});

const summary = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  totalRecords: hotels.length,
  uniqueRequestKeys: actualTotalUnique,
  duplicateRecordsSharingRequests: hotels.length - actualTotalUnique,
  recordsMatched: recordResults.filter(row => row.image.hasImage).length,
  recordsFailed: recordResults.filter(row => !row.image.hasImage).length,
  recordSuccessRate: Number((
    recordResults.filter(row => row.image.hasImage).length /
    Math.max(1, hotels.length) * 100
  ).toFixed(2)),
  uniqueMatched: Object.values(uniqueResults).filter(row => row.image.hasImage).length,
  uniqueFailed: Object.values(uniqueResults).filter(row => !row.image.hasImage).length,
  recordCountsByCause: {},
  uniqueCountsByCause: {},
  recordCountsByStatus: {},
  uniqueCountsByStatus: {},
  recordCountsByMatchedBy: {},
  uniqueCountsByMatchedBy: {},
  failedUniqueWithRakutenAffiliateLink: 0,
  failedUniqueWithoutRakutenAffiliateLink: 0,
  shardCount: shardPayloads.length
};

for (const row of recordResults) {
  increment(summary.recordCountsByCause, row.causeCode);
  increment(summary.recordCountsByStatus, row.image.status || "unknown");
  if (row.image.hasImage) increment(summary.recordCountsByMatchedBy, row.image.matchedBy || "unknown");
}

for (const result of Object.values(uniqueResults)) {
  increment(summary.uniqueCountsByCause, result.causeCode);
  increment(summary.uniqueCountsByStatus, result.image.status || "unknown");
  if (result.image.hasImage) {
    increment(summary.uniqueCountsByMatchedBy, result.image.matchedBy || "unknown");
  } else if (result.affiliate?.hasRakuten) {
    summary.failedUniqueWithRakutenAffiliateLink += 1;
  } else {
    summary.failedUniqueWithoutRakutenAffiliateLink += 1;
  }
}

const failures = recordResults
  .filter(row => !row.image.hasImage)
  .map(row => ({
    id: row.id,
    name: row.name,
    prefecture: row.prefecture,
    station: row.station,
    area: row.area,
    venueId: row.venueId,
    storedRakutenHotelNo: row.storedRakutenHotelNo,
    imageStatus: row.image.status,
    causeCode: row.causeCode,
    httpStatus: row.image.httpStatus,
    affiliateRakuten: row.affiliate?.hasRakuten ? "yes" : "no",
    affiliateHotelNo: row.affiliate?.rakutenHotelNo || "",
    matchedHotelName: row.image.hotelName,
    matchedHotelNo: row.image.hotelNo,
    matchedBy: row.image.matchedBy
  }));

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(path.join(REPORT_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(REPORT_DIR, "unique-results.json"), `${JSON.stringify(uniqueResults, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(REPORT_DIR, "record-results.json"), `${JSON.stringify(recordResults, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(REPORT_DIR, "solution-plan.md"), solutionText(summary), "utf8");
fs.writeFileSync(path.join(REPORT_DIR, "progress.json"), `${JSON.stringify({
  phase: "complete",
  totalRecords: hotels.length,
  totalUnique: actualTotalUnique,
  processedUnique: actualTotalUnique,
  completedAt: summary.generatedAt
}, null, 2)}\n`, "utf8");
writeCsv(path.join(REPORT_DIR, "failures.csv"), failures);

console.log(JSON.stringify(summary, null, 2));
