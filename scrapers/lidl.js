// Lidl：官网内部搜索接口，免鉴权。store=1 = 本周店内促销。
// robots 禁止 offset= / sort= / q= / id= 参数，所以不能翻页；服务端还把单次 fetchsize 封顶在 108。
// 解决办法：用响应里的 category facet 按品类切分请求，各品类分别拉，按 productId 去重合并。
import { normalize, get, sleep } from '../lib/normalize.js';
import { toCat } from '../lib/categorize.js';

const BASE = 'https://www.lidl.be/q/api/search?assortment=BE&locale=nl_BE&version=2.0.0&fetchsize=1000&store=1';
const MAX_DEPTH = 3;

const days = (endMs) => {
  if (!endMs) return '';
  const d = Math.ceil((endMs - Date.now()) / 864e5);
  return d > 0 ? `还剩 ${d} 天` : '即将结束';
};

// category facet：未筛选时用顶层 values 切分；已筛选某个品类时，该品类的 selected 项下的
// children 是下一级子品类，用它继续切分。
function categorySplits(facets) {
  const facet = (facets || []).find((f) => f.code === 'category');
  if (!facet) return null;
  const values = facet.values || facet.topvalues || [];
  const selected = values.find((v) => v.selected);
  if (selected) return selected.children && selected.children.length ? selected.children : null;
  return values.length ? values : null;
}

// 没有品类可再切时，退回价格区间 facet 切分。
function priceSplits(facets) {
  const facet = (facets || []).find((f) => f.code === 'price');
  const values = facet?.values || facet?.topvalues || [];
  return values.length ? values : null;
}

async function fetchAndCollect(url, depth, collected) {
  const j = await get(url, { json: true, headers: { Accept: '*/*' } });
  for (const it of j.items || []) {
    const d = it.gridbox?.data;
    const id = d && String(d.productId || d.erpNumber || '');
    if (id) collected.set(id, d);
  }
  const got = (j.items || []).length;
  const numFound = j.numFound || 0;
  if (got < numFound && depth < MAX_DEPTH) {
    const splits = categorySplits(j.facets) || priceSplits(j.facets);
    for (const s of splits || []) {
      if (!s.url) continue;
      await sleep(800);
      const childUrl = `https://www.lidl.be${s.url}${s.url.includes('fetchsize=') ? '' : '&fetchsize=1000'}`;
      await fetchAndCollect(childUrl, depth + 1, collected);
    }
  }
}

export default async function scrapeLidl() {
  const collected = new Map();
  await fetchAndCollect(BASE, 0, collected);
  const items = [...collected.values()];
  if (items.length < 100) throw new Error(`Lidl 只拿到 ${items.length} 条，接口可能改版了`);

  return items.map((d) => {
    const p = d.price || {};
    const disc = p.discount || {};
    const strike = p.oldPrice ?? p.recommendedPrice ?? disc.deletedPrice ?? null;   // Lidl 自己标的划线价
    // p.endDate 是促销价的结束时刻（"2026-09-15T22:00Z" = 布鲁塞尔 16 日 0 点，所以 UTC 切片得到的
    // 09-15 就是最后一个能按促销价买到的日子）；storeEndDate 是商品彻底下架日，往往晚一周，只当兜底。
    const endMs = p.endDate ? Date.parse(p.endDate) : (d.storeEndDate ? d.storeEndDate * 1000 : null);
    return normalize({
      store: 'Lidl', storeZh: 'Lidl',
      name: d.fullTitle || d.title,
      brand: d.brand?.name || '',
      priceOrig: strike,
      pricePromo: p.price ?? null,
      // Lidl 的 oldPrice 是真实单件划线价，接口偶尔不给百分比（只给 "Megadeal" 标签），这时按价格比算，不走存疑逻辑
      discountText: disc.percentageDiscount ? `-${disc.percentageDiscount}%`
        : (strike && p.price && strike > p.price) ? `-${Math.round((1 - p.price / strike) * 100)}%`
        : (disc.bargainHintText || ''),
      validity: days(endMs),
      endsAt: endMs ? new Date(endMs).toISOString().slice(0, 10) : null,
      // category 字段常是营销专题名（"Superweekend"/"Actie op is op "之类），wonCategoryPrimary
      // 是稳定的品类树路径（每条都有），归类更准，优先用它。
      category: toCat(d.keyfacts?.wonCategoryPrimary || d.category || ''),
      url: d.canonicalUrl ? `https://www.lidl.be${d.canonicalUrl}` : '',
      image: d.image || '',
      id: String(d.productId || d.erpNumber || ''),
    });
  });
}
