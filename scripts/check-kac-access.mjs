const raw = (process.env.KAC_API_KEY || "").trim();
if (!raw) {
  console.log("[KAC access check] KAC_API_KEY missing");
  process.exit(0);
}

let key = raw;
try { key = decodeURIComponent(raw); } catch {}

const url = new URL("https://apis.data.go.kr/B551178/flight-status/info");
url.searchParams.set("serviceKey", key);
url.searchParams.set("schAirCode", "TAE");
url.searchParams.set("schIOType", "O");
url.searchParams.set("schStTime", "0000");
url.searchParams.set("schEdTime", "2359");
url.searchParams.set("type", "json");

try {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const body = (await response.text()).replace(/\s+/g, " ").slice(0, 500);
  console.log(`[KAC access check] status=${response.status} body=${body}`);
} catch (error) {
  console.log(`[KAC access check] request failed: ${error instanceof Error ? error.message : String(error)}`);
}
