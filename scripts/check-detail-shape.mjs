const raw = (process.env.KAC_API_KEY || "").trim();
if (!raw) process.exit(0);
let key = raw;
try { key = decodeURIComponent(raw); } catch {}

async function page(n) {
  const url = new URL("https://apis.data.go.kr/B551178/flight-status/detail");
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("pageNo", String(n));
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("type", "json");
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  const j = await r.json();
  const root = j?.response ?? j;
  const body = root?.body ?? {};
  const v = body?.items?.item ?? [];
  const items = Array.isArray(v) ? v : v ? [v] : [];
  const stds = items.map((x)=>String(x?.STD ?? "")).filter(Boolean);
  const dates = [...new Set(items.map((x)=>String(x?.FLIGHT_DATE ?? "")).filter(Boolean))];
  const tae = items.filter((x)=>String(x?.AIRPORT ?? "").toUpperCase()==="TAE");
  console.log(`[detail page ${n}] count=${items.length} minSTD=${stds[0] ?? ""} maxSTD=${stds.at(-1) ?? ""} dates=${dates.join(",")} TAE=${tae.length} TAErows=${JSON.stringify(tae.map(x=>({f:x.AIR_FLN,d:x.FLIGHT_DATE,io:x.IO,std:x.STD,g:x.GATE,b:x.BAGGAGE_CLAIM}))).slice(0,4000)}`);
}

for (const n of [1,5,10,15,20,25,30,35,40,45]) await page(n);
