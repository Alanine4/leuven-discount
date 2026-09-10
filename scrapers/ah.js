// Albert Heijn 比利时（鲁汶 Bondgenotenlaan 64，门店号 3164）
// 注意：ah.be 和 ah.nl 是两套独立定价（同一商品 wi123：BE €2.29 / NL €1.99），
// 所以荷兰那些现成的 api.ah.nl 封装对鲁汶没用，必须走 BE 站点。
// /zoeken/api/ 是 robots 明确允许的，但要带对 header，否则 500。
import { normalize, get } from '../lib/normalize.js';
import { toCat } from '../lib/categorize.js';

const H = {
  'x-application': 'AHWEBSHOP',
  Accept: 'application/json',
  Referer: 'https://www.ah.be/producten',
};

// 几种可能的接口形态，按顺序试，哪个通用哪个
const CANDIDATES = [
  'https://www.ah.be/zoeken/api/products/search?query=&page=0&size=1000&sortOn=RELEVANCE&properties=bonus',
  'https://www.ah.be/zoeken/api/products/search?query=&page=0&size=1000&sortOn=RELEVANCE',
  'https://www.ah.be/producten/api/products?bonus=true&page=0&size=1000',
];

function toRows(json) {
  const cards = json?.cards || json?.products || json?.items || [];
  const products = cards.flatMap((c) => c.products || c.product || c).filter(Boolean);
  return products
    .filter((p) => p.discount || p.isPromo || p.priceBeforeBonus)
    .map((p) => {
      const price = p.price || {};
      return normalize({
        store: 'Albert Heijn', storeZh: 'AH',
        name: p.title || p.name,
        brand: p.brand || '',
        priceOrig: p.priceBeforeBonus ?? price.was ?? price.regular ?? null,
        pricePromo: price.now ?? p.currentPrice ?? price.current ?? null,
        unitPrice: p.unitPriceDescription || price.unitSize || '',
        discountText: p.discount?.bonusType || p.discount?.theme || p.promoLabel || '',
        validity: '', endsAt: p.bonusEndDate || null,
        category: toCat((p.taxonomies || []).map((t) => t.name).join(' ') || p.category || ''),
        url: p.link ? `https://www.ah.be${p.link}` : '',
        image: p.images?.[0]?.url || '',
        id: String(p.webshopId || p.hqId || p.id || ''),
      });
    });
}

export default async function scrapeAH() {
  const errs = [];
  for (const url of CANDIDATES) {
    try {
      const json = await get(url, { json: true, headers: H, retries: 1 });
      const rows = toRows(json);
      if (rows.length) { console.log(`  AH 走通的是: ${url}`); return rows; }
      errs.push(`${url} → 200 但没解析出促销商品`);
    } catch (e) { errs.push(`${url} → ${e.message}`); }
  }
  throw new Error(`AH 所有候选接口都没通，跑 node scripts/inspect-ah.js 抓一下真实接口：\n    ${errs.join('\n    ')}`);
}
