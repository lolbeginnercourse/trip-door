import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const hotelPath = path.join(root, "assets/data/hotels.json");
const venuePath = path.join(root, "assets/data/seo-venues.json");
const outputDir = path.join(root, "artifacts/seo-inventory");

const readJson = async file => JSON.parse(await fs.readFile(file, "utf8"));
const asArray = value => Array.isArray(value) ? value : [];
const text = value => typeof value === "string" ? value.trim() : "";

function categoriesOf(hotel) {
  const categories = asArray(hotel.categories).filter(Boolean);
  if (categories.length) return categories;
  return text(hotel.genre) ? [hotel.genre] : [];
}

function venueMatches(hotel, venue) {
  if (!categoriesOf(hotel).includes(venue.category)) return false;
  const { field, value } = venue.match || {};
  if (!field || !value) return false;
  if (field === "venues") return asArray(hotel.venues).includes(value);
  return hotel[field] === value;
}

function summarizeHotel(hotel) {
  const keys = Object.keys(hotel).sort();
  const candidateAccessFields = [
    "accessEstimate", "access", "accessMinutes", "travelMinutes", "totalMinutes",
    "walkMinutes", "transfers", "nearestStation", "station", "priceEstimate",
    "priceNumeric", "priceValue", "venueId", "venueLabel", "venues", "area",
    "prefecture", "city", "role", "facts", "summary", "statuses"
  ];
  return {
    id: hotel.id || null,
    name: hotel.name || null,
    keys,
    fields: Object.fromEntries(candidateAccessFields
      .filter(key => hotel[key] !== undefined && hotel[key] !== null && hotel[key] !== "")
      .map(key => [key, hotel[key]]))
  };
}

const hotelData = await readJson(hotelPath);
const venueData = await readJson(venuePath);
const hotels = asArray(hotelData.hotels);
const venues = asArray(venueData.venues);

if (!hotels.length) throw new Error("assets/data/hotels.json has no hotels array");
if (!venues.length) throw new Error("assets/data/seo-venues.json has no venues array");

const allKeys = [...new Set(hotels.flatMap(hotel => Object.keys(hotel)))].sort();
const categoryCounts = {};
for (const hotel of hotels) {
  for (const category of categoriesOf(hotel)) categoryCounts[category] = (categoryCounts[category] || 0) + 1;
}

const pilot = venues.map(venue => {
  const matched = hotels.filter(hotel => venueMatches(hotel, venue));
  return {
    category: venue.category,
    slug: venue.slug,
    name: venue.name,
    match: venue.match,
    hotelCount: matched.length,
    sampleHotels: matched.slice(0, 5).map(summarizeHotel)
  };
});

const stageVenueCounts = new Map();
for (const hotel of hotels.filter(hotel => categoriesOf(hotel).includes("stage"))) {
  if (!text(hotel.venueId)) continue;
  const current = stageVenueCounts.get(hotel.venueId) || {
    venueId: hotel.venueId,
    venueLabel: hotel.venueLabel || "",
    prefecture: hotel.prefecture || hotel.area || "",
    count: 0
  };
  current.count += 1;
  stageVenueCounts.set(hotel.venueId, current);
}

const esportsVenueCounts = new Map();
for (const hotel of hotels.filter(hotel => categoriesOf(hotel).includes("esports"))) {
  for (const venueKey of asArray(hotel.venues)) {
    const current = esportsVenueCounts.get(venueKey) || { venueKey, count: 0, sampleNames: [] };
    current.count += 1;
    if (current.sampleNames.length < 3 && hotel.name) current.sampleNames.push(hotel.name);
    esportsVenueCounts.set(venueKey, current);
  }
}

const inventory = {
  generatedAt: new Date().toISOString(),
  hotelCount: hotels.length,
  categoryCounts,
  allHotelKeys: allKeys,
  pilots: pilot,
  stageVenues: [...stageVenueCounts.values()].sort((a, b) => (a.prefecture || "").localeCompare(b.prefecture || "", "ja") || (a.venueLabel || "").localeCompare(b.venueLabel || "", "ja")),
  esportsVenues: [...esportsVenueCounts.values()].sort((a, b) => b.count - a.count || a.venueKey.localeCompare(b.venueKey))
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);

const lines = [
  `hotelCount=${inventory.hotelCount}`,
  `categoryCounts=${JSON.stringify(inventory.categoryCounts)}`,
  `allHotelKeys=${inventory.allHotelKeys.join(",")}`,
  "",
  "PILOTS"
];
for (const venue of pilot) lines.push(`${venue.category}:${venue.slug}:${venue.name}:hotels=${venue.hotelCount}`);
lines.push("", `stageVenueCount=${inventory.stageVenues.length}`, `esportsVenueCount=${inventory.esportsVenues.length}`);
await fs.writeFile(path.join(outputDir, "summary.txt"), `${lines.join("\n")}\n`);

console.log(lines.join("\n"));
