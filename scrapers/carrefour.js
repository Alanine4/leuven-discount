// Carrefour：没有公开 JSON 接口，但促销列表页是服务端渲染的，cheerio 直接解析。
// robots 禁止 ?pmid= 和 /search?q=，所以只走 ?p=N 主列表。每页 36 条。
// 注意：这是全国线上促销目录，分不出 Market / Express 店型，拿到的是超集。
import * as cheerio from 'cheerio';
import { normalize, get } from '../lib/normalize.js';
import { toCat } from '../lib/categorize.js';

const BASE = 'https://www.carrefour.be/nl/al-onze-promoties';
const PER_PAGE = 36;

const price = (t) => {
  const m = String(t || '').match(/(\d+)[.,](\d{2})/);
  return m ? parseFloat(`${m[1]}.${m[2]}`) : null;
};

/** 页面结构会改，所以每个字段都给几个候选选择器，取第一个有内容的 */
const pick = ($el, sels) => {
  for (const s of sels) { const t = $el.find(s).first().text().trim(); if (t) return t; }
  return '';
};

export function parsePage(html) {
  const $ = cheerio.load(html);
  const tiles = $('[data-product-id], .product-tile, .product-item, li.grid-tile, .js-product');
  const out = [];
  tiles.each((_, el) => {
    const $t = $(el);
    const name = pick($t, ['.product-name', '.tile-name', '[class*="name"] a', 'h2', 'h3', 'a[title]']);
    if (!name) return;
    const promoLabel = pick($t, ['.promo-label', '.badge', '[class*="promo"]', '[class*="discount"]']);
    const priceTxt   = pick($t, ['.product-price', '.price', '[class*="price"]']);
    const unitTxt    = pick($t, ['.unit-price', '[class*="unit"]', '[class*="per-"]']);
    const validTxt   = pick($t, ['[class*="valid"]', '[class*="until"]', '[class*="date"]']);
    out.push({
      store: 'Carrefour', storeZh: '家乐福',
      name,
      brand: pick($t, ['.product-brand', '[class*="brand"]']),
      priceOrig: null,
      pricePromo: price(priceTxt),
      unitPrice: unitTxt,
      discountText: promoLabel,
      validity: validTxt,
      category: toCat(pick($t, ['[class*="categ"]', '[class*="rayon"]'])),
      url: (($t.find('a[href]').attr('href') || '').startsWith('http') ? '' : 'https://www.carrefour.be') + ($t.find('a[href]').attr('href') || ''),
      image: $t.find('img').attr('src') || $t.find('img').attr('data-src') || '',
      id: $t.attr('data-product-id') || '',
    });
  });
  return out;
}

export function totalCount(html) {
  const m = html.match(/([\d.\s]+)\s*(?:producten|produits|resultaten|résultats)/i);
  return m ? parseInt(m[1].replace(/[.\s]/g, ''), 10) : null;
}

export default async function scrapeCarrefour({ maxPages = 60 } = {}) {
  const first = await get(`${BASE}?p=1`);
  const total = totalCount(first);
  const pages = total ? Math.min(Math.ceil(total / PER_PAGE), maxPages) : maxPages;

  let rows = parsePage(first);
  if (!rows.length) {
    const e = new Error('Carrefour 页面结构对不上，一个商品都没解析出来。跑 npm run inspect:carrefour 看看现在的 DOM。');
    e.html = first;
    throw e;
  }
  for (let p = 2; p <= pages; p++) {
    const html = await get(`${BASE}?p=${p}`, { delay: 2000 });   // 自觉限速
    const got = parsePage(html);
    if (!got.length) break;
    rows = rows.concat(got);
  }
  return rows.map(normalize);
}
