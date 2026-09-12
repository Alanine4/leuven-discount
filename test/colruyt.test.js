import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benefitText, overlayStorePrices } from '../scrapers/colruyt.js';

// Colruyt 促销详情的 benefit：benefitPercentage 是整单减免比例，
// minLimit 是享受该比例要买够的件数（33.34% + min 3 = 买三付二，不是"第三件打折"）。

test('50% + 最少 2 件 -> 1+1 gratis', () => {
  assert.equal(benefitText({ benefit: [{ benefitPercentage: 50, minLimit: 2, limitUnit: 'S' }] }), '1+1 gratis');
});

test('33.34% + 最少 3 件 -> 2+1 gratis', () => {
  assert.equal(benefitText({ benefit: [{ benefitPercentage: 33.34, minLimit: 3 }] }), '2+1 gratis');
});

test('25% + 最少 4 件 -> 3+1 gratis', () => {
  assert.equal(benefitText({ benefit: [{ benefitPercentage: 25, minLimit: 4 }] }), '3+1 gratis');
});

test('50% + 最少 4 件 -> 2+2 gratis', () => {
  assert.equal(benefitText({ benefit: [{ benefitPercentage: 50, minLimit: 4 }] }), '2+2 gratis');
});

test('25% + 最少 1 件 -> 直折 -25%', () => {
  assert.equal(benefitText({ benefit: [{ benefitPercentage: 25, minLimit: 1 }] }), '-25%');
});

test('20% + 最少 12 件 -> -20% bij 12 stuks', () => {
  assert.equal(benefitText({ benefit: [{ benefitPercentage: 20, minLimit: 12 }] }), '-20% bij 12 stuks');
});

test('阶梯促销取减免比例最大的那一档', () => {
  assert.equal(benefitText({ benefit: [
    { benefitPercentage: 25, minLimit: 2 },
    { benefitPercentage: 33.34, minLimit: 3 },
  ] }), '2+1 gratis');
});

test('没有 benefit -> 空文案', () => {
  assert.equal(benefitText({}), '');
  assert.equal(benefitText(null), '');
});

// 鲁汶店价覆盖：批量接口返回 {products:[{productId, price:{basicPrice, measurementUnitPrice}}]}，
// 按 productId 回填到 normalize 之前的记录上。取不到的那批保留 bucket 价。

const rows = () => [
  { id: '13240', pricePromo: 2.15, unitPrice: '4.30/K' },
  { id: '80447', pricePromo: 1.55, unitPrice: '3.45/K' },
  { id: '999999', pricePromo: 9.99, unitPrice: '9.99/K' },
];

const reply = (ids) => ({
  products: ids.map((id) => ({
    productId: Number(id),
    price: { basicPrice: { 13240: 2.09, 80447: 1.55, 999999: 8.88 }[id], measurementUnitPrice: { 13240: 4.18, 80447: 3.45, 999999: 8.88 }[id], measurementUnit: 'K' },
  })),
});

test('overlayStorePrices：用接口价覆盖 pricePromo / unitPrice', async () => {
  const r = rows();
  const seen = [];
  await overlayStorePrices(r, {
    delayMs: 0,
    fetchJson: async (url) => { seen.push(url); return reply(['13240', '80447']); },
  });
  assert.equal(seen.length, 1);
  assert.match(seen[0], /placeId=684/);
  assert.match(seen[0], /productIds=13240,80447,999999/);
  assert.equal(r[0].pricePromo, 2.09);
  assert.equal(r[0].unitPrice, '4.18/K');
  assert.equal(r[1].pricePromo, 1.55);       // 价格一样，覆盖了但不算改动
});

test('overlayStorePrices：接口没返回的 id 保留 bucket 价', async () => {
  const r = rows();
  await overlayStorePrices(r, { delayMs: 0, fetchJson: async () => reply(['13240']) });
  assert.equal(r[2].pricePromo, 9.99);
  assert.equal(r[2].unitPrice, '9.99/K');
});

test('overlayStorePrices：某一批抛错时其余批照常覆盖', async () => {
  const r = rows();
  let n = 0;
  await overlayStorePrices(r, {
    batchSize: 2, delayMs: 0,
    fetchJson: async () => { if (++n === 1) throw new Error('HTTP 403'); return reply(['999999']); },
  });
  assert.equal(r[0].pricePromo, 2.15);       // 第一批失败，保留 bucket 价
  assert.equal(r[1].pricePromo, 1.55);
  assert.equal(r[2].pricePromo, 8.88);       // 第二批照常覆盖
  assert.equal(n, 2);
});

test('overlayStorePrices：没有 id 的记录不发请求', async () => {
  const r = [{ id: '', pricePromo: 1 }];
  let called = false;
  await overlayStorePrices(r, { delayMs: 0, fetchJson: async () => { called = true; return {}; } });
  assert.equal(called, false);
  assert.equal(r[0].pricePromo, 1);
});
