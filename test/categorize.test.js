import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCat } from '../lib/categorize.js';

// ---- 修复的误判用例：短关键词子串撞车 ----

test('Shampoo 不再撞 ham -> 个护美妆', () => {
  assert.equal(toCat('Shampoo'), '个护美妆');
});

test('Tandpasta 不再撞 pasta -> 个护美妆', () => {
  assert.equal(toCat('Tandpasta'), '个护美妆');
});

test('Hoeslaken 不再撞 sla -> 服饰家居', () => {
  assert.equal(toCat('Hoeslaken'), '服饰家居');
});

test('Bureau 不再撞 eau -> 不是饮料', () => {
  assert.notEqual(toCat('Bureau'), '饮料');
  assert.equal(toCat('Bureau'), '其他');
});

test('Knalprijs 不再撞 ijs -> 其他', () => {
  assert.equal(toCat('Knalprijs'), '其他');
});

// ---- 复合词回归：整词匹配不能误伤这些 ----

test('roomijs -> 零食甜点', () => {
  assert.equal(toCat('roomijs'), '零食甜点');
});

test('geitenkaas -> 乳制品奶酪', () => {
  assert.equal(toCat('geitenkaas'), '乳制品奶酪');
});

test('chocomelk -> 乳制品奶酪', () => {
  assert.equal(toCat('chocomelk'), '乳制品奶酪');
});

test('fruitsap -> 饮料', () => {
  assert.equal(toCat('fruitsap'), '饮料');
});

test('volkorenbrood -> 面包烘焙', () => {
  assert.equal(toCat('volkorenbrood'), '面包烘焙');
});

test('olijfolie -> 粮油面食', () => {
  assert.equal(toCat('olijfolie'), '粮油面食');
});

test('kipfilet -> 肉禽蛋', () => {
  assert.equal(toCat('kipfilet'), '肉禽蛋');
});

test('rundsgehakt -> 肉禽蛋', () => {
  assert.equal(toCat('rundsgehakt'), '肉禽蛋');
});

test('tarwebier -> 酒类', () => {
  assert.equal(toCat('tarwebier'), '酒类');
});

// ---- 后缀复合词回归：短关键词落在词尾也要能命中 ----

test('kokosmelk -> 乳制品奶酪', () => {
  assert.equal(toCat('kokosmelk'), '乳制品奶酪');
});

test('abdijkaas -> 乳制品奶酪', () => {
  assert.equal(toCat('abdijkaas'), '乳制品奶酪');
});

test('koolvis -> 海鲜', () => {
  assert.equal(toCat('koolvis'), '海鲜');
});

test('zwartewoudham -> 肉禽蛋', () => {
  assert.equal(toCat('zwartewoudham'), '肉禽蛋');
});

test('tomatensaus -> 调味酱料', () => {
  assert.equal(toCat('tomatensaus'), '调味酱料');
});

test('biozalm -> 海鲜', () => {
  assert.equal(toCat('biozalm'), '海鲜');
});

test('groeimelk -> 乳制品奶酪', () => {
  assert.equal(toCat('groeimelk'), '乳制品奶酪');
});

// ---- 各店真实分类名回归 ----

test('AH 分类名：Cosmetica voor baby & kind/... -> 个护美妆（cosmetic 命中早于母婴的 baby）', () => {
  assert.equal(
    toCat('Assortiment/Levensmiddelen en drogisterij/Cosmetica voor baby & kind/Wondbescherming & Crèmes'),
    '个护美妆'
  );
});

test('dranken -> 饮料', () => {
  assert.equal(toCat('dranken'), '饮料');
});

test('vlees en vis -> 肉禽蛋', () => {
  assert.equal(toCat('vlees en vis'), '肉禽蛋');
});

test('zuivel -> 乳制品奶酪', () => {
  assert.equal(toCat('zuivel'), '乳制品奶酪');
});

test('Kruidenierswaren/Droge voeding -> 调味酱料（现状基线，命中 kruid）', () => {
  assert.equal(toCat('Kruidenierswaren/Droge voeding'), '调味酱料');
});

test('sauzen en kookhulp -> 调味酱料', () => {
  assert.equal(toCat('sauzen en kookhulp'), '调味酱料');
});

test('verzorging en hygiëne -> 个护美妆', () => {
  assert.equal(toCat('verzorging en hygiëne'), '个护美妆');
});

test('Beenhouwerij -> 肉禽蛋', () => {
  assert.equal(toCat('Beenhouwerij'), '肉禽蛋');
});

// ---- 空输入 ----

test('空串 -> 其他', () => {
  assert.equal(toCat(''), '其他');
});

test('undefined -> 其他', () => {
  assert.equal(toCat(undefined), '其他');
});
