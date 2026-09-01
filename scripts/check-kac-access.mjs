const raw = (process.env.KAC_API_KEY || "").trim();
if (!raw) {
  console.log("[KAC access check] KAC_API_KEY missing");
  process.exit(0);
}

let key = raw;
try { key = decodeURIComponent(raw); } catch {}

for (const [label, io] of [["departures", "O"], ["arrivals", "I"]]) {
  const url = new URL("https://apis.data.go.kr/B551178/flight-status/info");
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("schAirCode", "TAE");
  url.searchParams.set("schIOType", io);
  url.searchParams.set("schStTime", "0000");
  url.searchParams.set("schEdTime", "2359");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("type", "json");

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await response.text();
    let summary = text.replace(/\s+/g, " ").slice(0, 500);
    try {
      const json = JSON.parse(text);
      const body = json?.response?.body ?? {};
      const item = body?.items?.item ?? [];
      const count = Array.isArray(item) ? item.length : item ? 1 : 0;
      summary = `resultCode=${json?.response?.header?.resultCode ?? "?"} totalCount=${body?.totalCount ?? "?"} returned=${count} numOfRows=${body?.numOfRows ?? "?"}`;
    } catch {}
    console.log(`[KAC access check] ${label} status=${response.status} ${summary}`);
  } catch (error) {
    console.log(`[KAC access check] ${label} request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
