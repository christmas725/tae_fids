const raw = (process.env.KAC_API_KEY || "").trim();
if (!raw) process.exit(0);
let key = raw;
try { key = decodeURIComponent(raw); } catch {}

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
}).formatToParts(new Date());
const read = (type) => parts.find((part) => part.type === type)?.value ?? "";
const date = `${read("year")}${read("month")}${read("day")}`;

function itemsFrom(json) {
  const root = json?.response ?? json;
  const body = root?.body ?? json?.body ?? {};
  const value = body?.items?.item ?? body?.items ?? [];
  return { root, body, items: Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [] };
}

async function call(path, params) {
  const url = new URL(`https://apis.data.go.kr/B551178/flight-status/${path}`);
  url.searchParams.set("serviceKey", key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("type", "json");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch {
    console.log(`[KAC verify] ${path} status=${response.status} non-json=${text.replace(/\s+/g, " ").slice(0, 500)}`);
    return null;
  }
  const parsed = itemsFrom(json);
  console.log(`[KAC verify] ${path} status=${response.status} code=${parsed.root?.header?.resultCode ?? ""} total=${parsed.body?.totalCount ?? ""} returned=${parsed.items.length}`);
  return parsed.items;
}

const common = { pageNo: "1", numOfRows: "100", searchday: date, from_time: "0000", to_time: "2359", airport_code: "TAE" };
const departures = await call("depart", common) ?? [];
const arrivals = await call("arrival", common) ?? [];

for (const [label, items] of [["depart", departures], ["arrival", arrivals]]) {
  const shared = items.filter((item) => String(item?.codeshare ?? "").toUpperCase() === "Y" || String(item?.masterflightid ?? "").trim());
  console.log(`[KAC codeshare] ${label} shared=${shared.length} samples=${JSON.stringify(shared.slice(0, 20)).slice(0, 10000)}`);
}

const detail = await call("detail", { pageNo: "1", numOfRows: "5000" }) ?? [];
const taeToday = detail.filter((item) => String(item?.AIRPORT ?? "").toUpperCase() === "TAE" && String(item?.FLIGHT_DATE ?? "") === date);
const gateRows = taeToday.filter((item) => String(item?.GATE ?? "").trim());
const baggageRows = taeToday.filter((item) => String(item?.BAGGAGE_CLAIM ?? "").trim());
console.log(`[KAC facilities] TAE today=${taeToday.length} gate=${gateRows.length} baggage=${baggageRows.length}`);
console.log(`[KAC facilities] samples=${JSON.stringify(taeToday.filter((item) => item?.GATE || item?.BAGGAGE_CLAIM).slice(0, 30)).slice(0, 12000)}`);
