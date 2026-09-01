import vm from 'node:vm';

const listId = '15158625';
const pageUrl = `https://www.data.go.kr/data/${listId}/openapi.do`;

const pageRes = await fetch(pageUrl, {
  headers: { 'user-agent': 'Mozilla/5.0' },
});
if (!pageRes.ok) throw new Error(`data.go page ${pageRes.status}`);
const page = await pageRes.text();

const swaggerMatch = page.match(/const\s+swaggerJson\s*=\s*`([\s\S]*?)`\s*;/);
if (!swaggerMatch) throw new Error('embedded swaggerJson not found');
const templateBody = swaggerMatch[1].replaceAll('`', '\\`').replaceAll('${', '\\${');
const swagger = JSON.parse(vm.runInNewContext('`' + templateBody + '`'));

console.log('[KAC SPEC] title', swagger?.info?.title);
console.log('[KAC SPEC] host', swagger?.host);
console.log('[KAC SPEC] basePath', swagger?.basePath || '');
console.log('[KAC SPEC] schemes', JSON.stringify(swagger?.schemes || []));
console.log('[KAC SPEC] top-level parameters', JSON.stringify(swagger?.parameters || {}));
console.log('[KAC SPEC] securityDefinitions', JSON.stringify(swagger?.securityDefinitions || {}));
console.log('[KAC SPEC] security', JSON.stringify(swagger?.security || []));

for (const [path, methods] of Object.entries(swagger?.paths || {})) {
  console.log(`\n[KAC SPEC] PATH ${path} parameters`, JSON.stringify(methods?.parameters || []));
  for (const [method, operation] of Object.entries(methods || {})) {
    if (!operation || typeof operation !== 'object' || method === 'parameters') continue;
    console.log(`[KAC SPEC] ===== ${method.toUpperCase()} ${path} =====`);
    console.log('[KAC SPEC] summary', operation.summary || '');
    console.log('[KAC SPEC] parameters raw', JSON.stringify(operation.parameters || []));
  }
}
