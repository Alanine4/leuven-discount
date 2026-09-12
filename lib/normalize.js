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

  const mNth  = d.match(/(\d{1,2})\s*(?:de|e|ste|ème|eme)\s*(?:aan|tegen|à|a|pour)?\s*-?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/);
  const mFree = d.match(/(\d{1,2})\s*\+\s*(\d{1,2})\s*(?:gratis|gratuit)/);
  const mPct  = d.match(/-\s*(\d{1,2}(?:[.,]\d+)?)\s*%/);
  const mVoorX     = d.match(/(\d+)\s*voor\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur)/);           // "3 voor 6€"
  const mEuroVoorN = d.match(/-\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur)\s*voor\s*(\d+)/);       // "-1€ voor 2"
  const mEuro      = d.match(/-\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur)/);                      // "-1€"

  if (mNth) {                       // "2de aan -50%" → 只有第 N 件打折
    const n = +mNth[1], off = parseFloat(mNth[2].replace(",", "."));
    pct = n ? Math.round(off / n) : null;
    multibuy = true;
  } else if (mFree) {               // "2+2 gratis" → 免费件数 / 总件数
    const buy = +mFree[1], free = +mFree[2];
    pct = buy + free ? Math.round((free / (buy + free)) * 100) : null;
    multibuy = true;
  } else if (mPct) {                // "-30%"，若带 "voor/bij/vanaf N" 说明要买够 N 件才享受
    pct = Math.round(parseFloat(mPct[1].replace(",", ".")));
    if (/(voor|bij|vanaf)\s*\d+/.test(d)) multibuy = true;
  } else if (mVoorX) {               // "3 voor 6€" → 每件实付价 vs 单件挂牌价
    const n = +mVoorX[1], total = parseFloat(mVoorX[2].replace(",", "."));
    multibuy = true;
    if (n && pricePromo) {
      const raw = 1 - (total / n) / pricePromo;
      pct = raw > 0 ? Math.round(raw * 100) : null;
      if (pct >= 60) uncertain = true;   // "8 voor 4.99€" 标在 4 件装上时，N 指的是单瓶不是整包
    }
  } else if (mEuroVoorN) {           // "-1€ voor 2" → 买够 N 件才减 X 欧
    const x = parseFloat(mEuroVoorN[1].replace(",", ".")), n = +mEuroVoorN[2];
    multibuy = true;
    if (pricePromo && n) pct = Math.round((x / (n * pricePromo)) * 100);
  } else if (mEuro) {                // "-1€" → 单件直减 X 欧
    const x = parseFloat(mEuro[1].replace(",", "."));
    if (pricePromo && x < pricePromo) {
      pct = Math.round((x / pricePromo) * 100);
      if (pct >= 60) uncertain = true;   // 直减额接近单价，多半是整箱价
    } else if (pricePromo) {
      uncertain = true;              // 减免额 ≥ 单件价，算不出合理折扣
    }
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
