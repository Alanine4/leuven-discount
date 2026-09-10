# 鲁汶折扣雷达：交接文档

> 给接手的 Claude Code 看的。项目目录 `C:\Projects\Leuven_discount`。
> 最后更新：2026-09-10

---

## 1. 这是什么

给在比利时鲁汶（Leuven）的中国留学生用的**超市折扣聚合网页**。把几家超市每周传单里的促销商品汇总到一个页面，**能用中文关键词搜**：输入「意面」要能搜到 pasta / spaghetti / Barilla，看到哪家在打折、打几折。每周传单换新后自动更新。

用户是 Alan，KU Leuven 精算与金融工程硕士，会写代码（Vercel / Cloudflare / bun 都在用），所以技术方案可以按正常工程项目来，不用降级成傻瓜方案。

### 用户已经拍板的决策（不要再问一遍）

| 决策 | 结论 |
|---|---|
| 收哪几家 | Delhaize、Colruyt、Carrefour、ALDI、Lidl，**外加 Albert Heijn**（鲁汶 2025 年新开了一家） |
| Carrefour 店型 | **只要 Market + Express**，不要大卖场（鲁汶没有大卖场，大卖场的货在鲁汶买不到） |
| Delhaize 店型 | 不区分店型，但**不要 Shop&Go** |
| 品类范围 | **全都要**，电器、服饰、日用品也收，不只是食品 |
| 更新方式 | **每周自动**，不依赖用户电脑开机 |
| 架构 | **GitHub Actions 定时抓取 + Vercel 部署**（用户明确选的） |
| 最终形态 | 一个**固定链接**，手机能开，可以分享给鲁汶其他中国学生 |

### 鲁汶的实际门店（决定了该抓哪套数据）

- **Carrefour**：Express ×5（Naamsestraat、Burgemeestersstraat、Brusselsestraat、火车站、Weldadigheid）+ Market ×1（Heverlee, Tervuursesteenweg）。**没有大卖场。**
- **Delhaize**：AD Delhaize（Brusselsestraat 31）、Delhaize Heverlee、Shop&Go（Diestsestraat，不要）
- **Albert Heijn**：Bondgenotenlaan 64，AH 门店号 **3164**，2025-09-24 开业
- Colruyt / ALDI / Lidl：正常门店

---

## 2. 现在到哪一步了

### 两套东西并存，别搞混

**（A）旧方案：已上线，还在跑**

- 云端 Artifact 页面：`https://claude.ai/code/artifact/44d14b3c-89ec-40d6-ad68-0247d059b1a8`
- 数据是**用 LLM 读网页**抓的（WebFetch + 子 agent 读 promotiez.be），2026-09-03 那期共 1433 条
- 有个每周定时任务（周一/周三 05:00 UTC）会重新抓一遍并更新这个页面
- 重建配方存在 Claude Project「折扣组合的可行性研究」里：`claude/rebuild-runbook.md`、`claude/merge.py`、`claude/template.html`
- **这套是过渡方案**，等 B 跑起来之后可以退役

**（B）新方案：正在建，就是这个仓库**

真爬虫 + GitHub Actions + Vercel。**这才是要继续做的东西。**

### 进度表

