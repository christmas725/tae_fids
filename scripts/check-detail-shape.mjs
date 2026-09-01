const raw = (process.env.KAC_API_KEY || "").trim();
if (!raw) process.exit(0);
let key = raw;
try { key = decodeURIComponent(raw); } catch {}

const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
const read = (type) => parts.find((part) => part.type === type)?.value ?? "";
const date = `${read("year")}${read("month")}${read("day")}`;
const formDate = `${read("year")}-${read("month")}-${read("day")}`;

function parse(json) {
  const root = json?.response ?? json;
  const body = root?.body ?? json?.body ?? {};
  const value = body?.items?.item ?? body?.items ?? [];
  return { root, body, items: Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [] };
}

for (const rows of [200, 500, 1000]) {
  const url = new URL("https://apis.data.go.kr/B551178/flight-status/detail");
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", String(rows));
  url.searchParams.set("type", "json");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { console.log(`[detail rows=${rows}] non-json`); continue; }
  const result = parse(json);
  console.log(`[detail rows=${rows}] status=${response.status} code=${result.root?.header?.resultCode ?? ""} total=${result.body?.totalCount ?? ""} returned=${result.items.length} top=${Object.keys(json || {}).join(",")}`);
  if (!result.items.length) console.log(`[detail rows=${rows}] body=${text.replace(/\s+/g, " ").slice(0, 700)}`);
  const taeToday = result.items.filter((item) => String(item?.AIRPORT ?? "").toUpperCase() === "TAE" && String(item?.FLIGHT_DATE ?? "") === date);
  console.log(`[detail rows=${rows}] TAE today=${taeToday.length} gate=${taeToday.filter((x)=>x?.GATE).length} baggage=${taeToday.filter((x)=>x?.BAGGAGE_CLAIM).length}`);
}

const hpBody = new URLSearchParams({
  pInoutGbn: "I", pAirport: "TAE", pGbn: "", pActDate: formDate,
  pSthourMin: "00:00", pEnhourMin: "23:59", pCity: "", pAirline: "", pAirlinenum: "", p0: ""
});
const hp = await fetch("https://www.airport.co.kr/daegu/ajaxf/frPryInfoSvc/getPryInfoList.do", {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: "https://www.airport.co.kr",
    Referer: "https://www.airport.co.kr/daegu/cms/frCon/index.do?MENU_ID=100",
    "User-Agent": "Mozilla/5.0",
    "X-Requested-With": "XMLHttpRequest"
  },
  body: hpBody
});
const hpText = await hp.text();
console.log(`[homepage arrival] status=${hp.status} prefix=${hpText.replace(/\s+/g," ").slice(0,500)}`);
try {
  const hpJson = JSON.parse(hpText);
  const list = Array.isArray(hpJson?.data?.list) ? hpJson.data.list : [];
  const keys = [...new Set(list.flatMap((x)=>Object.keys(x||{})))].sort();
  console.log(`[homepage arrival] count=${list.length} keys=${keys.join(",")}`);
  console.log(`[homepage arrival] samples=${JSON.stringify(list.slice(0,5)).slice(0,6000)}`);
} catch {}
