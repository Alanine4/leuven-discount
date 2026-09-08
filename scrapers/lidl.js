// Lidl：官网内部搜索接口，免鉴权。store=1 = 本周店内促销。
// robots 禁止 offset= / sort= / q= / id= 参数，所以只用 fetchsize 一次拉完，排序在本地做。
import { normalize, get } from '../lib/normalize.js';
import { toCat } from '../lib/categorize.js';

const API = 'https://www.lidl.be/q/api/search?assortment=BE&locale=nl_BE&version=2.0.0&fetchsize=1000&store=1';

const days = (endMs) => {
  if (!endMs) return '';
  const d = Math.ceil((endMs - Date.now()) / 864e5);
  return d > 0 ? `还剩 ${d} 天` : '即将结束';
};

export default async function scrapeLidl() {
  const j = await get(API, { json: true, headers: { Accept: 'application/json' } });
  const items = (j.items || []).map((it) => it.gridbox?.data).filter(Boolean);
  if (!items.length) throw new Error('Lidl 接口没返回商品，可能是参数或字段变了');

  return items.map((d) => {
    const p = d.price || {};
    const disc = p.discount || {};
    const endMs = d.storeEndDate ? d.storeEndDate * 1000 : (p.endDate ? Date.parse(p.endDate) : null);
    return normalize({
      store: 'Lidl', storeZh: 'Lidl',
      name: d.fullTitle || d.title,
      brand: d.brand?.name || '',
      priceOrig: p.oldPrice ?? p.recommendedPrice ?? disc.deletedPrice ?? null,
      pricePromo: p.price ?? null,
      discountText: disc.percentageDiscount ? `-${disc.percentageDiscount}%` : (disc.bargainHintText || ''),
      validity: days(endMs),
      endsAt: endMs ? new Date(endMs).toISOString().slice(0, 10) : null,
      category: toCat(d.category || d.keyfacts?.wonCategoryPrimary || ''),
      url: d.canonicalUrl ? `https://www.lidl.be${d.canonicalUrl}` : '',
      image: d.image || '',
      id: String(d.productId || d.erpNumber || ''),
    });
  });
}
