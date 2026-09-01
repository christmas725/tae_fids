const listId = '15158625';
const pageUrl = `https://www.data.go.kr/data/${listId}/openapi.do`;

const pageRes = await fetch(pageUrl, {
  headers: { 'user-agent': 'Mozilla/5.0' },
});
if (!pageRes.ok) throw new Error(`data.go page ${pageRes.status}`);
const page = await pageRes.text();

const decode = (s) => s
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');

console.log('[KAC SPEC] page status', pageRes.status, 'bytes', page.length);
const interesting = page
  .split('\n')
  .filter((line) => /15158625|B551178|open_api|oprtin|publicData|selectApi|apis\.data\.go\.kr|상세기능|요청주소|서비스URL/i.test(line))
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(0, 300);
console.log('[KAC SPEC] interesting HTML lines\n' + interesting.join('\n'));

const pkPatterns = [
  /name=["']publicDataDetailPk["'][^>]*value=["']([^"']+)/is,
  /value=["']([^"']+)["'][^>]*name=["']publicDataDetailPk["']/is,
  /publicDataDetailPk\s*[:=]\s*["']([^"']+)/is,
];
let detailPk = '';
for (const pattern of pkPatterns) {
  const match = page.match(pattern);
  if (match) {
    detailPk = decode(match[1]);
    break;
  }
}

const selectMatch = page.match(/<select[^>]*id=["']open_api_detail_select["'][^>]*>([\s\S]*?)<\/select>/i);
const options = selectMatch
  ? [...selectMatch[1].matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi)]
      .map(([, seq, label]) => ({
        seq: decode(seq).trim(),
        label: decode(label.replace(/<[^>]+>/g, '')).trim(),
      }))
      .filter((x) => x.seq)
  : [];

console.log('[KAC SPEC] publicDataDetailPk', detailPk || '(not found)');
console.log('[KAC SPEC] operations', JSON.stringify(options));

if (!detailPk || !options.length) {
  console.log('[KAC SPEC] dynamic identifiers were not server-rendered; diagnostic complete');
  process.exit(0);
}

for (const op of options) {
  const body = new URLSearchParams({
    oprtinSeqNo: op.seq,
    publicDataDetailPk: detailPk,
    publicDataPk: listId,
  });
  const res = await fetch('https://www.data.go.kr/tcs/dss/selectApiDetailFunction.do', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'user-agent': 'Mozilla/5.0',
    },
    body,
  });
  if (!res.ok) throw new Error(`detail ${op.seq} ${res.status}`);
  const detailHtml = await res.text();
  const text = decode(
    detailHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n'),
  )
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .join('\n');
  console.log(`\n[KAC SPEC] ===== ${op.seq} ${op.label} =====\n${text.slice(0, 30000)}`);
}
