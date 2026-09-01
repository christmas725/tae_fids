import vm from "node:vm";

const raw = (process.env.KAC_API_KEY || "").trim();
if (!raw) process.exit(0);
let key = raw;
try { key = decodeURIComponent(raw); } catch {}

const pageRes = await fetch("https://www.data.go.kr/data/15158625/openapi.do", { headers: { "user-agent": "Mozilla/5.0" } });
const page = await pageRes.text();
const swaggerMatch = page.match(/const\s+swaggerJson\s*=\s*`([\s\S]*?)`\s*;/);
if (!swaggerMatch) throw new Error("embedded swaggerJson not found");
const templateBody = swaggerMatch[1].replaceAll("`", "\\`").replaceAll("${", "\\${");
const swagger = JSON.parse(vm.runInNewContext("`" + templateBody + "`"));

for (const path of ["/depart", "/arrival", "/detail"]) {
  const methods = swagger?.paths?.[path] || {};
  console.log(`[KAC params] ${path} path=${JSON.stringify(methods?.parameters || [])}`);
  for (const [method, operation] of Object.entries(methods)) {
    if (!operation || typeof operation !== "object" || method === "parameters") continue;
    console.log(`[KAC params] ${path} ${method} op=${JSON.stringify(operation?.parameters || [])}`);
  }
}

const detailUrl = new URL("https://apis.data.go.kr/B551178/flight-status/detail");
detailUrl.searchParams.set("serviceKey", key);
detailUrl.searchParams.set("pageNo", "1");
detailUrl.searchParams.set("numOfRows", "100");
detailUrl.searchParams.set("type", "json");
const response = await fetch(detailUrl, { headers: { Accept: "application/json" } });
const body = await response.text();
console.log(`[KAC detail raw] status=${response.status} body=${body.replaceAll(key, "<redacted>").replace(/\s+/g, " ").slice(0, 6000)}`);
