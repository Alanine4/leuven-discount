// Carrefour：没有公开 JSON 接口，促销列表页是服务端渲染的。
// 裸 fetch 会被 403（TLS 指纹被识别），所以整个走 Playwright。
// robots 禁止 ?pmid= 和 /search?q=，所以只走 ?p=N 主列表。每页 40 张卡，其中 4 张是推荐位（.js-einstein-tile），排除后剩 36 条真商品。
// 鲁汶只有 Carrefour Market（Heverlee）和 Carrefour Express，没有大卖场，所以不抓全国促销目录，
// 改抓 Market / Express 各自的店型专用促销页（DOM 结构和全国目录完全一样）。同一商品可能在两个来源里都出现，
// 刻意保留两条（store 不同，dedupe() 按 store 去重不会合并），方便页面按店型筛选。
import * as cheerio from 'cheerio';
import { normalize, sleep } from '../lib/normalize.js';
import { fetchHTML, closeBrowser } from '../lib/browser.js';
import { toCatWithName } from '../lib/categorize.js';

const PER_PAGE = 36;
const SOURCES = [
  { slug: 'al-onze-market-promoties', store: 'Carrefour Market', storeZh: '家乐福 Market' },
  { slug: 'al-onze-express-promoties', store: 'Carrefour Express', storeZh: '家乐福 Express' },
];

const days = (endMs) => {
  if (!endMs) return '';
  const d = Math.ceil((endMs - Date.now()) / 864e5);
  return d > 0 ? `还剩 ${d} 天` : '即将结束';
};

// 顶部导航菜单里有 rosXXX 品类码 → 荷语品类名的映射，例如
// data-gtm-nav-cta="products:ros016>dranken"，每页都会带，不用单独取。
function buildCatMap($) {
  const map = new Map();
  $('[data-gtm-nav-cta]').each((_, el) => {
    const v = $(el).attr('data-gtm-nav-cta') || '';
    const m = v.match(/^products:(ros[\w]+)>(.+)$/i);
    if (m) map.set(m[1], m[2].trim());
  });
  return map;
}

export function parsePage(html, { store, storeZh }) {
  const $ = cheerio.load(html);
  const catMap = buildCatMap($);
  const cards = $('div.product.js-product[data-pid]')
    .filter((_, el) => $(el).find('.js-einstein-tile').length === 0);

  const out = [];
  cards.each((_, el) => {
    const $card = $(el);
    const id = $card.attr('data-pid') || '';
    const $tile = $card.find('.product-tile.js-product-tile').first();

    let gtmItem = {};
    try {
      const gtm = JSON.parse($tile.attr('data-select-item-event-object') || '');
      gtmItem = gtm?.ecommerce?.items?.[0] || {};
    } catch { /* GTM json 偶尔会缺，字段照常用页面 DOM 兜底 */ }

    // 页面偶尔把 UTF-8 当 Latin-1 输出（"PralinÃ©"），按字节还原
    const fixEnc = (t) => (/[ÃÂ][-¿]/.test(t) ? Buffer.from(t, 'latin1').toString('utf8') : t);
    const name = fixEnc($tile.find('.desktop-name').first().text().trim()
      || $tile.find('.mobile-name').first().text().trim()
      || gtmItem.item_name || '');
    if (!name) return;

    const priceAttr = $tile.find('.pricing-wrapper .value').first().attr('content');
    const pricePromo = priceAttr ? parseFloat(priceAttr) : (gtmItem.price ?? null);

    const validityText = $tile.find('.promo-validity-date').first().text().trim();
    const dm = validityText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const endsAt = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : null;
    const endMs = endsAt ? Date.parse(endsAt) : null;

    const href = $tile.find('.image-container a').first().attr('href')
      || $tile.find('.pdp-link a').first().attr('href') || '';
    const img = $tile.find('.tile-image').first();

    out.push({
      store, storeZh,
      name,
      brand: $tile.find('.brand-wrapper a').first().text().trim() || gtmItem.item_brand || '',
      priceOrig: null,                                            // 页面不给划线原价
      pricePromo,
      unitPrice: $tile.find('.price-per-unit-wrapper').first().text().trim(),
      discountText: $tile.find('.promo-label').first().text().trim()
        || $tile.find('.promo-tag-text').first().text().trim(),
      validity: days(endMs),
      endsAt,
      // 页面只给顶层品类（酒、咖啡都挂在 "Dranken" 下），细分靠商品名
      category: toCatWithName(catMap.get(gtmItem.item_category || '') || '', name),
      url: href.startsWith('http') ? href : `https://www.carrefour.be${href}`,
      image: img.attr('src') || img.attr('data-src') || '',
      id,
    });
  });
  return out;
}

export function totalCount(html) {
  const m = html.match(/data-total-items="([\d.]+)"/);
  return m ? parseInt(m[1], 10) : null;
}

export default async function scrapeCarrefour({ maxPages = 60 } = {}) {
  try {
    let rows = [];
    for (let i = 0; i < SOURCES.length; i++) {
      const src = SOURCES[i];
      const base = `https://www.carrefour.be/nl/${src.slug}`;
      const first = await fetchHTML(`${base}?p=1`);
      const total = totalCount(first);
      const pages = total ? Math.min(Math.ceil(total / PER_PAGE), maxPages) : maxPages;

      let got = parsePage(first, src);
      if (!got.length) {
        const e = new Error(`Carrefour（${src.store}）页面结构对不上，一个商品都没解析出来。跑 npm run inspect:carrefour 看看现在的 DOM。`);
        e.html = first;
        throw e;
      }
      console.log(`  ${src.store}: 共 ${total ?? '?'} 条 / ${pages} 页`);
      for (let p = 2; p <= pages; p++) {
        await sleep(1200);                        // 自觉限速
        const more = parsePage(await fetchHTML(`${base}?p=${p}`), src);
        if (!more.length) break;
        got = got.concat(more);
      }
      rows = rows.concat(got);
      if (i < SOURCES.length - 1) await sleep(1200);   // 来源之间也限速
    }
    return rows.map(normalize);
  } finally { await closeBrowser(); }
}