| 部分 | 状态 | 说明 |
|---|---|---|
| 仓库骨架 | ✅ 完成 | package.json / 目录结构 / .gitignore / vercel.json |
| 折扣力度算法 | ✅ 完成 | `lib/normalize.js`，62 个单测全绿（`npm test`） |
| 品类归并 | ✅ 完成 | `lib/categorize.js`，荷/法/英关键词 → 19 个中文品类 |
| Lidl 抓取 | ✅ 已跑通 | 本周 272 条，去重后 268 条 |
| Colruyt 抓取 | ✅ 已跑通 | 本周 1376 条，去重后 1370 条 |
| Carrefour 抓取 | ✅ 已跑通 | 本周 1680 条，去重后 1673 条 |
| ALDI 抓取 | ✅ 已跑通 | 本周 379 条，去重后 378 条 |
| AH 抓取 | ⛔ 卡住 | ah.be 全站 403，已移出默认抓取清单，见第 4 节 |
| Delhaize 抓取 | ⛔ 未开始 | 见第 4 节 |
| 合并/出页面 | ✅ 完成 | `scripts/build.js`，四家合计去重后 3689 条，有折扣力度 3138 条，品类「其他」405 条 |
| 中文名词表 | ✅ 机制完成，词表是空的 | `scripts/translate.js` + `lib/glossary.json`，还没配 `ANTHROPIC_API_KEY` |
| 网页模板 | ✅ 完成 | `web/template.html`，搜索/筛选/排序都做好了 |
| GitHub Actions | ⚠️ 已补齐，没跑过 | 已加 `npx playwright install --with-deps chromium`，但还没推到 GitHub、没在 CI 里跑过 |
| 推到 GitHub | ⛔ 未做 | 目前没有 remote，等用户点头 |
| Vercel 部署 | ⛔ 未做 | 等仓库上 GitHub |

**一句话总结当前位置**：四家（Lidl、Colruyt、Carrefour、ALDI）端到端跑通了，`npm run refresh` 一次拉完 3689 条，`npm test` 62 个用例全绿。浏览器验收也做过：本地起 `python -m http.server 8765 -d public`，用 Playwright 脚本（`data/debug/check-page.mjs`、`check-search.mjs`，已 gitignore）搜「意面」42 条全是意面没有牙膏，「鸡肉」不再混进猫粮狗粮，「三文鱼」只出 zalm，来源链接全是官方域名，没有 JS 报错，手机视口下布局正常。AH 因为 Akamai 403 卡住，进了 backlog；Delhaize 还没动；还没推到 GitHub，没部署 Vercel，这几步等用户点头。唯一还没做、也只有用户能做的一步：拿真实超市 app 里的传单核对几条价格（见第 7 节第 1 步）。

---

## 3. 仓库结构

```
C:\Projects\Leuven_discount\
├── package.json
├── vercel.json                    # outputDirectory: public
├── README.md
├── .github/workflows/refresh.yml  # 每周一、周三 05:00 UTC
│
├── lib/
│   ├── normalize.js               # 统一 schema + 折扣力度计算 + 去重 + 带重试的 get()
│   ├── categorize.js              # 各店分类名 → 19 个中文品类
│   ├── browser.js                 # Playwright 封装：fetchHTML / fetchJSON / sniff
│   └── glossary.json              # 商品原名 → 中文名（目前是空的 {}）
│
├── scrapers/                      # 每家一个，都导出 default async function，返回 normalize 过的数组
│   ├── lidl.js                    # ✅ 已跑通
│   ├── colruyt.js                 # ✅ 已跑通
│   ├── carrefour.js               # ✅ 已跑通
│   ├── aldi.js                    # ✅ 已跑通
│   └── ah.js                      # ⛔ ah.be 全站 403，见第 4 节
│
├── scripts/
│   ├── scrape.js                  # 跑默认清单的 scraper → data/raw/*.json（单家失败不影响其他家）
│   ├── build.js                   # 合并 + 补中文名 + 出 public/index.html
│   ├── translate.js               # 调 Anthropic API 补中文名，没 key 就跳过
│   ├── inspect-carrefour.js       # 打印 Carrefour 真实 DOM class
│   └── inspect-ah.js              # 用 Playwright 抓 AH bonus 页的 XHR
│
├── web/template.html              # 页面模板，数据用 /*__DATA__*/ 占位符注入
├── data/
│   ├── raw/                       # 各店原始抓取结果 + _report.json
│   ├── latest.json                # 当前数据
│   ├── history/YYYY-MM-DD.json    # 每周快照（→ 天然的价格历史）
│   └── untranslated.json          # 还没中文名的商品名，给 translate.js 用
└── public/index.html              # 构建产物，Vercel 部署这个目录
```

### 统一数据格式

每个 scraper 输出的每条记录（`lib/normalize.js` 的 `normalize()` 产出）：

