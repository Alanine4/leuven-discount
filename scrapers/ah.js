// Albert Heijn 比利时（鲁汶 Bondgenotenlaan 64，门店号 3164）
//
// 为什么非得有头浏览器：ah.be 全站挂 Akamai Bot Manager，curl 和无头 Playwright
// （headless shell、channel:'msedge' 无头都试过）一律 403 "Access Denied"，连 /gql 也一样。
// 只有 headless:false 的真实浏览器能拿到 200，之后在页面里同源 fetch('/gql') 也是 200。
// 所以 CI 里必须用 xvfb 起虚拟显示：
//     xvfb-run -a --server-args="-screen 0 1280x800x24" npm run scrape
// 见 .github/workflows/refresh.yml。
//
// 接口：POST https://www.ah.be/gql，operationName bonusCategories。
// 实测（2026-09-10）：真正起过滤作用的是 input.periodStart / periodEnd，不是 weekNumber ——
// weekNumber 从 37 改成 38，返回的 82 条 id 一模一样，只有 webPath 里的 ?week= 跟着变。
// periodStart/periodEnd 留 null 时返回的是本周 + 下周的并集（本周 76 + 下周 6 = 82，
// 和分别按两周日期查出来的结果对得上），所以一次请求就够，不用再查一次下周。
//
// ah.be 和 ah.nl 是两套独立定价（同一商品 wi123：BE €2.29 / NL €1.99），
// 荷兰那些现成的 api.ah.nl 封装对鲁汶没用。robots 只禁 api.ah.nl，www.ah.be/bonus 没禁。
import { normalize } from '../lib/normalize.js';
import { toCat } from '../lib/categorize.js';
import { headedPage, closeBrowser } from '../lib/browser.js';

const QUERY = `query bonusCategories($input: PromotionSearchInput) {
  bonusCategories(filterSet: WEB_CATEGORIES, input: $input) {
    id title type
    promotions {
      id title category productCount salesUnitSize webPath periodStart periodEnd
      promotionLabels { topText centerText bottomText }
      images { url width }
      price { now { amount } was { amount } }
      product { id title brand webPath salesUnitSize
        priceV2 { now { amount } was { amount } discount { description } }
        imagePack { small { url } } }
    }
  }
}`;

const VARIABLES = (weekNumber) => ({
  input: {
    periodStart: null, periodEnd: null, orderId: null, viewDate: null, weekNumber,
    supplierBoosted: null, states: ['NONE', 'ACTIVATED', 'ASSIGNED'], spotlight: null,
    showAllPromotionSegments: null, segmentType: ['NEGATE_PREMIUM'], promotionType: null,
    id: null, hqId: null, hideVariants: true, forcePromotionVisibility: true,
    filterUnavailableProducts: null, productIds: null,
  },
});

const ymd = (d) => d.toISOString().slice(0, 10);
const shiftDay = (iso, n) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return ymd(t);
};
const dayDiff = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 864e5);

/** ISO 周数：把日期挪到本周四，再数它是当年第几个七天 */
export function isoWeek(iso) {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const jan1 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t - jan1) / 864e5 + 1) / 7);
}

function validityText(start, end, today) {
  if (start > today) {
    const md = `${start.slice(5, 7)}/${start.slice(8, 10)}`;
    const nextMonday = shiftDay(today, ((8 - new Date(`${today}T00:00:00Z`).getUTCDay()) % 7) || 7);
    return start >= nextMonday ? `下周起 · ${md}` : `${md} 起`;
  }
  const left = dayDiff(end, today);
  return left <= 0 ? '最后一天' : `还剩 ${left} 天`;
}

/**
 * 促销角标 → 促销文案。
 *
 * 只有真的在"说折扣"的角标才翻成 effectiveDiscount() 认识的写法，"说价格"的角标保持原样，
 * 让折扣按 price.was / price.now 算。原因：AH 给的 was/now 是同一份量的整组价
 * （"3 voor 5.00" → now=5.00, was=6.87 = 3×2.29），价格比本身就是准的 27%；
 * 而 lib 里 "N voor X€" 和 "-X€" 两条规则假设 pp 是单件价（Carrefour 那套），
 * 套到 AH 上会把 27% 算成 67%、把 17% 算成 20%。
 * 所以 "3 voor" + "5.00" 写成 `3 voor €5.00`（€ 在数字前），不写成 `3 voor 5.00€`。
 */
