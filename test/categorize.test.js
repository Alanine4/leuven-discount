import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCat, toCatWithName } from '../lib/categorize.js';

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

// ---- PRIORITY 规则：zuivel/maaltijd 不能被后续规则里的短关键词撞车 ----

test('Zuivel, eieren -> 乳制品奶酪（不能被 eieren 撞成肉禽蛋）', () => {
  assert.equal(toCat('Zuivel, eieren'), '乳制品奶酪');
});

test('Zuivel -> 乳制品奶酪', () => {
  assert.equal(toCat('Zuivel'), '乳制品奶酪');
});

test('Maaltijden, salades -> 冷冻速食（不能被 salade 撞成果蔬）', () => {
  assert.equal(toCat('Maaltijden, salades'), '冷冻速食');
});

test('Kant-en-klare maaltijden -> 冷冻速食', () => {
  assert.equal(toCat('Kant-en-klare maaltijden'), '冷冻速食');
});

test('Eieren（不带 zuivel）仍归 肉禽蛋', () => {
  assert.equal(toCat('Eieren'), '肉禽蛋');
});

test('Verse salade（不带 maaltijd）仍归 果蔬', () => {
  assert.equal(toCat('Verse salade'), '果蔬');
});

// ---- 空输入 ----

test('空串 -> 其他', () => {
  assert.equal(toCat(''), '其他');
});

test('undefined -> 其他', () => {
  assert.equal(toCat(undefined), '其他');
});

test('Sauzen, kruiden en conserven / Sauzen, vinaigrettes en azijn -> 调味酱料（不能被 conserv 撞成粮油面食）', () => {
  assert.equal(toCat('Sauzen, kruiden en conserven'), '调味酱料');
  assert.equal(toCat('Sauzen, vinaigrettes en azijn'), '调味酱料');
});

// ---- 酒类 / 咖啡茶 从「饮料」里分出来：顶层分类 + 商品名一起喂进来时要命中细分类 ----

test('dranken + 啤酒名 -> 酒类', () => {
  assert.equal(toCat('dranken Jupiler Blond Bier 24x25cl'), '酒类');
});

test('dranken + 咖啡胶囊名 -> 咖啡茶', () => {
  assert.equal(toCat('dranken Nespresso Lungo capsules'), '咖啡茶');
});

test('dranken + 可乐名 -> 仍是饮料', () => {
  assert.equal(toCat('dranken Coca-Cola Zero 1.5L'), '饮料');
});

test('只有顶层分类 Dranken -> 饮料', () => {
  assert.equal(toCat('Dranken'), '饮料');
});

test('Champagne Brut 75cl -> 酒类', () => {
  assert.equal(toCat('Champagne Brut 75cl'), '酒类');
});

test('dranken + Ice Tea 不被 tea 关键词拉走 -> 饮料', () => {
  assert.equal(toCat('dranken Peach Ice Tea 1.5 L'), '饮料');
});

// ---- toCatWithName()：顶层分类 + 商品名 ----

test('toCatWithName：顶层够细就不看商品名', () => {
  assert.equal(toCatWithName('zuivel', "l'Original Koffie 4 x 100 g"), '乳制品奶酪');
});

test('toCatWithName：dranken + 啤酒 -> 酒类', () => {
  assert.equal(toCatWithName('dranken', 'POSTEL abdijbier dubbel 7,0%vol 6x33cl'), '酒类');
});

test('toCatWithName：dranken + 茶包 -> 咖啡茶', () => {
  assert.equal(toCatWithName('dranken', 'TEA OF LIFE Rooibos Royal Bio 20st'), '咖啡茶');
});

test('toCatWithName：dranken + 瓶装冰茶 -> 仍是饮料', () => {
  assert.equal(toCatWithName('dranken', 'FUZE TEA Green Tea Mango-Chamomile 40cl'), '饮料');
});

test('toCatWithName：dranken + 果味汽水不被 fruit 拉去果蔬', () => {
  assert.equal(toCatWithName('dranken', 'SPA FRUIT Lime-Ginger 40cl'), '饮料');
});

test('toCatWithName：dranken + 咖啡甜点口味不被 dessert 拉去零食', () => {
  assert.equal(toCatWithName('dranken', 'DOUWE EGBERTS Dessert pads 32st'), '饮料');
});

test('toCatWithName：顶层认不出时按商品名兜底', () => {
  assert.equal(toCatWithName('', 'IMPERIAL Bakmeel Zelfrijzend 1kg'), '粮油面食');
});

test('chips en aperitief -> 零食甜点（aperitief 单数是零食区，不能撞酒类）', () => {
  assert.equal(toCat('chips en aperitief'), '零食甜点');
  assert.equal(toCat('Bier, wijn, aperitieven'), '酒类');
});
