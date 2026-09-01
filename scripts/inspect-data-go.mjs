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

const pkMatch =
  page.match(/name=["']publicDataDetailPk["'][^>]*value=["']([^"']+)/is) ||
  page.match(/value=["']([^"']+)["'][^>]*name=["']publicDataDetailPk["']/is);
if (!pkMatch) throw new Error('publicDataDetailPk not found');
const detailPk = decode(pkMatch[1]);

const selectMatch = page.match(/<select[^>]*id=["']open_api_detail_select["'][^>]*>([\s\S]*?)<\/select>/i);
if (!selectMatch) throw new Error('operation select not found');
const options = [...selectMatch[1].matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi)]
  .map(([, seq, label]) => ({
    seq: decode(seq).trim(),
    label: decode(label.replace(/<[^>]+>/g, '')).trim(),
  }))
  .filter((x) => x.seq);

console.log('[KAC SPEC] publicDataDetailPk', detailPk);
console.log('[KAC SPEC] operations', JSON.stringify(options));

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
  const html = await res.text();
  const text = decode(
    html
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