```js
{
  store: 'Lidl', store_zh: 'Lidl',
  name: '荷/法原名', name_zh: '中文名（build 阶段从词表补，没有就等于 name）',
  brand: '品牌',
  po: 3.98,          // 原价，没有填 null
  pp: 1.99,          // 促销价
  unit: '€6.30/kg',  // 单价，官方接口才有
  dt: '-50%',        // 促销文案原文
  pct: 50,           // 折扣力度（算法见第5节）
  mb: 0,             // 1 = 多件优惠（"第二件半价"这种），页面上不显示划线原价
  unc: 0,            // 1 = 折扣力度存疑，页面显示成"约 -N%"且排序降权
  val: '还剩 5 天', ends: '2026-09-15',
  cat: '粮油面食',    // 19 选 1
  url: '', img: '', id: ''
}
```

---

## 4. 数据源调研结论

**这节是这个项目最值钱的部分，全部实测过，别重新探一遍浪费时间。**

### Lidl（已跑通）

```
GET https://www.lidl.be/q/api/search?assortment=BE&locale=nl_BE&version=2.0.0&fetchsize=1000&store=1
Accept: */*
```

- 免鉴权，裸请求就行。请求头必须是 `Accept: */*`，带 `Accept: application/json` 会间歇性返回 406。
- `fetchsize` 实际被服务端封顶在 108，响应里 `maxfetchsize: 1000` 是假的。`offset=` 又被 robots 禁止，翻页走不通。解法是按响应 `facets[]` 里 `code === 'category'` 的 facet 递归切分（比如 `&category=Voeding+%26+drank`，这类参数 robots 没禁），子请求之间 sleep 800ms，整趟约 10 个请求。本周 `numFound` 278，实际拿到 272 条。
- 品类用 `keyfacts.wonCategoryPrimary`（稳定的品类树路径），不用 `category`（这个字段经常是营销专题名，不是品类）。
- 本周 272 条里只有 92 条带 `percentageDiscount`，其余是本周店内主题商品，仍全部保留。
- `percentageDiscount` 偶尔缺失，只给一个 "Megadeal" 标签，这种情况按划线价（`oldPrice ?? recommendedPrice ?? discount.deletedPrice`）算百分比，不进存疑逻辑。
- **robots 红线**：禁 `offset=` / `sort=` / `q=` / 任何含 `id=` 的参数。
- `mobileapi.lidl.be` / `mobileapi.lidl.nl` DNS 都不解析，网上那些教程是过时的。

### Colruyt（已跑通，走 bucket）

**不要直接打官方 API。** 官方接口是活的：
```
https://apip.colruyt.be/gateway/ictmgmt.emarkecom.cgproductretrsvc.v2/v2/v2/nl/products?clientCode=CLP&page=N&size=250&placeId={id}
```
但要 `X-CG-APIKey` header + 无头浏览器拿的会话 cookie，匿名 IP 10~20 次请求就被 Akamai 封，全量要 ~50 次分页，GitHub Actions 的 IP 当场就挂。

**改用这个**（BelgianNoise 的每日 dump，公开 GCS bucket）：
```
列目录:   https://storage.googleapis.com/colruyt-products/?prefix=colruyt-products/2026-09&max-keys=100
每日全量: https://storage.googleapis.com/colruyt-products/{YYYY-MM-DD-HH-MM-SS}.json
促销详情: https://storage.googleapis.com/colruyt-products/promotions/{techPromoId}.json
```

- bucket 的 key 带目录前缀，实际形如 `colruyt-products/2026-09-09-12-50-03.json`。列目录一定要带 `prefix` 参数，不带的话会被截断在 2000 条只列到 2023 年。当月为空时退回上个月。
- dump 顶层是数组，15586 条。
- 促销详情文件名用 `promotion[].techPromoId`（如 `102715COLR`），不是 `promotion[].promotionId`（纯数字）。
- 日期两种格式混用：促销详情的 `activeEndDate` 是 ISO，商品自带的 `publicationEndDate` 是 `DD-MM-YYYY`。
- 促销详情 `benefit` 目前只见过 `{benefitPercentage, minLimit, limitUnit}` 一种形态。`promotionType` 3 是普通折扣，4 是阶梯折扣（多档 benefit，目前只取第一档，偏保守），`promotionType` 为 0 时 `benefitPercentage` 恒为 0（拼不出文案，本周 89 条）。
- 本周约 209 个唯一促销 id，上限设的 400。
- Colruyt 价格是按门店浮动的（官方 FAQ 说每家店对标本地竞争对手定价），bucket 用的是作者自己那个 placeId，不是鲁汶。**目前接受这个误差。**

