// 各家超市自己的分类名（荷/法/英混杂）→ 统一的中文品类
const RULES = [
  ['粮油面食',   ['pasta','rijst','riz','spaghetti','noedel','meel','bloem','graan','ontbijtgran','cereal','olie','huile','suiker','sucre','zout','conserv','peulvrucht','deegwaren','voedselvoorraad','olijfolie']],
  ['肉禽蛋',     ['vlees','viande','kip','poulet','rund','boeuf','varken','porc','gehakt','worst','saucisse','charcuterie','ham','spek','ei ','eieren','oeuf','kalkoen','lam','vleeswaren','beenhouwerij']],
  ['海鲜',       ['vis','poisson','zalm','saumon','garnaal','crevette','mossel','moules','schaal','zeevruchten','tonijn','thon','seafood']],
  ['乳制品奶酪', ['kaas','fromage','melk','lait','yoghurt','yaourt','zuivel','boter','beurre','room','crème fraiche','ei-','dairy','geitenkaas','chocomelk']],
  ['果蔬',       ['groente','légume','legume','fruit','vrucht','aardappel','pomme de terre','salade','sla','tomaat','ui ','uien','champignon','verse kruiden','courgette','peren']],
  ['面包烘焙',   ['brood','pain','bakker','boulanger','koffiekoek','viennoiserie','gebak','patisserie','taart','croissant','bakkerij']],
  ['零食甜点',   ['snoep','chocola','chocolat','koek','biscuit','chips','noten','nuts','snack','ijs','glace','dessert','bonbon','wafel','schepijs','ijsjes']],
  ['饮料',       ['drank','boisson','frisdrank','soda','water','eau','sap','jus','juice','limonade','ice tea','cola','energydrink','appelsap']],
  ['酒类',       ['bier','bière','biere','wijn','vin','alcohol','sterke drank','spirit','champagne','aperitief','whisky','vodka','rum','tarwebier']],
  ['冷冻速食',   ['diepvries','surgel','congel','maaltijd','plat prepar','bereide','pizza','frituur','kant-en-klaar','soep','soupe']],
  ['调味酱料',   ['saus','sauce','kruid','épice','epice','mayonaise','ketchup','pesto','azijn','vinaigre','specerij','bouillon','smeer','sauzen','kookhulp','tomatenpuree']],
  ['咖啡茶',     ['koffie','café','cafe','thee','thé','the ','capsule','espresso']],
  ['个护美妆',   ['verzorging','soin','beauty','shampoo','douche','deo','tandpasta','dentifrice','make-up','cosmetic','parfum','scheer','hygiëne','hygiene','gezondheid','handzeep']],
  ['家清日用',   ['schoonmaak','nettoyage','wasmiddel','lessive','onderhoud','huishoud','papier','doekjes','vuilnis','afwas','entretien','ménage','menage','waspods']],
  ['母婴',       ['baby','bébé','bebe','luier','couche','kind','enfant','peuter','speelgoed','jouet']],
  ['宠物',       ['dier','animal','hond','chien','kat','chat','huisdier','pet ']],
  ['家电数码',   ['elektro','électro','electro','multimedia','computer','gsm','tv','keukenapparaat','gereedschap','outil','technolog']],
  ['服饰家居',   ['kleding','vêtement','vetement','mode','textiel','schoen','chaussure','wonen','interieur','meubel','tuin','jardin','bedden','decoratie','sport','laken']],
];

// 长度 ≤4（trim 后）的关键词很容易撞子串（ham→shampoo、sla→hoeslaken、eau→bureau、ijs→knalprijs），
// 按"词首命中 或 词尾命中"匹配：前面必须是字符串开头/非字母字符，或者后面必须是字符串结尾/非字母字符。
// 这样既挡掉 shampoo/hoeslaken 这类中间夹住的误判，又能接住 kokosmelk/abdijkaas/koolvis
// 这类荷兰语"词根+后缀"复合词（关键词落在词尾）。
// WORD_START 用来把个别关键词强制只按词首匹配：pasta/eau/ijs 恰好会在词尾被
// tandpasta/bureau/knalprijs 撞上，不能用词尾命中。
const WORD_START = new Set(['pasta', 'eau', 'ijs']);

function isWordStartMatch(s, key) {
  let from = 0;
  for (;;) {
    const i = s.indexOf(key, from);
    if (i === -1) return false;
    const before = i === 0 ? '' : s[i - 1];
    if (!/[a-zà-ÿ]/.test(before)) return true;
    from = i + 1;
  }
}

function isWordBoundaryMatch(s, key) {
  let from = 0;
  for (;;) {
    const i = s.indexOf(key, from);
    if (i === -1) return false;
    const before = i === 0 ? '' : s[i - 1];
    const after = s[i + key.length] || '';
    const atStart = !/[a-zà-ÿ]/.test(before);
    const atEnd = !/[a-zà-ÿ]/.test(after);
    if (atStart || atEnd) return true;
    from = i + 1;
  }
}

function keywordMatches(s, rawKey) {
  const lower = rawKey.toLowerCase();
  const trimmed = lower.trim();
  // 带尾空格的老关键词（如 'ei '、'pet '）保持原来的词首匹配行为不变：
  // 尾部空格本身就是天然的词尾边界，不参与下面的新逻辑。
  if (lower !== trimmed) return isWordStartMatch(s, lower);
  if (WORD_START.has(trimmed)) return isWordStartMatch(s, lower);
  if (trimmed.length <= 4) return isWordBoundaryMatch(s, lower);
  return s.includes(lower);
}

// 这两个复合词本身会被排在更前面的类别里、语义更宽泛的关键词提前撞上
// （roomijs 撞"乳制品奶酪"的 room，fruitsap 撞"果蔬"的 fruit），需要先命中。
const OVERRIDES = [
  ['零食甜点', ['roomijs']],
  ['饮料',     ['fruitsap']],
];

// 这两个分类名会被排在更前面的规则里的短关键词提前撞上
// （Zuivel, eieren 撞"肉禽蛋"的 eieren，Maaltijden, salades 撞"果蔬"的 salade），
// 需要在主循环前先判断。
const PRIORITY = [
  ['乳制品奶酪', ['zuivel']],
  ['冷冻速食',   ['maaltijd']],
];

export function toCat(raw) {
  const s = String(raw || '').toLowerCase();
  if (!s) return '其他';
  for (const [cat, keys] of OVERRIDES) if (keys.some((k) => s.includes(k))) return cat;
  for (const [cat, keys] of PRIORITY) if (keys.some((k) => s.includes(k))) return cat;
  for (const [cat, keys] of RULES) if (keys.some((k) => keywordMatches(s, k))) return cat;
  return '其他';
}
