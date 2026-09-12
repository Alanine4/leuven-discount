import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benefitText } from '../scrapers/colruyt.js';

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
