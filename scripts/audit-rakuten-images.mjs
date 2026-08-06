import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2] || "assets/data/hotels.json";
const outputPath = process.argv[3] || "reports/rakuten-image-audit.json";

function decodeRepeated(value) {
  let result = String(value || "");
  for (let i = 0; i < 4; i += 1) {
    try {
      const decoded = decodeURIComponent(result.replace(/\+/g, "%20"));
      if (decoded === result) break;
      result = decoded;
    } catch {
      break;
    }
  }
  return result;
}

function collectStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach(item => collectStrings(item, out));
  return out;
}

function extractHotelNosFromText(text) {
  const candidates = new Set();
  const variants = new Set([String(text || ""), decodeRepeated(text)]);

  for (const initial of [...variants]) {
    try {
      const url = new URL(initial);
      for (const value of url.searchParams.values()) variants.add(decodeRepeated(value));
      if (url.hash) variants.add(decodeRepeated(url.hash));
    } catch {
      // Encoded affiliate destinations are still searched below.
    }
  }

  const patterns = [
    /(?:travel\.rakuten\.co\.jp|hotel\.travel\.rakuten\.co\.jp)\/HOTEL\/(\d+)(?:\/|\.html|$|[?#])/gi,
    /\/hotelinfo\/plan\/(\d+)(?:\/|$|[?#])/gi,
    /[?&](?:f_hotel_no|hotelNo|hotel_no|hotelno)=(\d+)/gi,
    /(?:%2FHOTEL%2F|\/HOTEL\/)(\d+)/gi
  ];

  for (const variant of variants) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(variant))) candidates.add(match[1]);
    }
  }
  return [...candidates];
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　・･()（）\[\]【】「」『』]/g, "")
    .replace(/ホテル|hotel/g, "")
    .trim();
}

function normalizeAddress(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\s　,，]/g, "")
    .trim();
}

function getRakutenStrings(hotel) {
  const values = [];
  if (hotel?.rakuten) values.push(hotel.rakuten);
  if (hotel?.rakutenUrl) values.push(hotel.rakutenUrl);
  if (Array.isArray(hotel?.affiliateLinks)) {
    hotel.affiliateLinks.forEach(link => {
      const provider = String(link?.provider || "");
      const url = String(link?.url || "");
      if (/楽天|rakuten/i.test(provider) || /rakuten/i.test(url)) values.push(url);
    });
  }
  return values.filter(Boolean);
}

const raw = fs.readFileSync(inputPath, "utf8");
const parsed = JSON.parse(raw);
const hotels = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.hotels) ? parsed.hotels : [];
if (!hotels.length) throw new Error("No hotel records were found in the input JSON.");

const records = hotels.map((hotel, index) => {
  const explicitNos = [];
  if (hotel?.rakutenHotelNo != null && /^\d+$/.test(String(hotel.rakutenHotelNo))) explicitNos.push(String(hotel.rakutenHotelNo));
  else explicitNos.push(...collectStrings(hotel?.rakutenHotelNo).flatMap(extractHotelNosFromText));
  const linkNos = getRakutenStrings(hotel).flatMap(extractHotelNosFromText);
  const hotelNos = [...new Set([...explicitNos, ...linkNos])];
  return {
    index,
    id: String(hotel?.id || ""),
    name: String(hotel?.name || ""),
    address: String(hotel?.address || hotel?.hotelAddress || ""),
    image: String(hotel?.image || ""),
    rakutenLinks: getRakutenStrings(hotel),
    hotelNos,
    normalizedName: normalizeName(hotel?.name),
    normalizedAddress: normalizeAddress(hotel?.address || hotel?.hotelAddress)
  };
});

const groupBy = (items, keyFn) => {
  const map = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    if (!key) return;
    const list = map.get(key) || [];
    list.push(item);
    map.set(key, list);
  });
  return map;
};

