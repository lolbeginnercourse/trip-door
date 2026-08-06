import fs from "node:fs";

const DATA_PATH = process.env.DATA_PATH || "assets/data/hotels.json";
const SHARD_SIZE = Number(process.env.SHARD_SIZE || 25);

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

if (!Number.isInteger(SHARD_SIZE) || SHARD_SIZE < 1 || SHARD_SIZE > 100) {
  throw new Error(`Invalid SHARD_SIZE: ${SHARD_SIZE}`);
}

const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const hotels = normalizeHotels(payload);
if (hotels.length === 0) throw new Error("No hotel records found.");

const uniqueKeys = new Set(hotels.map(requestKey));
const totalUnique = uniqueKeys.size;
const shardCount = Math.ceil(totalUnique / SHARD_SIZE);
const shards = Array.from({ length: shardCount }, (_, index) => index);

const output = process.env.GITHUB_OUTPUT;
if (!output) throw new Error("GITHUB_OUTPUT is not available.");

fs.appendFileSync(
  output,
  [
    `total_records=${hotels.length}`,
    `total_unique=${totalUnique}`,
    `shard_count=${shardCount}`,
    `shards=${JSON.stringify(shards)}`
  ].join("\n") + "\n",
  "utf8"
);

console.log(JSON.stringify({
  totalRecords: hotels.length,
  totalUnique,
  shardSize: SHARD_SIZE,
  shardCount
}, null, 2));
