// 把还没有中文名的商品名批量翻译，写进 lib/glossary.json（增量，翻过的不会再翻）。
// 需要环境变量 ANTHROPIC_API_KEY；没有就跳过，页面照常出，只是显示荷兰语原名。
import fs from 'node:fs';

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.log('没有 ANTHROPIC_API_KEY，跳过翻译'); process.exit(0); }

const GLOSSARY = 'lib/glossary.json';
const glossary = JSON.parse(fs.readFileSync(GLOSSARY, 'utf8'));
const todo = JSON.parse(fs.readFileSync('data/untranslated.json', 'utf8'))
  .filter((n) => !glossary[n.toLowerCase().trim()]);

if (!todo.length) { console.log('没有需要翻译的'); process.exit(0); }
console.log(`待翻译 ${todo.length} 个商品名`);

const BATCH = 60;
const LIMIT = +(process.env.TRANSLATE_LIMIT || 600);   // 每次跑的上限，控制花费

for (let i = 0; i < Math.min(todo.length, LIMIT); i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const prompt = `把下面这些比利时超市的商品名翻译成简体中文，供中国留学生查折扣用。
要求：地道、简短；品牌名保留原文（如 Barilla、Boni Selection）；只译商品本身，不加解释。
按输入顺序返回 JSON 数组，元素是字符串，数量必须和输入一致，不要有别的内容。

${JSON.stringify(batch, null, 0)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) { console.error(`翻译请求失败 HTTP ${res.status}，已翻的先存下来`); break; }

  const txt = (await res.json()).content?.[0]?.text || '';
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) { console.error('返回内容不是 JSON 数组，跳过这批'); continue; }
  const out = JSON.parse(m[0]);
  batch.forEach((name, k) => { if (out[k]) glossary[name.toLowerCase().trim()] = String(out[k]).trim(); });
  console.log(`  ${i + batch.length}/${Math.min(todo.length, LIMIT)}`);
}

fs.writeFileSync(GLOSSARY, JSON.stringify(glossary, null, 1));
console.log(`词表现有 ${Object.keys(glossary).length} 条 → ${GLOSSARY}`);
