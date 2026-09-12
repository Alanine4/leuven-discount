// ALDI（aldi.be）：Next.js 站点，本周页 /aanbiedingen.html 和下周页 /aanbiedingen-volgende-week.html
// 的 <script id="__NEXT_DATA__"> 里直接带全量促销商品 JSON，不用浏览器、不用翻页，两个请求拿完。
// 商品在 props.pageProps.apiData（是个 JSON 字符串）→ 找到 ["OFFER_GET", {res}] → res.algoliaDataMap，
// 档期分组在 res.categories（每组带 startDate/endDate 和 content[].productIds）。
// robots 禁 /*?*filters、/mds/、/bal/、/can/、/reg-*.html，这里两个 URL 都不带参数。
// 只抓荷语版（/fr/ 是同一批货的法语重复条目）。
import { normalize, get } from '../lib/normalize.js';
import { toCat } from '../lib/categorize.js';

const PAGES = [
  'https://www.aldi.be/aanbiedingen.html',
  'https://www.aldi.be/aanbiedingen-volgende-week.html',
];

// 传单版块名 → 中文品类。ALDI 的非食品商品在商品数据里没有分类字段，
// 只有它所在的版块标题（"Kleding"/"Tuin"/"Huisdieren"…）能定位品类。顺序有意义：先窄后宽。
const SECTION_RULES = [
  [/kinderkleding|kinderen|baby/, '母婴'],
  [/huisdier/, '宠物'],
  [/kleding|schoen|mode/, '服饰家居'],
  [/slaapkamer|wonen|tuin|plant|fiets|herfst|winter|zomer|lente/, '服饰家居'],
  [/huishouden/, '家清日用'],
  [/wijn/, '酒类'],
  [/diy|bureau|elektro|multimedia/, '家电数码'],
];

const ymd = (d) => d.toISOString().slice(0, 10);
const shiftDay = (iso, n) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return ymd(t);
};
const dayDiff = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 864e5);

/** 从页面 HTML 里挖出 OFFER_GET 的 res（商品字典 + 档期分组） */
export function extractOffer(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('ALDI 页面里没有 __NEXT_DATA__，站点结构可能改了');
  let api = JSON.parse(m[1]).props?.pageProps?.apiData;
  if (typeof api === 'string') api = JSON.parse(api);
  const offer = (api || []).find((e) => e[0] === 'OFFER_GET')?.[1]?.res;
  if (!offer?.algoliaDataMap) throw new Error('__NEXT_DATA__ 里没有 OFFER_GET 商品数据');
  return offer;
}

/**
 * 挑出该商品当下相关的那个档期：优先今天正在跑的，其次最近一个还没开始的。
 * 注意 validUntilLocalDate 是"失效日"（排他），最后一个可买的日子要减一天 —— 已用
 * 分组的 endDate 对过 385 条，全部吻合。
 */
function pickWindow(windows, today) {
  const wins = (windows || [])
    .filter((w) => w.validFromLocalDate && w.validUntilLocalDate)
    .map((w) => ({ ...w, start: w.validFromLocalDate, end: shiftDay(w.validUntilLocalDate, -1) }))
    .sort((a, b) => a.start.localeCompare(b.start));
  return wins.find((w) => w.start <= today && today <= w.end) || wins.find((w) => w.start > today) || null;
}

function validityText(win, today) {
  if (win.start > today) {
    const md = `${win.start.slice(5, 7)}/${win.start.slice(8, 10)}`;
    // 下周一及以后才开卖的，标成"下周起"，跟本周正在打折的区分开
    const nextMonday = shiftDay(today, ((8 - new Date(`${today}T00:00:00Z`).getUTCDay()) % 7) || 7);
    return win.start >= nextMonday ? `下周起 · ${md}` : `${md} 起`;
  }
  const left = dayDiff(win.end, today);
  return left <= 0 ? '最后一天' : `还剩 ${left} 天`;
}

