// Delhaize 比利时（鲁汶 AD Delhaize Brusselsestraat 31 + Delhaize Heverlee）
//
// 为什么非得有头浏览器：delhaize.be 和 ah.be 一样挂 Akamai Bot Manager
// （响应里发 bm_sz / _abck / ak_bmsc / bm_sv 这几个 cookie），裸 curl 打 /api/v1/* 一律 403，
// 连不存在的路径也 403。有头浏览器打开页面后，在 page.evaluate 里同源 fetch 就是 200，
// 和 AH 那套完全一样。CI 里要用 xvfb 包一层，见 .github/workflows/refresh.yml。
//
// 接口：GET https://www.delhaize.be/api/v1/?operationName=ProductList
//       &variables={...productListingType:"PROMOTION_SEARCH"...}
//       &extensions={"persistedQuery":{"version":1,"sha256Hash":"..."}}
// 这是 Apollo 的 persisted query（服务端只认注册过的查询哈希，发不了自定义 query），
// 哈希跟前端构建版本绑定，所以每次跑都先从促销页自己发的那个请求里现读，读不到才退回硬编码。
//
// 两个必须带的东西：
//   1. `x-apollo-operation-name: ProductList` —— 不带会被 Apollo 的 CSRF 拦截（400）
//   2. 页面的 cookie（`credentials:'include'` 自带）—— Akamai 那几个 cookie 在里面
//
// robots 红线：禁 `*/search/*` 和 `*/search?*`。这里走的是 `/api/v1/?operationName=...`，
// 路径里没有 search 段，不碰红线；也不走任何 /nl/shop 的筛选 URL。
//
// 服务端把 lazyLoadCount 封顶在 48（60、100、200、500 都返回 500 BAD_USER_INPUT），
// 本周 1358 条 = 29 页，比交接文档里写的"总请求 ≤ 15"多，这是服务端上限决定的，改不了。
// 页与页之间 sleep 1600ms，跟 Carrefour 那套限速一个量级。
import fs from 'node:fs';
import { normalize, sleep } from '../lib/normalize.js';
import { toCatWithName } from '../lib/categorize.js';
import { headedPage, closeBrowser } from '../lib/browser.js';

const PROMO_PAGE = 'https://www.delhaize.be/nl/Promolandingpage';
const PAGE_SIZE = 48;                       // 服务端上限
const GAP_MS = 1600;

// 2026-09-12 实测的哈希，只在页面里读不到时兜底
const FALLBACK_HASH = 'ef54fc2d8da4a9ad4987b2fb18f61c59f341d018be0f4670b0c9c7dabff07e5c';

// 促销页自己发的那份 variables，原样照抄
const VARIABLES = (pageNumber) => ({
  productListingType: 'PROMOTION_SEARCH', lang: 'nl', productCodes: '', categoryCode: '',
  excludedProductCodes: '', brands: '', keywords: '', productTypes: '',
  lazyLoadCount: PAGE_SIZE, pageNumber, sort: 'categoryOrder', searchQuery: '',
  hideProductsWithoutPromo: false, hideUnavailableProducts: true, maxItemsToDisplay: 0,
  includePotentialActivatableOffers: true, customerSegment: 'newPromoPageSegment',
});

const ymd = (d) => d.toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 864e5);

