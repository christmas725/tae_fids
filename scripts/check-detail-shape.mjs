import vm from "node:vm";

const raw = (process.env.KAC_API_KEY || "").trim();
if (!raw) {
  console.log("[KAC detail check] KAC_API_KEY missing");
  process.exit(0);
}
let key = raw;
try { key = decodeURIComponent(raw); } catch {}

const pageUrl = "https://www.data.go.kr/data/15158625/openapi.do";
const pageRes = await fetch(pageUrl, { headers: { "user-agent": "Mozilla/5.0" } });
if (!pageRes.ok) throw new Error(`data.go page ${pageRes.status}`);
const page = await pageRes.text();
const swaggerMatch = page.match(/const\s+swaggerJson\s*=\s*`([\s\S]*?)`\s*;/);
if (!swaggerMatch) throw new Error("embedded swaggerJson not found");
const templateBody = swaggerMatch[1].replaceAll("`", "\\`").replaceAll("${", "\\${");
const swagger = JSON.parse(vm.runInNewContext("`" + templateBody + "`"));

for (const path of ["/depart", "/arrival", "/taxfree", "/info", "/detail"]) {
  const methods = swagger?.paths?.[path] || {};
  for (const [method, operation] of Object.entries(methods)) {
    if (!operation || typeof operation !== "object" || method === "parameters") continue;
    const item = operation?.responses?.["200"]?.schema?.properties?.body?.properties?.items?.properties?.item;
    const props = item?.properties || {};
    const fields = Object.entries(props).map(([name, spec]) => `${name}:${spec?.description || ""}`);
    console.log(`[KAC fields] ${method.toUpperCase()} ${path} => ${fields.join(" | ")}`);
  }
}

const detailUrl = new URL("https://apis.data.go.kr/B551178/flight-status/detail");
detailUrl.searchParams.set("serviceKey", key);
detailUrl.searchParams.set("pageNo", "1");
detailUrl.searchParams.set("numOfRows", "500");
detailUrl.searchParams.set("type", "json");

const response = await fetch(detailUrl, { headers: { Accept: "application/json" } });
const body = await response.text();
console.log(`[KAC detail data] status=${response.status}`);
let json;
try { json = JSON.parse(body); } catch {
  console.log(`[KAC detail data] non-json=${body.replace(/\s+/g, " ").slice(0, 1000)}`);
  process.exit(0);
}
const root = json?.response ?? json;
const header = root?.header ?? {};
const payload = root?.body ?? {};
const value = payload?.items?.item ?? payload?.items ?? [];
const items = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
console.log(`[KAC detail data] resultCode=${header?.resultCode ?? ""} resultMsg=${header?.resultMsg ?? ""} totalCount=${payload?.totalCount ?? ""} returned=${items.length}`);

const tae = items.filter((item) => String(item?.AIRPORT ?? item?.airport ?? "").toUpperCase() === "TAE");
console.log(`[KAC detail data] TAE matches=${tae.length}`);
console.log(`[KAC detail data] TAE samples=${JSON.stringify(tae.slice(0, 12)).slice(0, 12000)}`);