const idGroups = groupBy(records, item => item.id);
const hotelNoGroups = new Map();
records.forEach(record => record.hotelNos.forEach(no => {
  const list = hotelNoGroups.get(no) || [];
  list.push(record);
  hotelNoGroups.set(no, list);
}));
const exactIdentityGroups = groupBy(records, item => item.normalizedName && item.normalizedAddress ? `${item.normalizedName}|${item.normalizedAddress}` : "");

const multiNoRecords = records.filter(item => item.hotelNos.length > 1);
const hotelNoConflicts = [...hotelNoGroups.entries()].map(([hotelNo, items]) => {
  const names = [...new Set(items.map(item => item.normalizedName).filter(Boolean))];
  const addresses = [...new Set(items.map(item => item.normalizedAddress).filter(Boolean))];
  const conflict = names.length > 1 && addresses.length > 1;
  return conflict ? {
    hotelNo,
    recordCount: items.length,
    records: items.map(({ index, id, name, address }) => ({ index, id, name, address }))
  } : null;
}).filter(Boolean);

const duplicateIds = [...idGroups.entries()]
  .filter(([id, items]) => id && items.length > 1)
  .map(([id, items]) => ({ id, count: items.length, indexes: items.map(item => item.index) }));

const duplicateHotelNos = [...hotelNoGroups.entries()]
  .filter(([, items]) => items.length > 1)
  .map(([hotelNo, items]) => ({
    hotelNo,
    count: items.length,
    records: items.map(({ index, id, name, address, image }) => ({ index, id, name, address, hasImage: Boolean(image) }))
  }));

const exactIdentityDuplicates = [...exactIdentityGroups.entries()]
  .filter(([, items]) => items.length > 1)
  .map(([key, items]) => ({
    key,
    count: items.length,
    records: items.map(({ index, id, name, address, hotelNos }) => ({ index, id, name, address, hotelNos }))
  }));

const uniqueHotelNos = [...hotelNoGroups.keys()].sort((a, b) => Number(a) - Number(b));
const report = {
  generatedAt: new Date().toISOString(),
  source: inputPath,
  credentialsAvailable: {
    applicationId: Boolean(process.env.RAKUTEN_APP_ID),
    accessKey: Boolean(process.env.RAKUTEN_ACCESS_KEY),
    affiliateId: Boolean(process.env.RAKUTEN_AFFILIATE_ID)
  },
  summary: {
    totalRecords: records.length,
    recordsWithExistingImage: records.filter(item => item.image).length,
    recordsWithRakutenLink: records.filter(item => item.rakutenLinks.length).length,
    recordsWithExactlyOneHotelNo: records.filter(item => item.hotelNos.length === 1).length,
    recordsWithMultipleHotelNos: multiNoRecords.length,
    recordsWithoutHotelNo: records.filter(item => item.hotelNos.length === 0).length,
    uniqueHotelNos: uniqueHotelNos.length,
    hotelNosReferencedByMultipleRecords: duplicateHotelNos.length,
    conflictingHotelNoGroups: hotelNoConflicts.length,
    duplicateRecordIds: duplicateIds.length,
    exactNameAddressDuplicateGroups: exactIdentityDuplicates.length
  },
  safeForAutomaticImageFetch: multiNoRecords.length === 0 && hotelNoConflicts.length === 0 && duplicateIds.length === 0,
  uniqueHotelNos,
  recordsWithMultipleHotelNos: multiNoRecords.map(({ index, id, name, address, hotelNos, rakutenLinks }) => ({ index, id, name, address, hotelNos, rakutenLinks })),
  hotelNoConflicts,
  duplicateRecordIds: duplicateIds,
  duplicateHotelNos,
  exactNameAddressDuplicates: exactIdentityDuplicates,
  unresolved: records.filter(item => item.hotelNos.length === 0).map(({ index, id, name, address, rakutenLinks, image }) => ({ index, id, name, address, rakutenLinks, hasImage: Boolean(image) }))
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary));
console.log(`safeForAutomaticImageFetch=${report.safeForAutomaticImageFetch}`);