/** "16/09/2026 21:59:00" → "2026-09-16"。接口给的是 UTC，21:59Z 正好是布鲁塞尔当天 23:59 */
export function dmyToIso(s) {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const euro = (s) => {
  const m = String(s ?? '').match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
};

/**
 * 促销文案 → effectiveDiscount() 认识的写法。
 * Delhaize 的 `pp` 是货架单件价（多件促销时 discountedPrice 等于货架价，不打折），
 * 和 Carrefour 一个语义，所以 "N voor X€" 那条规则（每件实付 vs 单件价）套得上。
 */
export function promoText(promo) {
  let s = (promo?.description || promo?.simplePromotionMessage || promo?.title || '').trim();
  if (!s) return '';
  s = s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  // "3 producten voor €5" / "2 stuks voor €3,50" → "3 voor 5€"（€ 要在数字后面才吃得到 mVoorX）
  s = s.replace(/(\d+)\s*(?:producten?|stuks?|artikelen?)?\s*voor\s*€\s*(\d+(?:[.,]\d+)?)/i, '$1 voor $2€');
  // "€1 korting" → "-1€"；"- €6" / "- €6 voor 2" → "-6€" / "-6€ voor 2"（€ 要挪到数字后面）
  s = s.replace(/€\s*(\d+(?:[.,]\d+)?)\s*korting/i, '-$1€');
  s = s.replace(/-\s*€\s*(\d+(?:[.,]\d+)?)/, '-$1€');
  return s;
}

/**
 * Delhaize 的 "Zoete/Zoute kruidenierswaren"（甜/咸杂货）是个大杂烩标签，不是品类：
 * 巧克力、薯片、意面、酱料全在里面。而且 kruidenier（杂货商）会被 toCat() 的
 * kruid（香料）关键词、zoute 会被 zout（盐）关键词撞上，直接归成"调味酱料/粮油面食"。
 * 这两个顶层名一律当作没有分类，交给 toCatWithName() 用商品名判断。
 */
function topCategory(name) {
  const s = String(name || '');
  return /kruidenierswaren/i.test(s) ? '' : s;
}

function validityText(startIso, endIso, today) {
  if (startIso && startIso > today) return `${startIso.slice(5, 7)}/${startIso.slice(8, 10)} 起`;
  if (!endIso) return '';
  const left = dayDiff(endIso, today);
  if (left < 0) return '已结束';
  if (left === 0) return '最后一天';
  return left > 30 ? '长期促销' : `还剩 ${left} 天`;
}

/** 接口的 products[] → normalize() 前的原始记录 */
export function toRows(products, today = ymd(new Date())) {
  const rows = [];
  for (const p of products || []) {
    const promo = (p.potentialPromotions || []).find((x) => x && x.toDisplay !== false)
      || (p.potentialPromotions || [])[0] || null;
    const price = p.price || {};
    const shelf = typeof price.value === 'number' ? price.value : euro(price.formattedValue);
    const disc = euro(price.discountedPriceFormatted) ?? shelf;
    const was = typeof price.wasPrice?.value === 'number' ? price.wasPrice.value : null;

    // 直接打折时 discountedPrice 是折后单价；多件促销（1+1、2de tegen -50%）时它等于货架价，
    // 这种情况不填 po —— 填了会被 normalize() 里"po 约等于 pp 就判 0%"那条规则清零。
    let po = null, pp = shelf;
    if (was && shelf && was > shelf + 0.005) { po = was; pp = shelf; }
    else if (shelf && disc && disc < shelf - 0.005) { po = shelf; pp = disc; }

    const dt = promoText(promo);
    if (!dt && !po) continue;                     // 既没促销文案又没降价，不是促销
    // "3=gratis levering" 是网购免运费，不是商品折扣，对走进鲁汶门店的人没用（AH 那边同样处理）
    if (/gratis levering|leveringskorting/i.test(dt)) continue;

    let name = String(p.name || '').replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const size = String(price.supplementaryPriceLabel2 || '').trim();
    if (size && !name.toLowerCase().includes(size.toLowerCase())) name += ` ${size}`;

    const endsAt = dmyToIso(promo?.endDate);
    const img = (p.images || []).find((i) => i.format === 'small' || i.format === 'respListGrid')?.url
      || (p.images || [])[0]?.url || '';

    rows.push({
      store: 'Delhaize', storeZh: '大黑狮',
      name,
      brand: (p.manufacturerName || '').trim(),
      priceOrig: po, pricePromo: pp,
      unitPrice: String(price.supplementaryPriceLabel1 || '').trim(),
      discountText: dt,
      validity: validityText(dmyToIso(promo?.startDate), endsAt, today),
      endsAt,
      category: toCatWithName(topCategory(p.firstLevelCategory?.name), name),
      url: p.url ? `https://www.delhaize.be${p.url}` : '',
      image: img ? `https://www.delhaize.be${img}` : '',
      id: String(p.code || ''),
    });
  }
  return rows;
}

export default async function scrapeDelhaize({ maxPages = 40 } = {}) {
  try { return await run(maxPages); } finally { await closeBrowser(); }
}

/**
 * 促销页首屏自己就会发一次 ProductList，从那个请求里现读 persistedQuery 哈希
 * （哈希跟前端构建版本绑定，硬编码迟早过期）。监听必须赶在 goto 之前挂上。
 */
function hashSniffer() {
  const state = { hash: null, seen: 0 };
  state.attach = (page) => page.on('request', (req) => {
    const u = req.url();
    if (!u.includes('/api/v1/')) return;
    state.seen++;
    if (state.hash || !u.includes('operationName=ProductList')) return;
    try { state.hash = JSON.parse(new URL(u).searchParams.get('extensions')).persistedQuery.sha256Hash; } catch {}
  });
  return state;
}

async function run(maxPages) {
  const today = ymd(new Date());
  const sniffer = hashSniffer();
  const raw = await headedPage(PROMO_PAGE, async (page, res) => {
    const status = res?.status();
    if (status !== 200) {
      throw new Error(`Delhaize 促销页返回 ${status}（Akamai 挡的）—— 确认跑的是有头浏览器，CI 里要 xvfb-run 包一层`);
    }
    for (let i = 0; i < 20 && !sniffer.hash; i++) await page.waitForTimeout(1000);
    const hash = sniffer.hash || FALLBACK_HASH;
    console.log(`  persistedQuery hash: ${hash.slice(0, 12)}…${sniffer.hash ? '（页面里现读的）' : `（页面 ${sniffer.seen} 个 api/v1 请求里没读到，用的兜底值）`}`);

    const call = (pageNumber) => page.evaluate(async ([vars, h]) => {
      const u = new URL('https://www.delhaize.be/api/v1/');
      u.searchParams.set('operationName', 'ProductList');
      u.searchParams.set('variables', JSON.stringify(vars));
      u.searchParams.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: h } }));
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 60000);
      try {
        const r = await fetch(u.toString(), {
          credentials: 'include',
          signal: ac.signal,
          headers: { 'x-apollo-operation-name': 'ProductList', 'apollographql-client-name': 'be-dll-web-stores' },
        });
        return { status: r.status, text: await r.text() };
      } finally { clearTimeout(t); }
    }, [VARIABLES(pageNumber), hash]);

    // Akamai 偶尔会把某一页的请求挂住不给响应（不是 403，就是一直 pending），
    // 所以每页都套一个硬超时 + 一次重试，别让整趟卡死在一页上。
    const onePage = async (p) => {
      for (let attempt = 1; ; attempt++) {
        try {
          const res2 = await Promise.race([
            call(p),
            new Promise((_, rej) => setTimeout(() => rej(new Error('90 秒没响应')), 90000)),
          ]);
          if (res2.status !== 200) throw new Error(`返回 ${res2.status}：${res2.text.slice(0, 200)}`);
          const body = JSON.parse(res2.text);
          if (body.errors?.length) throw new Error(`接口报错：${body.errors[0].message.slice(0, 200)}`);
          if (!body.data?.productList) throw new Error('响应里没有 data.productList，接口结构可能改了');
          return body.data.productList;
        } catch (e) {
          if (attempt >= 2) throw new Error(`ProductList 第 ${p + 1} 页取不到：${e.message}`);
          console.warn(`  第 ${p + 1} 页失败（${e.message}），10 秒后重试`);
          await sleep(10000);
        }
      }
    };

    const products = [];
    let pages = 1;
    for (let p = 0; p < pages && p < maxPages; p++) {
      if (p) await sleep(GAP_MS);
      const t0 = Date.now();
      const pl = await onePage(p);
      pages = pl.pagination?.totalPages || 1;
      products.push(...(pl.products || []));
      console.log(`  第 ${p + 1}/${pages} 页 +${pl.products?.length || 0}（累计 ${products.length}/${pl.pagination?.totalResults}，${((Date.now() - t0) / 1000).toFixed(1)}s）`);
    }
    return products;
  }, { settle: 2000, onPage: sniffer.attach });

  if (process.env.DELHAIZE_DUMP) {
    fs.mkdirSync('data/debug', { recursive: true });
    fs.writeFileSync(process.env.DELHAIZE_DUMP, JSON.stringify(raw));
  }

  // 同一商品可能挂在多个促销主题下，按商品号去重
  const seen = new Set();
  const uniq = raw.filter((p) => p?.code && !seen.has(p.code) && seen.add(p.code));
  const rows = toRows(uniq, today).map(normalize);
  if (rows.length < 50) throw new Error(`Delhaize 只拿到 ${rows.length} 条，接口结构或促销档期可能变了`);
  return rows;
}
