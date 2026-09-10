// 摸清 ah.be 的促销接口：打开 bonus 页，把页面自己调的接口全打出来。
import { sniff, closeBrowser } from '../lib/browser.js';

for (const page of ['https://www.ah.be/bonus', 'https://www.ah.be/producten?Bonus=true']) {
  console.log(`\n===== ${page} =====`);
  const hits = await sniff(page);
  if (!hits.length) { console.log('  没抓到 XHR，页面可能是纯 SSR 或接口名对不上 match 规则'); continue; }
  for (const h of hits) {
    console.log(`\n[${h.status}] ${h.method} ${h.url}`);
    if (h.keys) console.log(`  顶层字段: ${h.keys}  (${h.bytes} 字节)`);
    if (h.preview) console.log(`  ${h.preview.replace(/\s+/g, ' ').slice(0, 240)}`);
  }
}
await closeBrowser();
console.log('\n把上面带 200 且顶层字段里有 products/cards/items 的那条发给 Claude。');
