// 各家超市自己的分类名（荷/法/英混杂）→ 统一的中文品类
const RULES = [
  ['粮油面食',   ['pasta','rijst','riz','spaghetti','noedel','meel','bloem','graan','ontbijtgran','cereal','olie','huile','suiker','sucre','zout','conserv','peulvrucht','deegwaren']],
  ['肉禽蛋',     ['vlees','viande','kip','poulet','rund','boeuf','varken','porc','gehakt','worst','saucisse','charcuterie','ham','spek','ei ','eieren','oeuf','kalkoen','lam','vleeswaren']],
  ['海鲜',       ['vis','poisson','zalm','saumon','garnaal','crevette','mossel','moules','schaal','zeevruchten','tonijn','thon','seafood']],
  ['乳制品奶酪', ['kaas','fromage','melk','lait','yoghurt','yaourt','zuivel','boter','beurre','room','crème fraiche','ei-','dairy']],
  ['果蔬',       ['groente','légume','legume','fruit','vrucht','aardappel','pomme de terre','salade','sla','tomaat','ui ','uien','champignon','verse kruiden']],
  ['面包烘焙',   ['brood','pain','bakker','boulanger','koffiekoek','viennoiserie','gebak','patisserie','taart','croissant','bakkerij']],
  ['零食甜点',   ['snoep','chocola','chocolat','koek','biscuit','chips','noten','nuts','snack','ijs','glace','dessert','bonbon','wafel']],
  ['饮料',       ['drank','boisson','frisdrank','soda','water','eau','sap','jus','juice','limonade','ice tea','cola','energydrink']],
  ['酒类',       ['bier','bière','biere','wijn','vin','alcohol','sterke drank','spirit','champagne','aperitief','whisky','vodka','gin','rum']],
  ['冷冻速食',   ['diepvries','surgel','congel','maaltijd','plat prepar','bereide','pizza','frituur','kant-en-klaar','soep','soupe']],
  ['调味酱料',   ['saus','sauce','kruid','épice','epice','mayonaise','ketchup','pesto','azijn','vinaigre','specerij','bouillon','smeer']],
  ['咖啡茶',     ['koffie','café','cafe','thee','thé','the ','capsule','espresso']],
  ['个护美妆',   ['verzorging','soin','beauty','shampoo','douche','deo','tandpasta','dentifrice','make-up','cosmetic','parfum','scheer','hygiëne','hygiene']],
  ['家清日用',   ['schoonmaak','nettoyage','wasmiddel','lessive','onderhoud','huishoud','papier','doekjes','vuilnis','afwas','entretien','ménage','menage']],
  ['母婴',       ['baby','bébé','bebe','luier','couche','kind','enfant','peuter','speelgoed','jouet']],
  ['宠物',       ['dier','animal','hond','chien','kat','chat','huisdier','pet ']],
  ['家电数码',   ['elektro','électro','electro','multimedia','computer','gsm','tv','keukenapparaat','gereedschap','outil','technolog']],
  ['服饰家居',   ['kleding','vêtement','vetement','mode','textiel','schoen','chaussure','wonen','interieur','meubel','tuin','jardin','bedden','decoratie','sport']],
];

export function toCat(raw) {
  const s = String(raw || '').toLowerCase();
  if (!s) return '其他';
  for (const [cat, keys] of RULES) if (keys.some((k) => s.includes(k))) return cat;
  return '其他';
}
