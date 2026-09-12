import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toRows, promoText, dmyToIso } from '../scrapers/delhaize.js';
import { normalize } from '../lib/normalize.js';

// 样本是 2026-09-12 真实响应里挑的 16 条，覆盖见过的每一种促销文案。
const SAMPLE = JSON.parse(fs.readFileSync(new URL('./fixtures/delhaize-sample.json', import.meta.url)));
const TODAY = '2026-09-12';
const rows = toRows(SAMPLE, TODAY).map(normalize);
const byId = (code) => rows.find((r) => r.id === code);

test('样本能解析出记录，网购免运费和无促销的条目被丢掉', () => {
  // 16 条样本里 1 条是 "3=gratis levering"（网购免运费）、1 条没有任何促销
  assert.equal(rows.length, 14);
  assert.equal(rows.filter((r) => /levering/i.test(r.dt)).length, 0);
});

test('促销文案改写成 effectiveDiscount() 认识的写法', () => {
  assert.equal(promoText({ description: '1+1_gratis' }), '1+1 gratis');
  assert.equal(promoText({ description: '3 voor €5' }), '3 voor 5€');
  assert.equal(promoText({ simplePromotionMessage: '3 producten voor €5' }), '3 voor 5€');
  assert.equal(promoText({ description: '- €6 voor 2' }), '-6€ voor 2');
  assert.equal(promoText({ description: '- €3' }), '-3€');
  assert.equal(promoText({ description: '€1 korting' }), '-1€');
  assert.equal(promoText({ description: '2de tegen -50%' }), '2de tegen -50%');
  assert.equal(promoText({ description: '-25% voor 3' }), '-25% voor 3');
  assert.equal(promoText({}), '');
});

test('endDate 是 DD/MM/YYYY，转成 ISO 日期', () => {
  assert.equal(dmyToIso('16/09/2026 21:59:00'), '2026-09-16');
  assert.equal(dmyToIso(null), null);
});

test('直接打折：po 是货架价，pp 是折后价', () => {
  const r = byId('F2020032400055540000');      // Aubergine，-25%
  assert.equal(r.po, 0.89);
  assert.equal(r.pp, 0.67);
  assert.equal(r.pct, 25);
  assert.equal(r.mb, 0);
});

test('多件促销：不填 po（接口给的折后价等于货架价），pp 是单件价', () => {
  const r = byId('F1986053100336900000');      // Druiven，1+1 gratis
  assert.equal(r.po, null);
  assert.equal(r.pp, 2.29);
  assert.equal(r.pct, 50);
  assert.equal(r.mb, 1);
});

test('2de tegen -50% 算成 25%，不按价格比', () => {
  const r = byId('F2021060800081990000');
  assert.equal(r.dt, '2de tegen -50%');
  assert.equal(r.pct, 25);
  assert.equal(r.mb, 1);
});

test('"3 voor €5" 按每件实付价跟单件价比', () => {
  const r = byId('F2023080700124180000');      // Kokosnoot 2.25/件，3 件 5€
  assert.equal(r.dt, '3 voor 5€');
  assert.equal(r.pct, 26);                     // 1 - (5/3)/2.25
  assert.equal(r.mb, 1);
});

test('"- €6 voor 2" 按买够 2 件减 6 欧算', () => {
  const r = byId('S2011021400252980000');      // Gin 19.99/瓶
  assert.equal(r.dt, '-6€ voor 2');
  assert.equal(r.pct, 15);                     // 6 / (2 × 19.99)
  assert.equal(r.mb, 1);
});

test('每条都有促销力度、截止日期、商品链接和单价', () => {
  for (const r of rows) {
    assert.ok(r.pct !== null, `${r.name} 没算出折扣力度（dt=${r.dt}）`);
    assert.match(r.ends, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(r.pp > 0);
    assert.match(r.url, /^https:\/\/www\.delhaize\.be\/nl\/shop\//);
    assert.equal(r.store, 'Delhaize');
    assert.equal(r.store_zh, '大黑狮');
  }
});

test('"Zoete/Zoute kruidenierswaren" 这种大杂烩分类按商品名判品类', () => {
  assert.equal(byId('S2017091904177250000').cat, '零食甜点');   // Zoete kruidenierswaren / Ontbijtkoeken Chocolade
  assert.equal(byId('S2011010300027740000').cat, '零食甜点');   // Zoute kruidenierswaren / Chips Original
  assert.equal(byId('S2022112500661650000').cat, '调味酱料');   // Zoute kruidenierswaren / Tapas Bravas saus
});

test('有效期文案按今天算', () => {
  assert.equal(byId('F2020032400055540000').val, '还剩 4 天');   // 截止 09-16
  assert.equal(byId('F2023080700124180000').val, '长期促销');    // 截止 12-31
});
