// 合并 → 补中文名 → 出静态页面
import fs from 'node:fs';
import { dedupe } from '../lib/normalize.js';

const glossary = JSON.parse(fs.readFileSync('lib/glossary.json', 'utf8'));
const raw = fs.readdirSync('data/raw').filter((f) => f.endsWith('.json') && !f.startsWith('_'));
let items = raw.flatMap((f) => JSON.parse(fs.readFileSync(`data/raw/${f}`, 'utf8')));

const missing = new Set();
items = items.map((i) => {
  const zh = glossary[i.name.toLowerCase().trim()];
  if (!zh) missing.add(i.name);
  return {
    ...i,
    name_zh: zh || i.name,
    // 搜索索引：原名 + 中文名 + 品牌 + 品类。中文查询由页面的同义词表翻成荷兰语后匹配原名，
    // 所以就算没有中文译名，搜「意面」照样能命中 pasta。
    q: `${i.name} ${zh || ''} ${i.brand} ${i.cat}`.toLowerCase(),
  };
});

items = dedupe(items);
items.sort((a, b) => {
  const rank = (x) => (x.pct || 0) - (x.unc ? 12 : 0);
  return rank(b) - rank(a) || (a.pp ?? 1e9) - (b.pp ?? 1e9);
});

const tally = (key) => items.reduce((m, i) => ((m[i[key]] = (m[i[key]] || 0) + 1), m), {});
const meta = {
  updated: new Date().toISOString().slice(0, 10),
  total: items.length,
  stores: tally('store_zh'),
  cats: tally('cat'),
  with_pct: items.filter((i) => i.pct).length,
};
const payload = { meta, items };

fs.mkdirSync('public', { recursive: true });
fs.mkdirSync('data/history', { recursive: true });
fs.writeFileSync('data/latest.json', JSON.stringify(payload));
fs.writeFileSync(`data/history/${meta.updated}.json`, JSON.stringify(payload));
fs.writeFileSync('data/untranslated.json', JSON.stringify([...missing].sort(), null, 1));

const tpl = fs.readFileSync('web/template.html', 'utf8');
fs.writeFileSync('public/index.html', tpl.replace('/*__DATA__*/', JSON.stringify(payload)));

console.log(`共 ${meta.total} 条 | 有折扣力度 ${meta.with_pct} 条 | 待翻译 ${missing.size} 个商品名`);
console.log('各店：', Object.entries(meta.stores).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('→ public/index.html');