### Carrefour（已跑通）

```
https://www.carrefour.be/nl/al-onze-promoties?p=N
```

- 商品卡片是 `div.product.js-product[data-pid]`，每页 40 个，其中 4 个 `.js-einstein-tile` 是推荐位，要排除。商品名在 `.desktop-name`，品牌在 `.brand-wrapper a`，价格在 `.value[content]`，每单位价在 `.price-per-unit-wrapper`，促销文案在 `.promo-label`，有效期在 `.promo-validity-date`（格式 "t.e.m. DD/MM/YYYY"），图片是 `.tile-image` 的 `src` 或 `data-src`（懒加载）。
- 总数读 `data-total-items`（如 `"1680.0"`），本周 47 页，整趟约 5 分钟。
- 品类是码（如 `ros016`），映射表从导航菜单 `[data-gtm-nav-cta="products:rosXXX>名字"]` 每次现解析，不硬编码。
- 促销文案里有 24 种解析不出折扣（`3 voor 6€`、`-1€`、`Bonuspunten` 等），现在前两类能算出来了。
- **robots 红线**：禁 `?pmid=` 和 `/search?q=`，末尾还有兜底 `Disallow: /`（只白名单了 Googlebot 等）。只走 `?p=N`，限速 1-2 秒，带真实 UA。
- 分不出 Market / Express 店型，这是全国线上促销目录，抓到的是超集。**目前接受这个超集。**

### Albert Heijn（卡住，403）

- 本机 curl 和无头 Chromium 对 `www.ah.be` 一律返回 403（Akamai "Access Denied"），连商品详情页也 403，`/zoeken/api/` 是 500。GitHub Actions 的 IP 只会更差。
- `scrapers/ah.js` 保留，但已经移出 `scripts/scrape.js` 的默认清单（放进 `EXTRA`），单独跑 `node scripts/scrape.js ah` 仍然可以执行，只是照样会 403。
- 放进 backlog。可选方案是 Apify 的比利时专用 scraper（付费）或者住宅代理，两个都还没试。

### ALDI（已跑通）

- 裸 fetch 不会被拦（带真实 UA 就行），不需要 Playwright，CI 也不用装浏览器。
- 两个 URL：`https://www.aldi.be/aanbiedingen.html`（本周）和 `https://www.aldi.be/aanbiedingen-volgende-week.html`（下周），中间 sleep 1500ms。`_next/data/{buildId}/...json` 返回的是 HTML，不用走这条路。
- 数据在 `<script id="__NEXT_DATA__">` 里，路径是 `props.pageProps.apiData`（是个 JSON 字符串，要二次 parse），parse 出来的数组里找 `entry[0] === 'OFFER_GET'` 那条，商品字典在 `entry[1].res.algoliaDataMap`，档期分组在 `entry[1].res.categories`。
- 商品字段：`objectID` / `name` / `productSlug` / `salesUnit` / `assets[]` / `categoryIDs[]` / `hierarchicalCategories` / `currentPrice{priceValue, strikePrice.strikePriceValue, basePrice[], priceTagLabels.promoText1, validFrom, validUntil}` / `promotionPrices[]`（含 `validFromLocalDate` / `validUntilLocalDate`）。
- 坑：`validUntilLocalDate` 是排他日，真正最后一天要减 1（385 条对分组 `endDate` 验证全部吻合）；列表里没有 `brand` 字段（详情页才有，要额外 379 次请求，没做）；`priceValue` / `strikePrice` 偶尔反着，取小的那个当付款价；非食品商品没有分类字段，只能靠版块标题判断；本周页已经包含周五周六才开卖的档期，本周/下周按日期算，不按页面分；两页商品 id 零重叠。
- 商品 URL `https://www.aldi.be/product/{productSlug}.html`，图片 `{asset.url}?bfc=on&wid=360&fmt=webp-alpha`。
- 有 bot 防护迹象，但目前没触发过 403。如果哪天触发，把 `scrapers/aldi.js` 取页那部分换成 `lib/browser.js` 的 `fetchHTML()`，解析函数 `extractOffer(html)` 不用动。

