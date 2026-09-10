import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveDiscount, normalize, dedupe } from '../lib/normalize.js';

// ---- 已有规则回归保护 ----

test('mNth: 2de aan -50% -> 25%, multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '2de aan -50%' });
  assert.deepEqual(r, { pct: 25, multibuy: true, uncertain: false });
});

test('mNth: 3de aan -33.34% -> 11%, multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '3de aan -33.34%' });
  assert.deepEqual(r, { pct: 11, multibuy: true, uncertain: false });
});

test('mFree: 2+2 gratis -> 50%, multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '2+2 gratis' });
  assert.deepEqual(r, { pct: 50, multibuy: true, uncertain: false });
});

test('mFree: 2 + 1 gratis -> 33%, multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '2 + 1 gratis' });
  assert.deepEqual(r, { pct: 33, multibuy: true, uncertain: false });
});

test('mPct: -30% -> 30%', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '-30%' });
  assert.deepEqual(r, { pct: 30, multibuy: false, uncertain: false });
});

test('mPct: -33,3% -> 33%', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '-33,3%' });
  assert.deepEqual(r, { pct: 33, multibuy: false, uncertain: false });
});

test('价格比：无文案，正常折扣 <60% 不标 uncertain', () => {
  const r = effectiveDiscount({ priceOrig: 10, pricePromo: 6, discountText: '' });
  assert.deepEqual(r, { pct: 40, multibuy: false, uncertain: false });
});

test('价格比：无文案，深折 >=60% 标 uncertain', () => {
  const r = effectiveDiscount({ priceOrig: 10, pricePromo: 3, discountText: '' });
  assert.deepEqual(r, { pct: 70, multibuy: false, uncertain: true });
});

test('价格相等 -> pct 0', () => {
  const r = effectiveDiscount({ priceOrig: 5, pricePromo: 5, discountText: '' });
  assert.deepEqual(r, { pct: 0, multibuy: false, uncertain: false });
});

test('pct 越界 -> null + uncertain', () => {
  const r = effectiveDiscount({ priceOrig: 10, pricePromo: 0.4, discountText: '' });
  assert.deepEqual(r, { pct: null, multibuy: false, uncertain: true });
});

// ---- 新规则 1：N voor X€ ----

test('N voor X€: 3 voor 6€ + pp 3.00 -> 33%, multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: 3.00, discountText: '3 voor 6€' });
  assert.deepEqual(r, { pct: 33, multibuy: true, uncertain: false });
});

test('N voor X€: 8 voor 4.99€ + pp 0.90 -> multibuy, pct 划算', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: 0.90, discountText: '8 voor 4.99€' });
  // 每件实付 4.99/8=0.62375，(1-0.62375/0.90)*100 = 30.69 -> 31
  assert.deepEqual(r, { pct: 31, multibuy: true, uncertain: false });
});

test('N voor X€ 边界：pricePromo 缺失 -> pct null，仍标 multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '3 voor 10€' });
  assert.deepEqual(r, { pct: null, multibuy: true, uncertain: false });
});

test('N voor X€ 边界：算出 <=0 -> pct null', () => {
  // 每件实付 5/2=2.5 > 单件挂牌价 2.00，说明该文案不适用这个 pricePromo，算出负数
  const r = effectiveDiscount({ priceOrig: null, pricePromo: 2.00, discountText: '2 voor 5€' });
  assert.deepEqual(r, { pct: null, multibuy: true, uncertain: false });
});

// ---- 新规则 2：-X€（单件直减，无 voor N） ----

test('-X€: -1€ + pp 4.00 -> 25%，非 multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: 4.00, discountText: '-1€' });
  assert.deepEqual(r, { pct: 25, multibuy: false, uncertain: false });
});

test('-X€: -0.50€ + pp 2.00 -> 25%', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: 2.00, discountText: '-0.50€' });
  assert.deepEqual(r, { pct: 25, multibuy: false, uncertain: false });
});

test('-X€ 边界：pricePromo 缺失 -> pct null', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '-2.50€' });
  assert.deepEqual(r, { pct: null, multibuy: false, uncertain: false });
});

test('-X€ 边界：X >= pricePromo -> pct null + uncertain', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: 4.00, discountText: '-4.69€' });
  assert.deepEqual(r, { pct: null, multibuy: false, uncertain: true });
});

