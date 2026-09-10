# 鲁汶折扣雷达

鲁汶几家超市每周折扣的聚合页面，支持中文关键词搜索（搜「意面」能命中 pasta / spaghetti / Barilla）。

## 现在就试

在 **Windows 终端**（不是 Claude 的沙箱，沙箱连不上外网）里：

```powershell
cd C:\Projects\Leuven_discount
npm install
npm run scrape          # 抓数据 → data/raw/*.json
npm run build           # 出页面 → public/index.html
```

然后浏览器打开 `public\index.html`。

只想试一家：`node scripts/scrape.js lidl`

## 数据源现状

| 超市 | 方式 | 状态 |
|---|---|---|
| Lidl | 官网内部 JSON 接口，免鉴权，一次拉完 | ✅ 可用 |
| Colruyt | 公开 GCS bucket 上的每日全量 dump | ✅ 可用 |
| Carrefour | 促销列表页服务端渲染，cheerio 解析 | ⚠️ **选择器待校准**，见下 |
| AH（鲁汶 Bondgenotenlaan 64） | ah.be 的 `/zoeken/api/`，robots 允许但要带对 header | ⚠️ **接口待确认**，见下 |
| ALDI | Next.js `__NEXT_DATA__`，需要 Playwright | ⛔ 未做 |
| Delhaize | SAP Hybris + 反爬网关，全站 JS 渲染 | ⛔ 未做 |

> AH 比利时和荷兰是**两套独立定价**（同一商品 `wi123`：ah.be €2.29 / ah.nl €1.99），
> 所以网上那些现成的 `api.ah.nl` 封装对鲁汶没用，必须走 ah.be。

### AH 接口确认

```powershell
npm run inspect:ah
```

它会试几个候选接口并打印结果。全都不通的话，输出里有一段 Playwright 抓包命令，跑完把打印出的接口地址发给 Claude。

### Carrefour 选择器校准

页面结构是猜的，第一次跑大概率解析不出商品。跑一下：

```powershell
npm run inspect:carrefour
```

它会打印出现在真实的 class 名和一个商品卡片的 HTML，把输出贴给 Claude，改 `scrapers/carrefour.js` 里的选择器即可。

## 每周自动更新

`.github/workflows/refresh.yml` 已经配好，周一和周三早上 7 点（比利时时间）各跑一次：抓取 → 出页面 → 数据提交回仓库。

要用的话：

1. 在 GitHub 建个仓库，把这个目录推上去：

```powershell
git remote add origin https://github.com/<你的用户名>/leuven-discount.git
git branch -M main
git push -u origin main
```

2. Vercel 导入这个仓库，Output Directory 填 `public`
3. （可选）在仓库 Settings → Secrets 里加 `ANTHROPIC_API_KEY`，自动把新商品名翻成中文

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
scripts/      scrape 抓取 · build 出页面 · translate 补译名 · inspect-carrefour 校准工具
web/          页面模板（数据用 /*__DATA__*/ 占位符注入）
data/         raw 各店原始数据 · latest.json 当前 · history 历史快照
public/       构建产物，Vercel 部署这个目录
```
