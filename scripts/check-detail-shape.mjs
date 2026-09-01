import vm from "node:vm";

const pageUrl = "https://www.data.go.kr/data/15158625/openapi.do";
const pageRes = await fetch(pageUrl, { headers: { "user-agent": "Mozilla/5.0" } });
if (!pageRes.ok) throw new Error(`data.go page ${pageRes.status}`);
const page = await pageRes.text();
const swaggerMatch = page.match(/const\s+swaggerJson\s*=\s*`([\s\S]*?)`\s*;/);
if (!swaggerMatch) throw new Error("embedded swaggerJson not found");
const templateBody = swaggerMatch[1].replaceAll("`", "\\`").replaceAll("${", "\\${");
const swagger = JSON.parse(vm.runInNewContext("`" + templateBody + "`"));

console.log(`[KAC detail spec] host=${swagger?.host || ""} basePath=${swagger?.basePath || ""}`);
const methods = swagger?.paths?.["/detail"] || {};
console.log(`[KAC detail spec] pathParams=${JSON.stringify(methods?.parameters || [])}`);
for (const [method, operation] of Object.entries(methods)) {
  if (!operation || typeof operation !== "object" || method === "parameters") continue;
  console.log(`[KAC detail spec] method=${method.toUpperCase()} summary=${operation?.summary || ""}`);
  console.log(`[KAC detail spec] parameters=${JSON.stringify(operation?.parameters || [])}`);
  console.log(`[KAC detail spec] responses=${JSON.stringify(operation?.responses || {}).slice(0, 12000)}`);
}
