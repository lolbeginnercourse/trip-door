import fs from "node:fs/promises";

const HOTEL_FILE = new URL("../assets/data/hotels.json", import.meta.url);
const META_FILE = new URL("../assets/data/seo-venues.json", import.meta.url);
const readJson = async url => JSON.parse(await fs.readFile(url, "utf8"));
const asArray = value => Array.isArray(value) ? value : [];
const text = value => typeof value === "string" ? value.trim() : "";
const errors = [];
const warnings = [];

function categoriesOf(hotel) {
  const categories = asArray(hotel.categories).filter(Boolean);
  return categories.length ? categories : (text(hotel.genre) ? [hotel.genre] : []);
}

function matches(hotel, venue) {
  if (!categoriesOf(hotel).includes(venue.category)) return false;
  const field = venue.match?.field;
  const value = venue.match?.value;
  if (!field || !value) return false;
  return field === "venues" ? asArray(hotel.venues).includes(value) : hotel[field] === value;
}

const hotelData = await readJson(HOTEL_FILE);
const metaData = await readJson(META_FILE);
const hotels = asArray(hotelData.hotels);
const venues = asArray(metaData.venues);

if (!hotels.length) errors.push("hotels.json: hotels array is empty or missing");
if (!venues.length) errors.push("seo-venues.json: venues array is empty or missing");

const hotelIds = new Set();
for (const [index, hotel] of hotels.entries()) {
  if (!text(hotel.id)) errors.push(`hotel[${index}] has no id`);
  else if (hotelIds.has(hotel.id)) errors.push(`duplicate hotel id: ${hotel.id}`);
  else hotelIds.add(hotel.id);
  if (!text(hotel.name)) errors.push(`hotel ${hotel.id || index} has no name`);
}

const slugs = new Set();
const matchKeys = new Set();
for (const venue of venues) {
  const prefix = `${venue.category || "?"}:${venue.name || "?"}`;
  if (!["stage", "esports"].includes(venue.category)) errors.push(`${prefix}: invalid category`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(venue.slug || "")) errors.push(`${prefix}: invalid slug ${venue.slug || "(empty)"}`);
  if (slugs.has(`${venue.category}:${venue.slug}`)) errors.push(`${prefix}: duplicate slug`);
  slugs.add(`${venue.category}:${venue.slug}`);
  const matchKey = `${venue.category}:${venue.match?.field}:${venue.match?.value}`;
  if (!venue.match?.field || !venue.match?.value) errors.push(`${prefix}: missing match selector`);
  if (matchKeys.has(matchKey)) errors.push(`${prefix}: duplicate match selector ${matchKey}`);
  matchKeys.add(matchKey);
  if (!text(venue.name)) errors.push(`${prefix}: missing name`);
  if (!text(venue.prefecture)) errors.push(`${prefix}: missing prefecture`);
  if (!text(venue.nearestStation)) warnings.push(`${prefix}: nearestStation is missing`);
  if (venue.sourceUrl && !/^https:\/\//.test(venue.sourceUrl)) errors.push(`${prefix}: sourceUrl must be https`);

  const matched = hotels.filter(hotel => matches(hotel, venue));
  if (!matched.length) errors.push(`${prefix}: matches 0 hotels`);
  if (venue.indexable === true && matched.length < 3) errors.push(`${prefix}: indexable=true but only ${matched.length} hotels`);
  if (venue.indexable === false && matched.length >= 3) warnings.push(`${prefix}: has ${matched.length} hotels but is intentionally noindex`);
}

const stageGroups = new Map();
for (const hotel of hotels.filter(hotel => categoriesOf(hotel).includes("stage"))) {
  if (!text(hotel.venueId) || !text(hotel.venueLabel)) continue;
  const list = stageGroups.get(hotel.venueId) || [];
  list.push(hotel);
  stageGroups.set(hotel.venueId, list);
}
if (!stageGroups.size) errors.push("No stage venue groups were discovered");
for (const [venueId, group] of stageGroups) {
  if (group.length < 3) warnings.push(`stage venue ${venueId} has only ${group.length} hotels`);
  const usable = group.filter(hotel => text(hotel.name) && text(hotel.station) && text(hotel.accessEstimate));
  if (usable.length < 3) warnings.push(`stage venue ${venueId} has fewer than 3 hotels with name/station/accessEstimate`);
}

if (warnings.length) {
  console.log("SEO data warnings:");
  warnings.forEach(message => console.log(`- ${message}`));
}
if (errors.length) {
  console.error("SEO data validation failed:");
  errors.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`SEO data validation passed: hotels=${hotels.length}, stageVenues=${stageGroups.size}, metadataVenues=${venues.length}`);
