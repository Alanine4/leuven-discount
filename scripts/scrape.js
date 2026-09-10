// 跑所有 scraper，每家单独存一份原始结果。一家挂了不影响其他家。
import fs from 'node:fs';
import lidl from '../scrapers/lidl.js';
import colruyt from '../scrapers/colruyt.js';
import carrefour from '../scrapers/carrefour.js';
import ah from '../scrapers/ah.js';
import aldi from '../scrapers/aldi.js';

const SOURCES = { lidl, colruyt, carrefour, aldi };
const EXTRA = { ah };                              // 还没打通的店：不进默认清单，但能按名字单独跑
const only = process.argv[2];                     // node scripts/scrape.js lidl → 只跑一家
const pick = only ? { [only]: SOURCES[only] || EXTRA[only] } : SOURCES;

fs.mkdirSync('data/raw', { recursive: true });
const report = [];

for (const [name, fn] of Object.entries(pick)) {
  const t0 = Date.now();
  try {
    const rows = await fn();
    fs.writeFileSync(`data/raw/${name}.json`, JSON.stringify(rows, null, 1));
    report.push({ store: name, ok: true, count: rows.length, sec: ((Date.now() - t0) / 1000).toFixed(1) });
    console.log(`✓ ${name}: ${rows.length} 条 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    report.push({ store: name, ok: false, error: e.message });
    console.error(`✗ ${name}: ${e.message}`);
    if (e.html) {
      fs.mkdirSync('data/debug', { recursive: true });
      fs.writeFileSync(`data/debug/${name}-fail.html`, e.html);
      console.error(`  页面已存到 data/debug/${name}-fail.html`);
    }
  }
}

fs.writeFileSync('data/raw/_report.json', JSON.stringify({ at: new Date().toISOString(), report }, null, 1));
const failed = report.filter((r) => !r.ok);
if (failed.length === Object.keys(pick).length) { console.error('\n全部失败了'); process.exit(1); }
if (failed.length) console.warn(`\n${failed.length} 家失败，其余照常出页面`);
