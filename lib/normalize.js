// 统一各家超市的数据格式 + 折扣力度计算

export const CATS = ['粮油面食','肉禽蛋','海鲜','乳制品奶酪','果蔬','面包烘焙','零食甜点','饮料',
  '酒类','冷冻速食','调味酱料','咖啡茶','个护美妆','家清日用','母婴','宠物','家电数码','服饰家居','其他'];

/**
 * 折扣力度：促销文案优先于价格比。
 * 传单里的"原价"常常是整组价（"第二件半价"标的是两件总价），
 * 直接相除会把 25% 的优惠算成 60%，所以文案能解析就以文案为准。
 */
export function effectiveDiscount({ priceOrig, pricePromo, discountText }) {
  const d = String(discountText || '').toLowerCase().replace('−', '-');
  let pct = null, multibuy = false, uncertain = false;

  const mNth  = d.match(/(\d)\s*(?:de|e|ste|ème|eme)\s*(?:aan|tegen|à|a|pour)?\s*-?\s*(\d{1,2})\s*%/);
  const mFree = d.match(/(\d)\s*\+\s*(\d)\s*(?:gratis|gratuit)/);
  const mPct  = d.match(/-\s*(\d{1,2})\s*%/);

  if (mNth) {                       // "2de aan -50%" → 只有第 N 件打折
    const n = +mNth[1], off = +mNth[2];
    pct = n ? Math.round(off / n) : null;
    multibuy = true;
  } else if (mFree) {               // "2+2 gratis" → 免费件数 / 总件数
    const buy = +mFree[1], free = +mFree[2];
    pct = buy + free ? Math.round((free / (buy + free)) * 100) : null;
    multibuy = true;
  } else if (mPct) {                // "-30%"
    pct = +mPct[1];
  } else if (priceOrig && pricePromo && priceOrig > pricePromo) {
    pct = Math.round((1 - pricePromo / priceOrig) * 100);
    if (pct >= 60) uncertain = true;  // 无文案佐证的深折，多半是整组价除单价
  }
  if (priceOrig && pricePromo && Math.abs(priceOrig - pricePromo) < 0.005) pct = 0;
  if (pct !== null && (pct < 0 || pct > 95)) { pct = null; uncertain = true; }
  return { pct, multibuy, uncertain };
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** 各 scraper 输出的原始记录 → 统一 schema */
export function normalize(raw) {
  const po = num(raw.priceOrig), pp = num(raw.pricePromo);
  const { pct, multibuy, uncertain } = effectiveDiscount({ priceOrig: po, pricePromo: pp, discountText: raw.discountText });
  const name = (raw.name || '').trim();
  return {
    store: raw.store,
    store_zh: raw.storeZh || raw.store,
    name,
    name_zh: (raw.nameZh || '').trim() || name,   // 中文名在 build 阶段用词表补
    brand: (raw.brand || '').trim(),
    po, pp,
    unit: (raw.unitPrice || '').trim(),           // 每公斤/每升价，官方接口才有
    dt: (raw.discountText || '').trim(),
    pct, mb: multibuy ? 1 : 0, unc: uncertain ? 1 : 0,
    val: (raw.validity || '').trim(),
    ends: raw.endsAt || null,                     // ISO 日期，方便算"还剩几天"
    cat: CATS.includes(raw.category) ? raw.category : '其他',
    url: raw.url || '',
    img: raw.image || '',
    id: raw.id || '',
  };
}

export function dedupe(items) {
  const seen = new Set();
  return items.filter((i) => {
    const k = [i.store, (i.name_zh || i.name).toLowerCase().trim(), i.po, i.pp].join('|');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** 带重试和限速的 fetch，所有 scraper 共用 */
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function get(url, { headers = {}, json = false, retries = 3, delay = 0 } = {}) {
  if (delay) await sleep(delay);
  for (let a = 1; a <= retries; a++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'nl-BE,nl;q=0.9', ...headers },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json ? await res.json() : await res.text();
    } catch (e) {
      if (a === retries) throw new Error(`${url} 取不到：${e.message}`);
      await sleep(1500 * a);
    }
  }
}
