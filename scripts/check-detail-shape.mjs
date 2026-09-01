const raw = (process.env.KAC_API_KEY || "").trim();
if (!raw) {
  console.log("[KAC detail check] KAC_API_KEY missing");
  process.exit(0);
}

let key = raw;
try { key = decodeURIComponent(raw); } catch {}

const now = new Date();
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(now);
const read = (type) => parts.find((part) => part.type === type)?.value ?? "";
const date = `${read("year")}${read("month")}${read("day")}`;

const url = new URL("https://apis.data.go.kr/B551178/flight-status/detail");
url.searchParams.set("serviceKey", key);
url.searchParams.set("type", "json");
url.searchParams.set("searchdtCode", "S");
url.searchParams.set("searchDate", date);
url.searchParams.set("searchFrom", "TAE");
url.searchParams.set("searchTo", "");
url.searchParams.set("passengerOrCargo", "P");
url.searchParams.set("numOfRows", "500");
url.searchParams.set("pageNo", "1");

try {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await response.text();
  console.log(`[KAC detail check] status=${response.status}`);
  let json;
  try { json = JSON.parse(body); } catch {
    console.log(`[KAC detail check] non-json=${body.replace(/\s+/g, " ").slice(0, 500)}`);
    process.exit(0);
  }
  const responseRoot = json?.response ?? json;
  const header = responseRoot?.header ?? json?.header ?? {};
  const payload = responseRoot?.body ?? json?.body ?? json;
  const value = payload?.items?.item ?? payload?.items ?? json?.items?.item ?? json?.items ?? [];
  const items = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  console.log(`[KAC detail check] resultCode=${header?.resultCode ?? ""} resultMsg=${header?.resultMsg ?? ""} totalCount=${payload?.totalCount ?? ""} returned=${items.length}`);
  if (items.length) {
    const keys = [...new Set(items.flatMap((item) => Object.keys(item || {})))].sort();
    console.log(`[KAC detail check] keys=${keys.join(",")}`);
    const candidates = items.slice(0, 8).map((item) => ({
      flightId: item?.flightId ?? item?.flightid ?? item?.airFln ?? item?.AIR_FLN,
      masterFlightId: item?.masterFlightId ?? item?.masterflightid ?? item?.masterFlightid ?? item?.MASTER_FLN,
      codeshare: item?.codeshare ?? item?.codeShare ?? item?.CDSR_YN,
      gate: item?.gate ?? item?.GATE,
      baggageClaim: item?.baggageClaim ?? item?.BAGGAGE_CLAIM ?? item?.carousel ?? item?.CAROUSEL,
      airline: item?.airline ?? item?.airlineKorean ?? item?.AIR_KOR,
      raw: item,
    }));
    console.log(`[KAC detail check] samples=${JSON.stringify(candidates).slice(0, 7000)}`);
  }
} catch (error) {
  console.log(`[KAC detail check] request failed: ${error instanceof Error ? error.message : String(error)}`);
}