### Delhaize（未开始）

- SAP Hybris / SAP Commerce 后端（`/authorizationserver/oauth/token` 返回 401 而不是 404，证实了）
- `/api/v1/*` **一律 403**，连不存在的路径也 403 → 前置反爬网关，不是资源不存在
- 标准 OCC 路径（`/occ/v2/`、`/rest/v2/`、`/ycommercewebservices/`）**全部 404**
- 全站 JS 渲染，分类页/promo 页 HTML 里一个商品都没有
- **robots 红线**：`Disallow: */search/*` 和 `*/search?*`，任何搜索/筛选类 URL 都禁止
- 路线：Playwright 打开分类页，监听 network 把 `/api/v1/...` 的真实 URL 和必需 header（Bearer / cookie / x-*）打印出来，之后才谈得上直接调
- 门店清单没阻力：`stores.delhaize.be` robots 全放行，有 sitemap，400+ 家店
- 旁证：Apify 上 Colruyt/Dirk/AH/Aldi 都有现成 scraper，**唯独没有 Delhaize**；GitHub 上也没有任何 delhaize scraper 开源项目。它确实比同行难搞
- **建议：放到最后做，或者这家继续用旧方案（LLM 读 promotiez.be）兜着**

### 不要用的东西

- **promotiez.be**：旧方案在用，但它 robots.txt 明确 `Disallow: /winkels/*?*` 和 `/promoties/*?*`，正好是分页 URL。偶尔抓没事，**做成每周自动爬站不住**。而且它给的是"整组价"不是单价
- **Colruyt 官方 API 硬刚**：见上，要付费代理池

---

## 5. 关键设计决策（改代码前先看这节）

### 5.1 折扣力度：促销文案优先于价格比

**这是踩过坑改出来的，不要退回去。**

传单上标的"原价"经常是**整组价**。真实案例：北荷兰高达奶酪片标 `€14.98 → €5.99`，直接相除得 -60%，但促销文案是 `2de aan -50%`（第二件半价），**实际优惠只有 25%**。去 Carrefour 官网核对过，那款单价是 €3.69~4.59。

`lib/normalize.js` 的 `effectiveDiscount()` 规则：

| 促销文案 | 折扣力度 |
|---|---|
| `2de aan -50%` / `2ème à -50%` | 25%（`off / n`） |
| `2+2 gratis` | 50%（`free / (buy+free)`） |
| `3+1 gratis` | 25% |
| `-30%` | 30% |
| 小数百分比，如 `3de aan -33.34%` | 11% |
| 两位数买赠，如 `12 + 6 gratis` | 33% |
| `N voor X€`（如 `8 voor 4.99€`） | 每件实付价 X/N，跟单件价对比算折扣，标记为 multibuy |
| `-X€` 直减 | X / 单价 |
| `-X% voor N` | 折扣按 X%，标记为 multibuy |
| 都没有，才用价格比 | `1 - pp/po` |

价格比、或 `N voor X€` / `-X€` 这两类算出的折扣，只要 ≥60% 且没有其他文案佐证，就标 `unc=1`：页面上显示"约 -N%"，排序时按折扣未知处理（rank 0），不再只是简单降权。踩过的坑：`8 voor 4.99€` 标在一个 4 瓶装的商品上，那个"8"指的是单瓶，不是这个 4 瓶装商品要买 8 份。

配套：`mb=1`（多件优惠）的商品**页面上不显示划线原价**，改显示"整组价"，因为那个数字不是可比的"原价"。

### 5.2 中文搜索：查询扩展，不是逐条翻译

