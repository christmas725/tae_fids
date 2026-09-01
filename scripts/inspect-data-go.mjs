import vm from 'node:vm';

const listId = '15158625';
const pageUrl = `https://www.data.go.kr/data/${listId}/openapi.do`;

const pageRes = await fetch(pageUrl, {
  headers: { 'user-agent': 'Mozilla/5.0' },
});
if (!pageRes.ok) throw new Error(`data.go page ${pageRes.status}`);
const page = await pageRes.text();

console.log('[KAC SPEC] page status', pageRes.status, 'bytes', page.length);

const swaggerMatch = page.match(/const\s+swaggerJson\s*=\s*`([\s\S]*?)`\s*;/);
if (!swaggerMatch) throw new Error('embedded swaggerJson not found');

const templateBody = swaggerMatch[1]
  .replaceAll('`', '\\`')
  .replaceAll('${', '\\${');
const decodedSwaggerText = vm.runInNewContext('`' + templateBody + '`');
const swagger = JSON.parse(decodedSwaggerText);

console.log('[KAC SPEC] title', swagger?.info?.title);
console.log('[KAC SPEC] host', swagger?.host);
console.log('[KAC SPEC] basePath', swagger?.basePath || '');
console.log('[KAC SPEC] schemes', JSON.stringify(swagger?.schemes || []));

for (const [path, methods] of Object.entries(swagger?.paths || {})) {
  for (const [method, operation] of Object.entries(methods || {})) {
    if (!operation || typeof operation !== 'object' || method === 'parameters') continue;
    console.log(`\n[KAC SPEC] ===== ${method.toUpperCase()} ${path} =====`);
    console.log('[KAC SPEC] summary', operation.summary || '');
    console.log('[KAC SPEC] description', operation.description || '');
    const params = (operation.parameters || []).map((p) => ({
      name: p.name,
      in: p.in,
      required: Boolean(p.required),
      type: p.type,
      description: p.description,
      default: p.default,
      example: p['x-example'],
    }));
    console.log('[KAC SPEC] parameters', JSON.stringify(params));

    const itemProps = operation?.responses?.['200']?.schema?.properties?.body?.properties?.items?.properties?.item?.properties;
    if (itemProps) {
      console.log('[KAC SPEC] item fields', JSON.stringify(Object.entries(itemProps).map(([name, spec]) => ({
        name,
        description: spec?.description || '',
        type: spec?.type || '',
      }))));
    }
  }
}
