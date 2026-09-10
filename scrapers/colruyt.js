// Colruyt：官方 API 有 Akamai 反爬（要 key + cookie + 代理池），不值得硬碰。
// 改用 BelgianNoise 每日 dump 的公开 GCS bucket，免鉴权、字段是官方接口原样透传。
import { normalize, get, sleep } from '../lib/normalize.js';
import { toCat } from '../lib/categorize.js';

const BUCKET = 'https://storage.googleapis.com/colruyt-products';
const PREFIX = 'colruyt-products';

/** bucket 里的 key 带目录前缀（如 colruyt-products/2026-09-09-12-50-03.json），
 *  列全部目录会被截断到 2000 条老数据，所以按"当月"前缀查，取时间戳最大的那个 dump；
 *  当月还没有 dump（比如月初）就退回上个月 */
async function latestDump() {
  const now = new Date();
  for (let back = 0; back < 2; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const xml = await get(`${BUCKET}/?prefix=${PREFIX}/${ym}&max-keys=100`);
    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1])
      .filter((k) => new RegExp(`^${PREFIX}/\\d{4}-\\d{2}-\\d{2}-[\\d-]+\\.json$`).test(k))
      .sort();
    if (keys.length) return keys[keys.length - 1];
  }
  throw new Error('Colruyt bucket 里没找到 dump 文件');
}

/** 详情接口给的是 "22-09-2026"（DD-MM-YYYY），转成 ISO 才能给 Date.parse 用 */
function toIsoDate(d) {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** "2de aan -50%" 这种文案接口不给，要从 benefit 拼出来 */
function benefitText(promo) {
  const b = promo?.benefit?.[0];
  if (!b) return '';
  const pctOff = b.benefitPercentage;
  const min = b.minLimit;
  if (pctOff && min > 1) return `${min}de aan -${pctOff}%`;
  if (pctOff) return `-${pctOff}%`;
  return '';
}

export default async function scrapeColruyt({ withPromoDetail = true } = {}) {
  const key = await latestDump();
  const all = await get(`${BUCKET}/${key}`, { json: true });
  const products = Array.isArray(all) ? all : (all.products || []);
  const onPromo = products.filter((p) => p.inPromo || p.promotion?.length);
  if (!onPromo.length) throw new Error('Colruyt dump 里没有促销商品，检查字段名是否变了');

  // 详情文件名用的是 techPromoId（如 "102715COLR"），不是 promotion[].promotionId 那个纯数字
  const detail = new Map();
  if (withPromoDetail) {
    const ids = [...new Set(onPromo.flatMap((p) => (p.promotion || []).map((x) => x.techPromoId)).filter(Boolean))];
    for (const id of ids.slice(0, 400)) {
      try { detail.set(id, await get(`${BUCKET}/promotions/${id}.json`, { json: true, retries: 1 })); }
      catch { /* 单个促销详情拿不到不影响整体 */ }
      await sleep(40);
    }
  }

  return onPromo.map((p) => {
    const pr = p.price || {};
    const promo = p.promotion?.[0] || {};
    const det = detail.get(promo.techPromoId) || promo;
    const end = toIsoDate(det.activeEndDate) || toIsoDate(promo.publicationEndDate);
    const left = end ? Math.ceil((Date.parse(end) - Date.now()) / 864e5) : null;
    return normalize({
      store: 'Colruyt', storeZh: '大仓库',
      name: p.LongName || p.name || p.ShortName,
      brand: p.brand || '',
      priceOrig: null,                    // dump 不给划线原价，折扣力度靠 benefit 文案
      pricePromo: pr.basicPrice ?? null,
      unitPrice: pr.measurementUnitPrice ? `${pr.measurementUnitPrice}/${pr.measurementUnit || ''}` : '',
      discountText: benefitText(det),
      validity: left > 0 ? `还剩 ${left} 天` : (end ? '即将结束' : ''),
      endsAt: end,
      category: toCat(p.topCategoryName || ''),
      image: p.squareImage || p.fullImage || '',
      id: String(p.productId || p.commercialArticleNumber || ''),
    });
  });
}
