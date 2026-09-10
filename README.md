# 鲁汶折扣雷达

鲁汶几家超市每周折扣的聚合页面，支持中文关键词搜索（搜「意面」能命中 pasta / spaghetti / Barilla）。

## 现在就试

在 **Windows 终端**（不是 Claude 的沙箱，沙箱连不上外网）里：

```powershell
cd C:\Projects\Leuven_discount
npm install
npm run scrape          # 抓数据 → data/raw/*.json
npm run build           # 出页面 → public/index.html
npm test                # 跑单元测试
```

然后浏览器打开 `public\index.html`。

只想试一家：`node scripts/scrape.js <store>`，比如 `node scripts/scrape.js lidl`。可选的 store 有 lidl、colruyt、carrefour、aldi、ah。

## 数据来源

| 超市 | 方式 | 状态 |
|---|---|---|
| Lidl | 官网搜索接口返回的 JSON，免鉴权 | 可用 |
| Colruyt | 第三方镜像的公开 GCS bucket，每日更新一次全量数据 | 可用 |
| Carrefour | 官网促销页服务端渲染，Playwright 取页 + cheerio 解析 | 可用 |
| ALDI | 官网 aanbiedingen 页里嵌的 `__NEXT_DATA__`，裸 fetch 即可 | 可用 |
| Albert Heijn | ah.be 全站返回 403，暂时抓不了 | 待解决 |
| Delhaize | 全站 JS 渲染加反爬网关，还没做 | 待做 |

## 每周自动更新

`.github/workflows/refresh.yml` 已经配好：每周一、周三早上 7 点（比利时时间）跑一次抓取和构建，把新数据提交回仓库。Vercel 监听到仓库更新后自动重新部署，Output Directory 填 `public`。

线上地址：https://leuven-zhekou.vercel.app （仓库 https://github.com/Alanine4/leuven-discount ）。推送到 `main` 或 Actions 提交新数据后，Vercel 会自动重新部署，链接不变。

（可选）在仓库 Settings → Secrets 里加 `ANTHROPIC_API_KEY`，Actions 会自动把新商品名翻成中文。

数据每周提交进 git，所以 `data/history/` 天然是价格历史，以后可以做「这周是不是真便宜」的对比。

## 中文搜索怎么工作的

不依赖逐个商品翻译。页面里有一份中文→荷/法/英的同义词表（`web/template.html` 里的 `SYN`），
搜「意面」时把查询扩展成 pasta / spaghetti / penne / lasagne 再去匹配商品原名。
所以**没有中文译名也能搜到**；`lib/glossary.json` 里的译名只是为了显示好看，会随着每周运行慢慢积累。

拉丁词用词首匹配，所以搜 `pasta` 不会跳出 `tandpasta`（牙膏）。

## 折扣力度怎么算的

传单上的"原价"经常是**整组价**（"第二件半价"标的是两件总价），直接相除会把 25% 的优惠算成 60%。
所以 `lib/normalize.js` 里以促销文案为准：

- `2de aan -50%` → 25%
- `2+2 gratis` → 50%
- `-30%` → 30%
- 都没有才用价格比；比值 ≥60% 且无文案佐证的标成 `unc`（页面上显示"约 -N%"，排序时降权）

## 目录

```
scrapers/     每家超市一个抓取器，输出统一格式
lib/          normalize.js 折扣计算 · categorize.js 品类归并 · glossary.json 中文名词表
scripts/      scrape 抓取 · build 出页面 · translate 补译名 · inspect-carrefour/inspect-ah 校准工具
web/          页面模板（数据用 /*__DATA__*/ 占位符注入）
data/         raw 各店原始数据 · latest.json 当前 · history 历史快照
public/       构建产物，Vercel 部署这个目录
```