**不需要给每个商品都翻译中文名。** 页面里（`web/template.html` 的 `SYN` 常量）有一份中文→荷/法/英同义词表，搜索时把「意面」扩展成 `pasta / spaghetti / penne / fusilli / tagliatelle / lasagne / macaroni` 再去匹配商品原名。

所以**没有中文译名也能搜到**。`lib/glossary.json` 里的译名只影响显示好不好看，会随每周运行慢慢积累（`scripts/translate.js`，配了 `ANTHROPIC_API_KEY` 才跑，翻过的不会重翻）。

**匹配规则**：中文查询按包含匹配；拉丁词按**词首**匹配（`\bpasta`）。这样搜 `pasta` 不会命中 `tandpasta`（牙膏），这是实际踩到的问题。词首匹配是有意的，因为 `kip` 要能命中 `kipfilet`。

### 5.3 品类归并：toCat() 的匹配规则

关键词 trim 后如果长度小于等于 4 个字母，按词首或词尾命中都算（荷兰语复合词的中心词往往在词尾，`kokosmelk` / `abdijkaas` 要能命中；但 `shampoo` 里的 `ham` 不能算命中）。`pasta`、`eau`、`ijs` 这三个关键词单独处理，只认词首匹配，因为 `tandpasta`（牙膏）、`bureau`（办公桌）、`knalprijs`（爆炸价）都是靠词尾巧合撞上的假阳性。长度大于等于 5 个字母的关键词仍然走子串匹配。`roomijs`（归到零食甜点）和 `fruitsap`（归到饮料）这两个走 `OVERRIDES` 特例表，不走通用规则。带尾部空格的老关键词（比如 `'ei '`）保留原来的纯词首匹配方式。

### 5.4 去重

按 `店 + 中文译名(或原名) + 原价 + 促销价` 去重。ALDI 的荷/法双语重复条目会被中文译名合并掉。本周实测：Lidl 272→268、Colruyt 1376→1370、Carrefour 1680→1673、ALDI 379→378。

### 5.5 页面设计

`web/template.html` 已经做完了，包含中文搜索框、常用词快捷键、按超市/品类筛选、按折扣力度或价格排序、明暗主题、手机优先。**不要重写设计**，改功能就行。数据用 `/*__DATA__*/` 占位符注入。

店名映射按 `store` 这个英文 key 走（`STORE_LABEL`），筛选值用的也是 `store`，`meta.stores` 也按 `store` 计数。同义词表查找时精确 key 优先命中，没有精确 key 才做包含式扩展。搜食品类词时会排除 `cat === '宠物'` 的商品，但如果查询本身包含猫、狗、宠这些字，或者扩展出了 kat / hond 这类词，或者用户直接选了宠物品类做筛选，就不排除。来源链接指向官方商品页：Carrefour 是促销页链接，ALDI 是 aanbiedingen 页链接，Lidl 和 Colruyt 目前只能链到首页。页面顶部的统计条文案是「N 件本周促销 / N 件标了折扣 / N 件五折起 / 更新于...」。商品名可以点击跳到官网。

---

## 6. 已知卡点

### 6.1 推 GitHub、部署 Vercel：等用户

git 锁文件已清，占位 remote 已删，目前仓库没有 remote。gh CLI 本机已登录账号 `Alanine4`。建 GitHub 仓库、推送、Vercel 导入（Output Directory 填 `public`）、手动触发一次 Actions，这几步都等用户点头。

### 6.2 Albert Heijn 全站 403

本机 curl 和无头 Chromium 对 `www.ah.be` 一律 403（Akamai "Access Denied"），GitHub Actions 的 IP 只会更差，不是本地网络的问题。`scrapers/ah.js` 已移出默认抓取清单。backlog 里两个可选方案是 Apify 的比利时专用 scraper（付费）和住宅代理，都还没试，见第 4 节。

### 6.3 Delhaize 未开始

原调研结论保留（见第 4 节）：SAP Hybris 反爬网关，标准 OCC 路径全 404，全站 JS 渲染。建议放到最后做，或者这家继续用旧方案（LLM 读 promotiez.be）兜着。

---

## 7. 下一步做什么（按顺序）