function unitPrice(win) {
  const b = (win.basePrice || [])[0];
  if (!b?.basePriceValue) return '';
  const scale = String(b.basePriceScale || '').split('per ').pop().trim();   // "bijv. 39 g: per kg" → "kg"
  return scale ? `€${b.basePriceValue.toFixed(2)}/${scale}` : '';
}

function category(p, sectionTitle) {
  const structured = [p.mainCategoryID, ...(p.categoryIDs || []), ...(p.hierarchicalCategories?.lvl1 || [])]
    .join(' ').replace(/-/g, ' ');
  const byStruct = toCat(structured);
  if (byStruct !== '其他') return byStruct;
  const s = String(sectionTitle || '').toLowerCase();
  for (const [re, cat] of SECTION_RULES) if (re.test(s)) return cat;
  return toCat(p.name || '');           // 兜底：拿商品名去撞关键词
}

export default async function scrapeAldi() {
  const today = ymd(new Date());
  const byId = new Map();               // 同一件货本周页和下周页都出现时，保留先看到的（本周）

  for (const [i, url] of PAGES.entries()) {
    const offer = extractOffer(await get(url, { delay: i ? 1500 : 0 }));
    const section = new Map();          // 商品 ID → 它所在的版块标题
    for (const g of offer.categories || []) {
      for (const c of g.content || []) {
        for (const id of c.productIds || []) if (!section.has(id)) section.set(id, c.title);
      }
    }
    for (const [id, p] of Object.entries(offer.algoliaDataMap)) {
      if (!byId.has(id)) byId.set(id, { p, sectionTitle: section.get(id) || '' });
    }
  }

  const rows = [];
  for (const [id, { p, sectionTitle }] of byId) {
    const win = pickWindow(p.promotionPrices, today);
    if (!win) continue;                 // 档期已经过去的不要
    const img = (p.assets || []).find((a) => a.type === 'primary') || (p.assets || [])[0];
    // "1+1 gratis" / "2 voor …" 这类整组价的条目，ALDI 偶尔把促销价放进 strikePrice、
    // 把整组原价放进 priceValue（379 条里 2 条）。两个数里小的那个才是要付的价。
    const price = win.priceValue ?? null;
    const strike = win.strikePrice?.strikePriceValue ?? null;
    const promoText = win.priceTagLabels?.promoText1 || '';
    // "2 voor 2 euro"：两个价格字段里一个是单件挂牌价、一个是整组促销总价（2.58 / 2.00），
    // 谁落在哪个字段不固定。折扣全靠文案算（买 2 件共 2€ vs 单件 2.58€ = -61%），
    // 所以这里把大的那个当单件挂牌价交给 effectiveDiscount，原价留空，免得再被当划线价除一遍。
    const perUnitDeal = /(\d+)\s*voor\s*[\d.,]+\s*(?:€|eur)/i.test(promoText);
    const listPrice = Math.max(price ?? 0, strike ?? 0) || null;
    const swapped = !perUnitDeal && strike !== null && price !== null && strike < price;
    rows.push(normalize({
      store: 'ALDI', storeZh: 'ALDI',
      name: p.name,
      brand: '',                        // ALDI 数据里没有品牌字段，绝大多数也是自有品牌
      priceOrig: perUnitDeal ? null : (swapped ? price : strike),
      pricePromo: perUnitDeal ? listPrice : (swapped ? strike : price),
      unitPrice: unitPrice(win),
      discountText: promoText,
      validity: validityText(win, today),
      endsAt: win.end,
      category: category(p, sectionTitle),
      url: p.productSlug ? `https://www.aldi.be/product/${p.productSlug}.html` : '',
      image: img ? `${img.url}?bfc=on&wid=360&fmt=webp-alpha` : '',
      id,
    }));
  }

  if (rows.length < 30) throw new Error(`ALDI 只拿到 ${rows.length} 条，页面数据结构可能改了`);
  return rows;
}