// ---- 新规则 3：-X€ voor N / -X% voor N（买 N 件才享受） ----

test('-X€ voor N: -1€ voor 2 + pp 2.00 -> 25%, multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: 2.00, discountText: '-1€ voor 2' });
  assert.deepEqual(r, { pct: 25, multibuy: true, uncertain: false });
});

test('-X€ voor N: -2.50€ voor 2 + pp 5.00 -> 25%, multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: 5.00, discountText: '-2.50€ voor 2' });
  assert.deepEqual(r, { pct: 25, multibuy: true, uncertain: false });
});

test('-X€ voor N 边界：pricePromo 缺失 -> pct null，仍标 multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '-1€ voor 2' });
  assert.deepEqual(r, { pct: null, multibuy: true, uncertain: false });
});

test('-X% voor N: -5% voor 2 -> 5%, multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '-5% voor 2' });
  assert.deepEqual(r, { pct: 5, multibuy: true, uncertain: false });
});

test('-X% voor N: -33.34% voor 2 -> 33%, multibuy', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '-33.34% voor 2' });
  assert.deepEqual(r, { pct: 33, multibuy: true, uncertain: false });
});

// ---- 积分/纯价格文案：不出 pct ----

test('Bonuspunten 积分文案：pct 保持 null，不标 uncertain', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: null, discountText: '20€ gekocht = 700 Bonuspunten' });
  assert.deepEqual(r, { pct: null, multibuy: false, uncertain: false });
});

test('纯价格文案 0.89€：pct 保持 null，不标 uncertain', () => {
  const r = effectiveDiscount({ priceOrig: null, pricePromo: 0.89, discountText: '0.89€' });
  assert.deepEqual(r, { pct: null, multibuy: false, uncertain: false });
});

// ---- normalize() ----

test('normalize：整体字段转换 + 折扣计算', () => {
  const raw = {
    store: 'carrefour', storeZh: '家乐福', name: 'Coca-Cola 1.5L', nameZh: '',
    brand: 'Coca-Cola', priceOrig: '', pricePromo: '3.00', unitPrice: '',
    discountText: '3 voor 6€', validity: '10/09-16/09', endsAt: '2026-09-16',
    category: '饮料', url: 'https://example.com/x', image: '', id: 'abc123',
  };
  const n = normalize(raw);
  assert.equal(n.store, 'carrefour');
  assert.equal(n.store_zh, '家乐福');
  assert.equal(n.name_zh, 'Coca-Cola 1.5L');
  assert.equal(n.po, null);
  assert.equal(n.pp, 3.00);
  assert.equal(n.pct, 33);
  assert.equal(n.mb, 1);
  assert.equal(n.unc, 0);
  assert.equal(n.cat, '饮料');
});

test('normalize：非法分类回退到 其他', () => {
  const n = normalize({ store: 'carrefour', name: '不存在的品类商品', discountText: '', category: '乱七八糟' });
  assert.equal(n.cat, '其他');
});

// ---- dedupe() ----

test('dedupe：同店同名同价去重', () => {
  const items = [
    { store: 'ah', name_zh: '牛奶', po: 2, pp: 1.5 },
    { store: 'ah', name_zh: '牛奶', po: 2, pp: 1.5 },
    { store: 'ah', name_zh: '面包', po: 3, pp: 2 },
  ];
  const out = dedupe(items);
  assert.equal(out.length, 2);
});

test('mFree: 两位数 12 + 6 gratis -> 33%，不能被吃成 2 + 6', () => {
  assert.deepEqual(effectiveDiscount({ discountText: '12 + 6 gratis' }), { pct: 33, multibuy: true, uncertain: false });
});
test('N voor X€ 深折无佐证 -> 标 uncertain', () => {
  const r = effectiveDiscount({ pricePromo: 3.49, discountText: '8 voor 4.99€' });
  assert.equal(r.pct, 82); assert.equal(r.uncertain, true); assert.equal(r.multibuy, true);
});
test('-X€ 直减接近单价 -> 标 uncertain', () => {
  const r = effectiveDiscount({ pricePromo: 6.29, discountText: '-4.69€' });
  assert.equal(r.pct, 75); assert.equal(r.uncertain, true);
});
