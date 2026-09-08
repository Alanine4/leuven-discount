// 一次性工具：把 Carrefour 促销页的真实 DOM 摸出来，用来校准选择器。
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import { get } from '../lib/normalize.js';

const html = await get('https://www.carrefour.be/nl/al-onze-promoties?p=1');
fs.mkdirSync('data/debug', { recursive: true });
fs.writeFileSync('data/debug/carrefour-p1.html', html);

const $ = cheerio.load(html);
const counts = {};
$('[class]').each((_, el) => {
  for (const c of ($(el).attr('class') || '').split(/\s+/)) {
    if (c) counts[c] = (counts[c] || 0) + 1;
  }
});
console.log('HTML 大小:', (html.length / 1024).toFixed(0), 'KB');
console.log('\n出现 20~60 次的 class（商品卡片一般落在这个区间，每页 36 个商品）:');
Object.entries(counts).filter(([, n]) => n >= 20 && n <= 60)
  .sort((a, b) => b[1] - a[1]).slice(0, 40)
  .forEach(([c, n]) => console.log(`  ${String(n).padStart(3)}  .${c}`));

const guess = Object.entries(counts).filter(([, n]) => n >= 30 && n <= 40).sort((a, b) => b[1] - a[1])[0];
if (guess) {
  console.log(`\n最像商品卡片的是 .${guess[0]}（${guess[1]} 个），第一个的 HTML：\n`);
  console.log($(`.${guess[0]}`).first().toString().slice(0, 2500));
}
console.log('\n完整 HTML 已存到 data/debug/carrefour-p1.html');