export function labelToText(label) {
  const top = (label?.topText || '').trim();
  const raw = [top, label?.centerText, label?.bottomText].map((s) => (s || '').trim()).filter(Boolean).join(' ');
  const bot = (label?.bottomText || '').trim().toLowerCase();

  const pct = top.match(/^(\d{1,2})%$/);
  if (pct && bot === 'korting') return `-${pct[1]}%`;                       // "25% korting" → -25%
  if (bot === 'gratis' && /^\d{1,2}\+\d{1,2}$/.test(top)) return `${top} gratis`;   // "1+1 gratis"
  const nth = top.match(/^(\d{1,2})e$/);
  if (nth && bot === 'halve prijs') return `${nth[1]}de aan -50%`;          // "2e halve prijs"
  const voor = top.match(/^(?:(\d{1,2})\s+)?voor$/);
  if (voor && /^\d+([.,]\d+)?$/.test(bot)) return `${voor[1] ? `${voor[1]} ` : ''}voor €${bot}`;
  return raw;                                                              // "€1 korting"、其他没见过的写法
}

export function toRows(categories, today) {
  const rows = [];
  for (const c of categories || []) {
    for (const p of c.promotions || []) {
      const label = (p.promotionLabels || [])[0];
      const text = labelToText(label);
      // "gratis levering bij 12 euro" / "€2 leveringskorting" 是网购送货优惠，不是商品折扣：
      // 没有 price，对走进鲁汶门店的人也没用。本周 82 组里有 14 组是这种。
      if (/levering/i.test(text)) continue;

      const size = (p.salesUnitSize || p.product?.salesUnitSize || '').trim();
      let name = (p.product?.title || p.title || '').trim();
      if (size && !name.toLowerCase().includes(size.toLowerCase())) name += ` ${size}`;
      if (p.productCount > 1) name += `（${p.productCount} 款）`;

      const webPath = p.product?.webPath || p.webPath || '';
      rows.push(normalize({
        store: 'Albert Heijn', storeZh: 'AH',
        name,
        brand: p.product?.brand || '',
        priceOrig: p.price?.was?.amount ?? null,
        pricePromo: p.price?.now?.amount ?? null,
        unitPrice: '',                       // AH 的 bonus 接口不给每公斤/每升价
        discountText: text,
        validity: validityText(p.periodStart, p.periodEnd, today),
        endsAt: p.periodEnd || null,
        category: toCat(p.category || c.title || ''),
        url: webPath ? `https://www.ah.be${webPath}` : '',
        image: (p.images || []).find((i) => i.width === 200)?.url
          || (p.images || [])[0]?.url
          || p.product?.imagePack?.[0]?.small?.url || '',
        id: String(p.id || ''),
      }));
    }
  }
  return rows;
}

export default async function scrapeAH() {
  try { return await run(); } finally { await closeBrowser(); }
}

async function run() {
  const today = ymd(new Date());
  const data = await headedPage('https://www.ah.be/bonus', async (page, res) => {
    const status = res?.status();
    if (status !== 200) {
      throw new Error(`ah.be/bonus 返回 ${status}（Akamai 挡的）—— 确认跑的是有头浏览器，CI 里要 xvfb-run 包一层`);
    }
    return page.evaluate(async ([query, variables]) => {
      const r = await fetch('/gql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operationName: 'bonusCategories', query, variables }),
      });
      const t = await r.text();
      try { return { status: r.status, json: JSON.parse(t) }; }
      catch { return { status: r.status, text: t.slice(0, 300) }; }
    }, [QUERY, VARIABLES(isoWeek(today))]);
  });

  if (data.status !== 200) throw new Error(`AH /gql 返回 ${data.status}：${data.text || ''}`);
  if (data.json?.errors?.length) throw new Error(`AH /gql 报错：${data.json.errors[0].message}`);

  const rows = toRows(data.json?.data?.bonusCategories, today);
  if (rows.length < 20) throw new Error(`AH 只拿到 ${rows.length} 条，接口结构可能改了`);
  return rows;
}