1. 用户在超市 app 里随便挑 5 条对价（Carrefour 尤其要对，它是全国目录，抓到的是超集）。
2. 建 GitHub 仓库、推送、Vercel 导入、手动触发一次 GitHub Actions。
3. 配 `ANTHROPIC_API_KEY` secret，让中文词表开始积累。
4. 做 Delhaize；AH 看是否值得走付费方案。

---

## 8. Backlog / 还没做的

- **Colruyt 阶梯折扣**：`promotionType` 为 4 的多档 benefit 目前只取第一档，偏保守，会低估部分折扣力度。
- **ALDI 无品牌字段**：需要额外 379 次详情页请求才能拿到，没做。「下周起」这套逻辑只在周四抓的数据上验证过。
- **品类「其他」占比偏高**：3689 条里 405 条（11%）落进「其他」，主要是 Colruyt 的 "Niet-voeding" / "Kruidenierswaren/Droge voeding" 泛类目，和 ALDI 营销版块下没有分类字段的商品。
- **咖啡茶品类样本极少**：只有 2 条，怀疑是 Carrefour 的咖啡分类名没被关键词表命中，还没查。
- **单店模式会覆盖 report**：`node scripts/scrape.js lidl` 这种单店跑法会把 `data/raw/_report.json` 覆盖成只剩这一家的记录，CI 是全量跑不受影响，但本地单独调试某一家时别把这个当整体状态判断。
- **Carrefour 店型过滤**：现在拿到的是全国超集，鲁汶只有 Market/Express，没想到好办法。
- **Colruyt 鲁汶门店价**：现在用的是 bucket 里别人那个 placeId 的价格。
- **价格历史对比**：`data/history/` 每周一个快照，天然有数据了，可以做「这周是不是真便宜、比上个月的价格如何」这类判断，用户提过想要。
- **中文词表积累**：`lib/glossary.json` 现在是空的，配了 `ANTHROPIC_API_KEY`（见第 7 节第 3 步）之后每周自动补。
- **旧方案退役**：新链接稳定后，把那个 Claude 定时任务（`trig_01AtinoEkmHgD75MjtWmc7So`）停掉。
- 用户提过的小功能：「只看食品」开关、收藏常买商品。

---

## 9. 合规注意事项（别写出会被封的爬虫）

| 站点 | 红线 |
|---|---|
| Lidl | 禁 `offset=` / `sort=` / `q=` / 含 `id=` 的参数；`fetchsize` 服务端封顶 108，靠按 category facet 递归切分拉完 |
| Carrefour | 禁 `?pmid=` 和 `/search?q=`；robots 末尾有兜底 `Disallow: /`。只走 `?p=N`，限速 1-2 秒 |
| Delhaize | 禁 `*/search/*` 和 `*/search?*` |
| ALDI | 禁 `/*?*filters`（不要走分类筛选 URL）、`/mds/`、`/bal/`、`/can/` |
| Colruyt | `crawl-delay: 5`；官方 API 有主动反爬（别硬刚，走 bucket） |
| AH | `api.ah.nl` 全站 Disallow；`www.ah.be/zoeken/api/` 是允许的，但目前会 500 或 403 |
| promotiez.be | 禁带 query 的 `/winkels/*?*` 和 `/promoties/*?*`。**不要做成自动爬** |

通用：每周只跑一两次，带真实 UA，请求之间留 1-2 秒，别并发轰。

---

## 10. 验收标准

做完了应该是这样：

- 一个 Vercel 链接，手机打开能用
- 至少 4 家超市（Lidl、Colruyt、Carrefour、AH）的本周促销，1000 条以上
- 搜「意面」出的是意面不是牙膏；搜「鸡肉」能出 kip/poulet 的商品
- 折扣力度经得起推敲，随便挑 5 条跟超市 app 里的传单对一遍，价格和促销方式对得上
- GitHub Actions 每周一、周三自动跑完并提交，Vercel 自动重新部署，**链接不变**
- 某一家抓挂了，其他家照常出页面（`scripts/scrape.js` 已经是这个逻辑），`data/raw/_report.json` 里能看到哪家挂了
