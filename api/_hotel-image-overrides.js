"use strict";

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\s・･\.·,，、!！'’`´\-‐‑–—―ー_()（）【】\[\]「」『』〈〉《》<>]/g, "")
    .replace(/びわ湖/g, "琵琶湖");
}

const RAW_OVERRIDES = [
  {
    names: ["ホテルウィングインターナショナルプレミアム東京四谷"],
    prefecture: "東京都",
    hotelNo: "146864",
    expectedNames: ["KOKO HOTEL 新宿四谷", "ホテルウィングインターナショナルプレミアム東京四谷"]
  },
  {
    names: ["ホテルウィングインターナショナル後楽園"],
    prefecture: "東京都",
    hotelNo: "462",
    expectedNames: ["KOKO HOTEL 後楽園", "ホテルウィングインターナショナル後楽園"]
  },
  {
    names: ["the b 赤坂"],
    prefecture: "東京都",
    hotelNo: "240",
    expectedNames: ["the b 赤坂", "ｔｈｅ　ｂ　赤坂（ザビー　あかさか）"]
  },
  {
    names: ["東急ステイ渋谷"],
    prefecture: "東京都",
    hotelNo: "41708",
    expectedNames: ["東急ステイ渋谷", "東急ステイ渋谷（道玄坂上）"]
  },
  {
    names: ["THE KNOT TOKYO Shinjuku"],
    prefecture: "東京都",
    hotelNo: "167724",
    expectedNames: ["THE KNOT TOKYO Shinjuku", "ザ ノット 東京新宿"]
  },
  {
    names: ["ホテルグランテラス帯広"],
    prefecture: "北海道",
    hotelNo: "500",
    expectedNames: ["ホテルグランテラス帯広", "薬湯風呂 ホテルグランテラス帯広（BBHホテルグループ）"]
  },
  {
    names: ["ホテルルートイン柏南"],
    prefecture: "千葉県",
    hotelNo: "176902",
    expectedNames: ["ホテルルートイン柏南", "ホテルルートイン柏南－国道16号沿－"]
  },
  {
    names: ["ヴィラフォンテーヌ グランド 東京有明"],
    prefecture: "",
    hotelNo: "178230",
    expectedNames: ["ヴィラフォンテーヌ グランド 東京有明", "住友不動産ホテル ヴィラフォンテーヌグランド東京有明"]
  },
  {
    names: ["NOHGA HOTEL UENO TOKYO"],
    prefecture: "",
    hotelNo: "167837",
    expectedNames: ["NOHGA HOTEL UENO TOKYO", "ノーガホテル上野東京"]
  },
  {
    names: ["ホテルウィングインターナショナル相模原"],
    prefecture: "神奈川県",
    hotelNo: "67257",
    expectedNames: ["ホテルウィングインターナショナル相模原", "KOKO STAY 相模原"]
  },
  {
    names: ["メルキュール横須賀"],
    prefecture: "神奈川県",
    hotelNo: "84673",
    expectedNames: ["メルキュール横須賀", "メルキュールホテル横須賀"]
  },
  {
    names: ["びわ湖ホテル", "琵琶湖ホテル"],
    prefecture: "滋賀県",
    hotelNo: "4843",
    expectedNames: ["びわ湖ホテル", "琵琶湖ホテル"]
  },
  {
    names: ["呉森沢ホテル"],
    prefecture: "広島県",
    hotelNo: "68088",
    expectedNames: ["呉森沢ホテル", "K.M.H Art hotel by Kure Morisawa"]
  }
];

const OVERRIDES = RAW_OVERRIDES.map(entry => ({
  ...entry,
  keys: entry.names.map(normalizeName),
  expectedNames: [...new Set([...(entry.expectedNames || []), ...entry.names])]
}));

function findHotelOverride(context) {
  const nameKey = normalizeName(context?.name);
  if (!nameKey) return null;
  const prefectureKey = normalizeName(context?.prefecture);
  return OVERRIDES.find(entry => {
    if (!entry.keys.includes(nameKey)) return false;
    if (!entry.prefecture || !prefectureKey) return true;
    return normalizeName(entry.prefecture) === prefectureKey;
  }) || null;
}

module.exports = { findHotelOverride, normalizeName };
