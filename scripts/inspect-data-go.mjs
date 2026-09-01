import vm from 'node:vm';

const listId = '15158625';
const pageUrl = `https://www.data.go.kr/data/${listId}/openapi.do`;

const pageRes = await fetch(pageUrl, { headers: { 'user-agent': 'Mozilla/5.0' } });
if (!pageRes.ok) throw new Error(`data.go page ${pageRes.status}`);
const page = await pageRes.text();
const swaggerMatch = page.match(/const\s+swaggerJson\s*=\s*`([\s\S]*?)`\s*;/);
if (!swaggerMatch) throw new Error('embedded swaggerJson not found');
const templateBody = swaggerMatch[1].replaceAll('`', '\\`').replaceAll('${', '\\${');
const swagger = JSON.parse(vm.runInNewContext('`' + templateBody + '`'));

console.log('[KAC SPEC] host', swagger?.host);
console.log('[KAC SPEC] paths', Object.keys(swagger?.paths || {}).join(', '));
console.log('[KAC SPEC] /info params', JSON.stringify(swagger?.paths?.['/info']?.parameters || []));
console.log('[KAC SPEC] /detail params', JSON.stringify(swagger?.paths?.['/detail']?.parameters || []));

const configuredKey = process.env.KAC_API_KEY?.trim();
if (!configuredKey) {
  console.log('[KAC LIVE] KAC_API_KEY is missing in Preview environment');
  process.exit(0);
}
let key = configuredKey;
try { key = decodeURIComponent(configuredKey); } catch {}

const base = 'https://apis.data.go.kr/B551178/flight-status';
const redacted = (value) => String(value).replaceAll(key, '<redacted>').slice(0, 6000);

async function test(name, path, params) {
  const url = new URL(base + path);
  url.searchParams.set('serviceKey', key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const body = await res.text();
  console.log(`[KAC LIVE] ${name} HTTP`, res.status, res.headers.get('content-type') || '');
  try {
    const json = JSON.parse(body);
    const response = json?.response || json;
    const header = response?.header || json?.header || {};
    const dataBody = response?.body || json?.body || {};
    const items = dataBody?.items?.item ?? dataBody?.items ?? [];
    const arr = Array.isArray(items) ? items : items ? [items] : [];
    console.log(`[KAC LIVE] ${name} header`, JSON.stringify(header));
    console.log(`[KAC LIVE] ${name} totalCount`, dataBody?.totalCount ?? json?.totalCount ?? null);
    console.log(`[KAC LIVE] ${name} itemCount`, arr.length);
    console.log(`[KAC LIVE] ${name} sample`, redacted(JSON.stringify(arr.slice(0, 3))));
  } catch {
    console.log(`[KAC LIVE] ${name} body`, redacted(body));
  }
}

await test('info-departures', '/info', {
  schAirCode: 'TAE',
  schIOType: 'O',
  schStTime: '0000',
  schEdTime: '2359',
  type: 'json',
});
await test('info-arrivals', '/info', {
  schAirCode: 'TAE',
  schIOType: 'I',
  schStTime: '0000',
  schEdTime: '2359',
  type: 'json',
});
await test('detail', '/detail', {
  pageNo: '1',
  numOfRows: '100',
  type: 'json',
});
