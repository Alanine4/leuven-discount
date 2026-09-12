# 鲁汶折扣雷达：交接文档

> 给接手的 Claude Code 看的。项目目录 `C:\Projects\Leuven_discount`。
> 最后更新：2026-09-12

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
| 折扣力度算法 | ✅ 完成 | `lib/normalize.js`，`npm test` 95 个用例全绿 |
| 品类归并 | ✅ 完成 | `lib/categorize.js`，荷/法/英关键词 → 19 个中文品类 |
| Lidl 抓取 | ✅ 已跑通 | 本周（09-12 抓）220 条 |
| Colruyt 抓取 | ✅ 已跑通 | 本周（09-12 抓）1275 条 |
| Carrefour Market 抓取 | ✅ 已跑通 | 本周（09-12 抓）965 条，见第 4 节 |
| Carrefour Express 抓取 | ✅ 已跑通 | 本周（09-12 抓）91 条，覆盖率比 Market 低，见第 4 节 |
| ALDI 抓取 | ✅ 已跑通 | 本周（09-12 抓）326 条 |
| AH 抓取 | ✅ 已跑通 | 本周（09-12 抓）124 条，周六起接口已同时带出下周（见第 7 节）；靠有头浏览器绕过 Akamai，见第 4 节；CI 里的 xvfb 方案还没实测过，见第 7 节 |
| Delhaize 抓取 | ✅ 已跑通 | 本周（09-12 抓）1316 条，靠有头浏览器绕过 Akamai + 重放促销页的 GraphQL persisted query，见第 4 节 |
| 合并/出页面 | ✅ 完成 | `scripts/build.js`，六家本周（09-12 抓）合计 3001 条 |
| 中文名词表 | ✅ 已冷启动 | `lib/glossary.json` 现有 3667 条（人工分批翻译写入），本周约 95% 商品有中文名；新品的增量翻译仍靠 `scripts/translate.js`，还没配 `ANTHROPIC_API_KEY` |
| 网页模板 | ✅ 完成 | `web/template.html`，搜索/筛选/排序都做好了 |
| GitHub Actions | ⚠️ 已推上去，AH 那部分还没在 CI 里跑过 | 已加 `npx playwright install --with-deps chromium` 和 `xvfb`，抓取步骤用 `xvfb-run` 包一层；定时改成周一到周四每天两次（`cron: '0 5 * * 1-4'` 和 `'0 14 * * 1-4'`），也可以在 Actions 页手动 workflow_dispatch |
| 推到 GitHub | ✅ 完成 | https://github.com/Alanine4/leuven-discount ，公开仓库，分支 `main` |
| Vercel 部署 | ✅ 完成 | https://leuven-zhekou.vercel.app ，项目名 `leuven-zhekou`（团队 Yichuan's projects），推送即自动部署 |

**一句话总结当前位置**：七家（Lidl、Colruyt、ALDI、Carrefour Market、Carrefour Express、Albert Heijn、Delhaize）端到端跑通了，`npm run refresh` 本周（09-12 抓）一次拉完 4325 条，`npm test` 110 个用例全绿。浏览器验收也做过：本地起 `python -m http.server 8765 -d public`，用 Playwright 脚本（`data/debug/check-page.mjs`、`check-search.mjs`，已 gitignore）搜「意面」42 条全是意面没有牙膏，「鸡肉」不再混进猫粮狗粮，「三文鱼」只出 zalm，来源链接全是官方域名，没有 JS 报错，手机视口下布局正常。AH 靠有头浏览器绕过了 Akamai（见第 4 节），但这个方案还没在 GitHub Actions 的 CI 环境里实测过；Delhaize 09-12 接上了，路子和 AH 一样（有头浏览器 + 同源重放，见第 4 节），CI 里同样没验过。仓库在 GitHub（Alanine4/leuven-discount），线上链接 https://leuven-zhekou.vercel.app ，推送自动部署。下一步见第 7 节，第一件事是手动触发一次 Actions 确认 AH 在 CI 里能不能过 Akamai。

### 审计方法

09-12 这次更新做了一轮数据审计：先每家抽 5 条跟官网对，再挑几家加大样本做全量字段交叉比对（AH 68 条、ALDI 378 条、Colruyt 1368 条、Lidl 105 条）。结果是 AH 全部一致，ALDI 除了「N voor X」这一类促销文案外一致，Carrefour 抽样也一致；真正有问题的地方集中在价格字段的语义理解上，不是抓取或解析错误，具体是什么问题、怎么改的写在第 5.1 节。审计脚本放在 `data/debug/`（已 gitignore）。

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
│   └── glossary.json              # 商品原名 → 中文名（现有 3667 条，人工分批写入）
│
├── scrapers/                      # 每家一个，都导出 default async function，返回 normalize 过的数组
│   ├── lidl.js                    # ✅ 已跑通
│   ├── colruyt.js                 # ✅ 已跑通
│   ├── carrefour.js               # ✅ 已跑通
│   ├── aldi.js                    # ✅ 已跑通
│   ├── ah.js                      # ✅ 已跑通，有头浏览器绕过 Akamai，见第 4 节
│   └── delhaize.js                # ✅ 已跑通，同样有头浏览器 + 重放 GraphQL，见第 4 节
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
- 促销详情 `benefit` 目前只见过 `{benefitPercentage, minLimit, limitUnit}` 一种形态。`promotionType` 3 是普通折扣，4 是阶梯折扣（多档 benefit，2026-09-12 起改成取比例最大的一档，此前是只取第一档，偏保守；`benefitPercentage`/`minLimit` 的语义和折扣力度算法见第 5.1 节），`promotionType` 为 0 时 `benefitPercentage` 恒为 0（拼不出文案，本周 89 条）。
- 本周约 209 个唯一促销 id，上限设的 400。
- Colruyt 价格是按门店浮动的（官方 FAQ 说每家店对标本地竞争对手定价），bucket 用的是 dump 作者那个 placeId，不是鲁汶。**现在在 normalize 之前用官方接口按鲁汶店价覆盖一遍**（折扣力度要用覆盖后的价格算），见下。

#### 鲁汶店价覆盖（`overlayStorePrices()`，2026-09-12 加）

```
GET https://apip.colruyt.be/gateway/ictmgmt.emarkecom.cgproductretrsvc.v2/v2/v2/nl/products
    ?placeId=684&clientCode=clp&size=250&productIds=13240,1288921,...
Header: X-CG-APIKey: <key>；再带真实 Chrome UA、Accept: application/json、
        Accept-Language: nl-BE、Origin: https://www.colruyt.be、Referer: https://www.colruyt.be/
```

- **门店**：鲁汶 Lombaardenstraat 2 是 placeId **684**（用这个）；Heverlee Groenveldstraat 71 是 **605**。
- **匿名可用**，不用 cookie、不用无头浏览器，只要那个 header。key 写在商品页 HTML 的 `<div id="endpoints" data-endpoints="...">` 里（`PRODUCT_OVERVIEW` 条目的 `headers: ["X-CG-APIKey: ..."]`），属性值是 HTML 转义过的 JSON，**实体是 `&#34;` 不是 `&quot;`**，两种都先还原再正则。`fetchApiKey()` 每次从 `https://www.colruyt.be/nl/producten/26327` 现读，读不到回落硬编码 `a8ylmv13-b285-4788-9e14-0f79b7ed2411`（key 可能随发版轮换）。
- **批量参数两种都实测通**（各打 1 次，5 个 id，都是 200，5/5 返回）：`productIds=`（按 productId，bucket 里的 `productId`，就是 schema 里的 `id`）和 `commercialArtnos=`（按商品页那个号）。代码用 `productIds`。顶层结构是 `{productsFound, productsReturned, productsAvailable, products:[...], facets}`，**不是裸数组**（代码两种都认）。
- **每批 250 个 id**（250 个 id 的 URL 约 1.9 KB，实测 `productsFound=250 / productsReturned=250`，没有服务端截断），批与批之间 sleep 5 秒（robots `crawl-delay: 5`）。本周 1384 条促销 = **每次抓取 6 个 apip 请求**。
- **只覆盖 `price.basicPrice` 和 `measurementUnitPrice`**（促销信息全国统一，bucket 和接口逐字节相同，只有价格按店浮动）。
- **降级策略**：任何一批非 200 / 超时（20 秒）/ 解析失败，只打 warn 并保留这批的 bucket 价，不抛错；整体失败也照样出数。`fetchApiKey()` 失败同理。
- **本周实测结果**：`鲁汶店价覆盖 1049/1384 条，改动 11 条`。没覆盖到的 335 条是**鲁汶店不卖**（接口返回了这个商品但 `price` 里没有 `basicPrice`，同一批的 `productsAvailable` 也对得上：第一批 250 个里 235 个可售），这些保留 bucket 价。改动的 11 条**全是 bucket 里 `basicPrice` 为 0（等于没价）、接口给出了真实价**的商品（如 `BEAUX-PRÉS cremeux 150g` 0 → 4.49），这些以前会被 `scripts/build.js` 当空价丢掉。其余 1038 条覆盖后价格和 bucket 一模一样 —— 说明**促销商品的价格实际上是全国统一的**，门店浮动主要发生在非促销商品上。抽样核对：`ACTIVIA yoghurt vanillesmaak 4x125g`（productId 13240）鲁汶店 2.09，和门店实测一致。
- schema 没动（没加"价格来自哪个店"这种字段），哪条被覆盖过只在这份文档里说明。

### Carrefour（已跑通，拆成 Market / Express 两个 store）

不再抓全国目录 `al-onze-promoties`（1680 条，含大卖场独有商品，鲁汶用不上）。改抓店型专用促销页，DOM 结构和全国目录完全一样：

```
https://www.carrefour.be/nl/al-onze-market-promoties?p=N   # 本周 958 条，27 页
https://www.carrefour.be/nl/al-onze-express-promoties?p=N  # 本周 92 条，3 页
```

`al-onze-hyper-promoties` 是 404。输出两个 store：`Carrefour Market`（`store_zh` 是 `家乐福 Market`）和 `Carrefour Express`（`家乐福 Express`），同一商品在两个店各保留一条（`normalize()` 按 store 去重不会合并）。整趟约 2 分钟。

- 商品卡片是 `div.product.js-product[data-pid]`，每页 40 个，其中 4 个 `.js-einstein-tile` 是推荐位，要排除。商品名在 `.desktop-name`，品牌在 `.brand-wrapper a`，价格在 `.value[content]`，每单位价在 `.price-per-unit-wrapper`，促销文案在 `.promo-label`，有效期在 `.promo-validity-date`（格式 "t.e.m. DD/MM/YYYY"），图片是 `.tile-image` 的 `src` 或 `data-src`（懒加载）。
- Express 页面本身大多数商品不标折扣文案和有效期（有 `pct` 的约 17%、有 `ends` 约 20%），Market 96% 以上。这是数据源本身的限制，不是解析漏了。
- 商品名偶尔是 Latin-1 乱码（`PralinÃ©`），`parsePage()` 里已按字节还原。原名里还混着西里尔字母的错字（如 `Кір` 应为 `Kip`），这是源数据本身的问题，没有处理。
- 总数读 `data-total-items`（如 `"958.0"`）。
- 品类是码（如 `ros016`），映射表从导航菜单 `[data-gtm-nav-cta="products:rosXXX>名字"]` 每次现解析，不硬编码。
- 促销文案里有 24 种解析不出折扣（`3 voor 6€`、`-1€`、`Bonuspunten` 等），现在前两类能算出来了。
- **robots 红线**：禁 `?pmid=` 和 `/search?q=`，末尾还有兜底 `Disallow: /`（只白名单了 Googlebot 等）。只走 `?p=N`，限速 1-2 秒，带真实 UA。

### Albert Heijn（已跑通，靠有头浏览器绕过 Akamai）

- 根因：ah.be 挂 Akamai Bot Manager，按浏览器指纹拦，`headless` 是判据。curl、Playwright 无头（含 headless shell 和无头 Edge）一律 403，**有头浏览器能过**。
- 方案：`lib/browser.js` 新增 `headedBrowser()` / `headedPage()`，依次尝试 `channel:'msedge'` → `'chrome'` → 自带 chromium，都是 `headless:false` + `--disable-blink-features=AutomationControlled`，有头 context 不覆盖 UA（真实指纹才能过）。`scrapers/ah.js` 有头打开 `https://www.ah.be/bonus`，再在 `page.evaluate()` 里同源 `fetch('/gql')`。
- 接口：`POST https://www.ah.be/gql`，GraphQL 查询 `bonusCategories(filterSet: WEB_CATEGORIES, input: $input)`，`variables.input` 里 `states:["NONE","ACTIVATED","ASSIGNED"]`、`segmentType:["NEGATE_PREMIUM"]`、`hideVariants:true`、`forcePromotionVisibility:true`。**`weekNumber` 参数无效**（37 改 38 返回同一批），真正的过滤器是 `periodStart`/`periodEnd`，两者留 null 会返回本周 + 下周的并集，所以只发 1 次请求。本周返回 23 个品类 82 组促销，排除 14 组网购送货优惠（`gratis levering`）后剩 68 条。
- 字段：每个 promotion 是一组（可能多商品，看 `productCount`），单品时 `product` 非空（含 `brand`、`webPath`）。`price.was`/`price.now` 是**同一份量的整组价**（`3 voor 5.00` → now 5.00，was 6.87），所以折扣直接走价格比，不套 Carrefour 那套"N voor €X"/"€N korting"文案换算逻辑；`%korting` → `-N%`、`N+M gratis` 原样、`2e halve prijs` → `2de aan -50%`。本周 68 条 `pct` 和价格比全部一致，`unc` 0 条。
- CI：`.github/workflows/refresh.yml` 加了 `sudo apt-get install -y xvfb`，抓取步骤改成 `xvfb-run -a --server-args="-screen 0 1280x800x24" npm run scrape`。**这个方案还没在 CI 里跑过**（要手动触发一次 Actions 验证，见第 7 节）；未验证的点是 GitHub runner 的出口 IP 会不会被 Akamai 单独拦。
- `scripts/scrape.js` 里 `ah` 已经回到默认清单 `SOURCES`（排最后，因为它要开有头浏览器）。
- 只在周四这一天观测过：`periodStart:null` 返回并集、`weekNumber` 无效、价格是整组价，都没有跨周样本验证。如果周六 AH 发布下周传单后行为变了，下周的数据可能会漏；代码里"下周起"的文案分支已经写好，但没实测过。
- `unit` 恒为空（接口不给每公斤价）；`salesUnitSize` 拼进了 `name`。
- 探针脚本在 `data/debug/`（已 gitignore）：`probe-ah-headed.mjs`、`probe-ah-full.mjs`、`probe-ah-week.mjs`、`probe-ah-period.mjs`。

### ALDI（已跑通）

- 裸 fetch 不会被拦（带真实 UA 就行），不需要 Playwright，CI 也不用装浏览器。
- 两个 URL：`https://www.aldi.be/aanbiedingen.html`（本周）和 `https://www.aldi.be/aanbiedingen-volgende-week.html`（下周），中间 sleep 1500ms。`_next/data/{buildId}/...json` 返回的是 HTML，不用走这条路。
- 数据在 `<script id="__NEXT_DATA__">` 里，路径是 `props.pageProps.apiData`（是个 JSON 字符串，要二次 parse），parse 出来的数组里找 `entry[0] === 'OFFER_GET'` 那条，商品字典在 `entry[1].res.algoliaDataMap`，档期分组在 `entry[1].res.categories`。
- 商品字段：`objectID` / `name` / `productSlug` / `salesUnit` / `assets[]` / `categoryIDs[]` / `hierarchicalCategories` / `currentPrice{priceValue, strikePrice.strikePriceValue, basePrice[], priceTagLabels.promoText1, validFrom, validUntil}` / `promotionPrices[]`（含 `validFromLocalDate` / `validUntilLocalDate`）。
- 坑：`validUntilLocalDate` 是排他日，真正最后一天要减 1（385 条对分组 `endDate` 验证全部吻合）；列表里没有 `brand` 字段（详情页才有，要额外 379 次请求，没做）；`priceValue` / `strikePrice` 偶尔反着，取小的那个当付款价；非食品商品没有分类字段，只能靠版块标题判断；本周页已经包含周五周六才开卖的档期，本周/下周按日期算，不按页面分；两页商品 id 零重叠。
- 商品 URL `https://www.aldi.be/product/{productSlug}.html`，图片 `{asset.url}?bfc=on&wid=360&fmt=webp-alpha`。
- 有 bot 防护迹象，但目前没触发过 403。如果哪天触发，把 `scrapers/aldi.js` 取页那部分换成 `lib/browser.js` 的 `fetchHTML()`，解析函数 `extractOffer(html)` 不用动。

### Delhaize（已跑通，2026-09-12 实测，和 AH 一个套路）

**之前"403 是前置反爬网关"的结论只对了一半**：挡人的不是 Hybris，是 Akamai Bot Manager
（响应里发 `bm_sz` / `_abck` / `ak_bmsc` / `bm_sv`，和 ah.be 同一套）。有头浏览器打开页面后，
在 `page.evaluate` 里同源 `fetch` 一律 200。裸 curl / 无头照样 403。

**促销页真实 URL**：`https://www.delhaize.be/nl/Promolandingpage`
（首页导航里那个"Promoties"链接就是它；交接文档里猜的 `/nl/promotions` 是 404。
`https://www.delhaize.be/nl/folder` 是 Publitas 的电子传单，商品数据在
`view.publitas.com/.../hotspots_data.json`，不用它 —— 接口那条路数据全得多。）

**接口**（GraphQL，Apollo persisted query，走 GET）：

```
GET https://www.delhaize.be/api/v1/?operationName=ProductList
    &variables={"productListingType":"PROMOTION_SEARCH","lang":"nl",...,"lazyLoadCount":48,
                "pageNumber":0,"sort":"categoryOrder","hideProductsWithoutPromo":false,
                "hideUnavailableProducts":true,"customerSegment":"newPromoPageSegment"}
    &extensions={"persistedQuery":{"version":1,"sha256Hash":"ef54fc2d…"}}
Header: x-apollo-operation-name: ProductList     ← 不带会被 Apollo 的 CSRF 拦成 400
        （cookie 靠 credentials:'include' 自带，Akamai 那几个就在里面）
```

- **只能重放，发不了自定义查询**：服务端只认注册过的 persisted query 哈希。哈希跟前端构建版本绑定，
  所以 `scrapers/delhaize.js` 每次跑都从促销页首屏自己发的那个 ProductList 请求里现读
  （`lib/browser.js` 的 `headedPage()` 新增了 `onPage` 钩子，监听器要赶在 `goto` 之前挂上），
  读不到才退回硬编码的 `FALLBACK_HASH`。
- **不必带 Bearer**：匿名就能拿全量促销，不需要登录用户 token。促销本身几乎全是
  `redemptionLevel: "MEMBER"`（要 SuperPlus 卡），但接口不要求登录也能看到。
- **`lazyLoadCount` 服务端封顶 48**（60/100/200/500 一律 500 `BAD_USER_INPUT`），`pageNumber` 从 **0** 开始。
  本周 `totalResults` 1358 = 29 页，**一趟 29 个请求**，页间 sleep 1600ms，整趟约 70 秒。
  （交接任务里写的"总请求 ≤ 15"做不到，是服务端页长上限决定的。）
- **robots 不碰红线**：禁的是 `*/search/*` 和 `*/search?*`，这里走的是 `/api/v1/?operationName=…`，
  路径里没有 search 段；也不走任何 `/nl/shop` 筛选 URL。另外 `Disallow: /en/`，只用 `/nl`。

**商品字段**（`data.productList.products[]`）：

| 要的东西 | 字段 |
|---|---|
| 名称 | `name`（含 ` \| ` 分隔符，要换成空格）；份量在 `price.supplementaryPriceLabel2`（"400 gr"） |
| 品牌 | `manufacturerName`（覆盖率 100%） |
| 货架单件价 | `price.value` |
| 折后单件价 | `price.discountedPriceFormatted`（`"€3,19"`，**直接打折时才小于货架价**） |
| 每公斤/每升价 | `price.supplementaryPriceLabel1`（`"9,98 €/kg"`，覆盖率 100%） |
| 促销文案 | `potentialPromotions[0].description`（`simplePromotionMessage` / `title` 兜底） |
| 有效期 | `potentialPromotions[0].endDate` / `startDate`，`"16/09/2026 21:59:00"` 是 **UTC**，21:59Z = 布鲁塞尔当天 23:59，所以日期部分直接就是最后一天 |
| 分类 | `firstLevelCategory.name`（19 个顶层分类） |
| 图片 | `images[]` 里 `format` 为 `small` / `respListGrid` 的，是相对路径，要拼 `https://www.delhaize.be` |
| 商品页 | `url`，同样是相对路径 |
| 商品号 | `code`（如 `F2023070400122920000`） |

- **价格语义**：`price.value` 是**货架单件价**。直接打折（`-20%`）时 `discountedPriceFormatted` 是折后单价，
  这时 `po` = 货架价、`pp` = 折后价；多件促销（`1+1 gratis`、`2de tegen -50%`）时它**等于货架价**，
  这时 `po` 留空、`pp` = 单件价（和 Carrefour 一个语义，页面显示"单件价"）。
  `po` 不能填成和 `pp` 一样的数 —— `normalize()` 里"两价相等就判 0%"那条会把折扣清零。
  `wasPrice` 全库为 null，`showStrikethroughPrice` 只有 15 条为 true 且都另有促销，没用上。
- **促销文案形态**（本周 1353 条的全部形态，`scrapers/delhaize.js` 的 `promoText()` 负责改写成
  `effectiveDiscount()` 认识的写法）：

| 接口原文 | 条数 | 改写成 |
|---|---|---|
| `1+1 gratis` / `2+1 gratis` / `2+2 gratis` | 712 | 原样（`simplePromotionMessage` 里有下划线写法 `1+1_gratis`，要还原成空格） |
| `2de tegen -50%` / `2de tegen -70%` | 404 | 原样 |
| `-25%` | 76 | 原样 |
| `3 voor €5` | 46 | `3 voor 5€`（€ 必须挪到数字后面才吃得到 `mVoorX`） |
| `-25% voor 3` | 34 | 原样 |
| `- €3` | 34 | `-3€` |
| `3=gratis levering` | 26 | **丢弃**，网购免运费不是商品折扣（AH 那边同样处理） |
| `- €6 voor 2` | 9 | `-6€ voor 2` |
| `€6` | 1 | 原样（算不出，退回价格比） |
| 空（无促销） | 11 | 没有降价的直接丢弃 |

- **品类**：`Zoete kruidenierswaren` / `Zoute kruidenierswaren`（甜/咸杂货）是大杂烩标签，
  巧克力、薯片、意面、酱料全在里面；而且 `kruidenier`（杂货商）会被 `toCat()` 的 `kruid`（香料）
  关键词撞上、`zoute` 会被 `zout`（盐）撞上，直接归成"调味酱料 / 粮油面食"。`scrapers/delhaize.js`
  把这两个顶层名当作没有分类，交给 `toCatWithName()` 用商品名判断。**同一个假阳性 Colruyt 那边也有**
  （`toCat('Kruidenierswaren/Droge voeding')` → 调味酱料），没动 `lib/categorize.js`，见第 8 节。
- **不区分店型**：接口里没有 AD / Proxy / Shop&Go 字段，`deliveryType` 只有配送方式，`promotionThemes` 全空。
  这批是全国统一的线上促销目录，鲁汶两家店（AD Brusselsestraat、Heverlee）都适用；
  **也就是说"排除 Shop&Go 独有促销"这件事做不到，数据源根本不给店型**。
- **Akamai 偶尔把某一页挂住不给响应**（不是 403，就是一直 pending）。代码里每页套了 90 秒硬超时 + 一次重试。

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

### 5.1.1 各家价格字段的语义（2026-09-12 审计后补）

这轮审计发现，几家超市的 `po`/`pp` 和促销字段代表的不是同一种"价"，之前对 Colruyt 的理解是错的，已经改。

- **Colruyt**：bucket 促销详情 `benefit[{benefitPercentage, minLimit}]` 里，`benefitPercentage` 是整笔促销的减免比例，`minLimit` 是达到这个折扣需要买的件数（门槛件数），不是"第 N 件打 X 折"里的那个 N。证据：`minLimit:1` 的记录对应直接打折 `-25%`；`benefitPercentage` 约 33.34% 且 `minLimit` 为 3 的记录有 251 条，对应买三付二；阶梯促销（`promotionType` 为 4，有多档 benefit）按这个读法算出来的折扣是逐档递增的，逻辑自洽。之前的算法把 `benefitPercentage` 当成"第 N 件打 X 折"里的 X，再除以 `minLimit` 换算成整体折扣，结果把这 1257 条记录的折扣力度压低到了 2% 到 13%，明显偏低，是个理解上的错误，不是解析漏了什么。现在已经改成直接读 `pct = benefitPercentage`，不再除以 `minLimit`。促销文案由 `scrapers/colruyt.js` 里的 `benefitText()` 生成：`minLimit<=1` 时写成 `-X%`；如果这个比例正好等于 `m/(n+m)` 并且 `n+m` 等于 `minLimit`，就写成 `n+m gratis`；其余情况写成 `-X% bij N stuks`；阶梯促销取比例最大的一档。`lib/normalize.js` 里 `Nde aan -X%` 这条规则没有改，Carrefour 的 `2de aan -70%` 在官网核实过确实是第二件打折，这个理解本来就是对的，不受这次修复影响。**这个 Colruyt 语义判断是从数据结构反推出来的，目前还没拿一条实物门店标签核对过**，用户下次去 Colruyt 时留意一下类似 `2+1 gratis` 的标签跟页面显示是否一致就能确认。
- **Colruyt 的 `pp` 是货架价**：遇到多件促销时，`pp` 是单件的价格（页面上标"单件价"）；遇到直接打折时，当天 dump 里的 `basicPrice` 已经是折后价格。所以现在把定时抓取多加了一次 14:00 UTC：bucket 当天的 dump 大概要到 12:46 UTC 才落地，早上 5 点那次抓到的其实是前一天的数据。
- **Carrefour**：`pp` 是单件价（页面上标的也是"单件价"），但 `-2€` 这种直接减价的基准价是折前还是折后，目前还没有核实。
- **AH / ALDI**：`po`/`pp` 是同一份量的整组价（页面标"整组价"）。ALDI 的"`N voor X euro`"这种文案（比如"2 voor 2 euro"）里，`strikePrice` 是这 N 件的总价，不是单件价；`scrapers/aldi.js` 现在改成按单件的挂牌价来算折扣（比如单价 2.58 欧、2 件卖 2 欧，算出来是 61% 的折扣）。
- **Lidl**：促销截止日期现在优先用 `price.endDate`（这是促销价结束的日期，ISO 格式 `2026-09-15T22:00Z`，换算成布鲁塞尔时间正好是 09-16 零点；直接按 UTC 切片读出的 `09-15` 就是最后一天还能买的日期，读法是对的）。之前用的 `storeEndDate` 是商品下架日，会比真实的促销截止日晚 7 到 14 天。

### 5.2 中文搜索：查询扩展，不是逐条翻译

**不需要给每个商品都翻译中文名。** 页面里（`web/template.html` 的 `SYN` 常量）有一份中文→荷/法/英同义词表，搜索时把「意面」扩展成 `pasta / spaghetti / penne / fusilli / tagliatelle / lasagne / macaroni` 再去匹配商品原名。

所以**没有中文译名也能搜到**。`lib/glossary.json` 里的译名只影响显示好不好看，现在已经冷启动过：由 6 个子 agent 分批人工翻译现有商品名写入，现有 3667 条，本周约 3128 条商品里约 95% 有中文名。页面显示中文名在上、原名在下。每周新商品的增量翻译仍靠 `scripts/translate.js`（模型 ID 已更新为 `claude-opus-5`），配了 `ANTHROPIC_API_KEY` 才跑（还没配），翻过的不会重翻。

已知质量问题：品牌译法各批不一致（有的用中文商标名如「克特多金象」，有的保留原文）；约 25 条无品牌无上下文的条目是猜的（已标注，如「Red 70 cl」「Complete Fresh」）；`data/untranslated.json` 里现在剩的是家乐福店型页新出现的商品名。

**匹配规则**：中文查询按包含匹配；拉丁词按**词首**匹配（`\bpasta`）。这样搜 `pasta` 不会命中 `tandpasta`（牙膏），这是实际踩到的问题。词首匹配是有意的，因为 `kip` 要能命中 `kipfilet`。

### 5.3 品类归并：toCat() 的匹配规则

关键词 trim 后如果长度小于等于 4 个字母，按词首或词尾命中都算（荷兰语复合词的中心词往往在词尾，`kokosmelk` / `abdijkaas` 要能命中；但 `shampoo` 里的 `ham` 不能算命中）。`pasta`、`eau`、`ijs` 这三个关键词单独处理，只认词首匹配，因为 `tandpasta`（牙膏）、`bureau`（办公桌）、`knalprijs`（爆炸价）都是靠词尾巧合撞上的假阳性。长度大于等于 5 个字母的关键词仍然走子串匹配。`roomijs`（归到零食甜点）和 `fruitsap`（归到饮料）这两个走 `OVERRIDES` 特例表，不走通用规则。带尾部空格的老关键词（比如 `'ei '`）保留原来的纯词首匹配方式。已加一个 `PRIORITY` 子串规则表，在主循环前先判断（如 `zuivel` → 乳制品奶酪、`maaltijd` → 冷冻速食），修了 AH 分类名 `Zuivel, eieren` 被误判成肉禽蛋、`Maaltijden, salades` 被误判成果蔬的问题。`PRIORITY` 现在还加了 `sauzen` → 调味酱料、酒类（`bier`/`wijn`/`champagne`/`cava`/`aperitieven`/`digestie` 等）、咖啡茶（`koffie`/`nespresso`/`thee` 等）。`aperitief` 改成复数形式 `aperitieven`，因为家乐福的顶层分类 "chips en aperitief" 其实是零食区，用单数形式会连带把这个顶层分类误判成酒类。

新增了 `toCatWithName(顶层分类, 商品名)`：顶层分类归到"饮料"时，只接受细分结果是酒类或咖啡茶的判断（其余细分结果不采纳，仍按饮料处理），带瓶装容量的 `tea`/`thee` 判回饮料；顶层分类归到"其他"时，用商品名做全量兜底匹配。Carrefour 和 Colruyt 用的是这个函数。

### 5.4 去重

按 `店 + 中文译名(或原名) + 原价 + 促销价` 去重。ALDI 的荷/法双语重复条目会被中文译名合并掉。本周实测：Lidl 272→268、Colruyt 1376→1370、Carrefour 1680→1673、ALDI 379→378。

### 5.5 页面设计

`web/template.html` 已经做完了，包含中文搜索框、常用词快捷键、按超市/品类筛选、按折扣力度或价格排序、明暗主题、手机优先。**不要重写设计**，改功能就行。数据用 `/*__DATA__*/` 占位符注入。

19 个品类各配了一个 16px 单色线性 SVG 图标（`CAT_ICON`），放在卡片元信息行品类名前面，风格和搜索/箭头图标一致（用户要的是"线条风格不花哨的 emoji"，实现成线性 SVG）。

店名映射按 `store` 这个英文 key 走（`STORE_LABEL`），筛选值用的也是 `store`，`meta.stores` 也按 `store` 计数。`STORE_LABEL` 已经加了 `Carrefour Market`/`Carrefour Express` 两个 key，店铺标签的显示文案用户明确说保持现状不改。同义词表查找时精确 key 优先命中，没有精确 key 才做包含式扩展。搜食品类词时会排除 `cat === '宠物'` 的商品，但如果查询本身包含猫、狗、宠这些字，或者扩展出了 kat / hond 这类词，或者用户直接选了宠物品类做筛选，就不排除。来源链接（`SRC`）指向官方商品页：Colruyt 改成了 `https://www.colruyt.be/nl/acties`，Lidl 改成了 `https://www.lidl.be/l/nl-BE/folder`，Carrefour Market/Express 各指自己的促销页，ALDI 是 aanbiedingen 页链接。页面顶部的统计条文案是「N 件本周促销 / N 件标了折扣 / N 件五折起 / 更新于...」。商品名可以点击跳到官网。

有效期是按用户打开页面的那一刻实时算的（拿 `ends` 跟当天日期比），已经过期的默认隐藏，要勾"显示已结束"才能看到；页面顶部的统计条只数未过期的商品；页脚写明这批数据的抓取日期和已过期的条数。多件促销的标签区分了两种情况：`mb` 为真且有 `po` 时写"整组价"，`mb` 为真但没有 `po` 时写"单件价"。

`scripts/build.js`：`po`、`pp` 两个字段都是空的记录会被直接丢弃（本周有 129 条属于这种情况）；`meta.updated` 现在取的是 `data/raw/_report.json` 里记录的抓取时间，不是脚本本次构建运行的时间。

---

## 6. 已知卡点

### 6.1 Vercel MCP 读不到这个团队的项目

Vercel MCP 在本机对团队项目的读取一律 404/403，用它查部署状态不可靠，改用 `gh api repos/Alanine4/leuven-discount/deployments` 或直接 curl 线上链接。线上项目 `leuven-zhekou` 是用户在控制台导入的。

### 6.2 Albert Heijn 全站 403（已解决）

本机 curl 和无头 Chromium 对 `www.ah.be` 一律 403（Akamai "Access Denied"），根因是 Akamai 按 `headless` 判据拦截，改用有头浏览器（`headless:false`）就能拿到 200，详细方案见第 4 节。剩下唯一没验证的是 GitHub Actions 的 CI 环境（用 xvfb 起虚拟显示）能不能一样过关，见第 7 节第 1 步。

### 6.3 Delhaize 反爬（已解决）

之前判成"SAP Hybris 前置反爬网关"，实测下来是 Akamai Bot Manager，和 AH 同一套，有头浏览器就能过，详见第 4 节。
剩下两个没验证的点：CI 的 xvfb 环境下能不能过（和 AH 同一个未知数，见第 7 节第 1 步）；
Akamai 偶尔会把某一页的 XHR 挂住不给响应（本地 1 小时内跑到第 4 趟时遇到过一次），代码里靠 90 秒超时 + 重试兜着，
但没验证过这是不是"短时间重复抓被限速"——正常一周只跑一两次，大概率碰不到。

---

## 7. 下一步做什么（按顺序）

1. 手动触发一次 Actions 确认 AH 在 CI 的 xvfb 下能过 Akamai（这是当前最大的未知）。
2. ~~周六以后看一次 AH 是否带出下周数据。~~ 已确认：09-12（周六）抓到 132 组，含下周数据，见第 4 节 AH 小节。
3. 用户对价（Carrefour Market 尤其）。
4. 配 `ANTHROPIC_API_KEY` secret，让中文词表的增量翻译开始跑。
5. ~~做 Delhaize。~~ 已完成，见第 4 节。

---

## 8. Backlog / 还没做的

- **ALDI 无品牌字段**：需要额外 379 次详情页请求才能拿到，没做。「下周起」这套逻辑只在周四抓的数据上验证过。
- **品类「其他」占比偏高**：3689 条里 405 条（11%）落进「其他」，主要是 Colruyt 的 "Niet-voeding" / "Kruidenierswaren/Droge voeding" 泛类目，和 ALDI 营销版块下没有分类字段的商品。
- **咖啡茶品类样本极少**：只有 2 条，怀疑是 Carrefour 的咖啡分类名没被关键词表命中，还没查。
- **单店模式会覆盖 report**：`node scripts/scrape.js lidl` 这种单店跑法会把 `data/raw/_report.json` 覆盖成只剩这一家的记录，CI 是全量跑不受影响，但本地单独调试某一家时别把这个当整体状态判断。
- **价格历史对比**：`data/history/` 每周一个快照，天然有数据了，可以做「这周是不是真便宜、比上个月的价格如何」这类判断，用户提过想要。
- **中文词表积累**：`lib/glossary.json` 现有 3667 条（人工分批写入），每周新商品仍要靠 `scripts/translate.js` 增量翻译，配了 `ANTHROPIC_API_KEY`（见第 7 节第 4 步）之后才会自动跑。
- **旧方案退役**：新链接稳定后，把那个 Claude 定时任务（`trig_01AtinoEkmHgD75MjtWmc7So`）停掉。
- 用户提过的小功能：「只看食品」开关、收藏常买商品。
- **AH `N voor €X` 那 16 条 `mb=0`**：页面会划掉整组原价显示整组促销价（靠 `dt` 说明），严格做法是让 `normalize()` 接受外部传入 `mb`。
- **`toCat()` 的 `Vegetarisch, vegan en plantaardig` 归"其他"**：还没处理。
- **词表品牌译法不统一**：有的用中文商标名（如「克特多金象」），有的保留原文，各批翻译没对齐。
- **家乐福 Express 折扣/有效期覆盖率低**：数据源本身的限制，不是解析问题。
- **Carrefour 原名截断**：有些商品名只剩后半段（如「met Parmigiano Reggiano 250 g」），要看详情页才能补全。
- **Colruyt 折扣语义未在门店标签核对**：第 5.1.1 节的 `benefitPercentage`/`minLimit` 读法是从数据结构反推出来的，还没拿一条实物门店促销标签核对过。
- **Carrefour `-N€` 直减的基准价未验证**：折前还是折后没查清楚。
- **Colruyt 1275 条 `url` 全空**：bucket 数据里有 `productId` 和 `seoBrand`，理论上能拼出商品详情页链接，但拼链接用的 slug 规则还没验证，拼错了会 404，所以暂时没做。
- **ALDI 13 条促销文案只写 `2 voor`/`3 voor` 不带价格**：这些仍然走旧的启发式算法，没有核对过是否算对。
- **`DOUWE EGBERTS Dessert` 系列被分到饮料**：商品名里没有 `koffie` 字样，没被咖啡茶关键词命中。
- **`PIEDBOEUF Pils` 和 `TYRRELLS S.salt&C.vin` 分类踩了假阳性**：前者因为名字里含 `boeuf` 被判成肉禽蛋，后者因为含 `vin` 被判成酒类，各 1 条。
- **Colruyt 的 `9+3 gratis`/`12+6 gratis` 文案可能跟门店标签对不上**：这两条是照 `benefitPercentage`/`minLimit` 数据老实算出来的，但门店的促销标签可能写的是更小的比例，比如「3+1，最少买 12 件」。
- **Delhaize 排不掉 Shop&Go 独有促销**：接口里根本没有店型字段（没有 AD / Proxy / Shop&Go 的区分），拿到的是全国统一的线上促销目录。鲁汶两家店（AD Brusselsestraat、Heverlee）适用，但"不要 Shop&Go"这条要求在数据层面无法执行。
- **Delhaize 的促销几乎全是 `redemptionLevel: MEMBER`**（要 SuperPlus 卡才享受），页面上没有标出来。
- **`toCat()` 把 `kruidenier`（杂货商）当 `kruid`（香料）、`zoute` 当 `zout`（盐）**：Delhaize 那边靠 scraper 里跳过这两个顶层名绕开了，但 `lib/categorize.js` 本身没改，Colruyt 的 `Kruidenierswaren/Droge voeding` 仍然会被判成「调味酱料」。
- **Delhaize 38 条长期促销**（`endDate` 是 12/31）`val` 显示成「长期促销」，不是「还剩 N 天」；这些是常年多件优惠，不是本周传单。
- **Delhaize 数据没跟门店或纸质传单核对过**：字段语义是从接口结构和促销文案推出来的，抽样对价还没做。

---

## 9. 合规注意事项（别写出会被封的爬虫）

| 站点 | 红线 |
|---|---|
| Lidl | 禁 `offset=` / `sort=` / `q=` / 含 `id=` 的参数；`fetchsize` 服务端封顶 108，靠按 category facet 递归切分拉完 |
| Carrefour | 禁 `?pmid=` 和 `/search?q=`；robots 末尾有兜底 `Disallow: /`。只走 `?p=N`，限速 1-2 秒 |
| Delhaize | 禁 `*/search/*`、`*/search?*`、`/en/`。走 `/api/v1/?operationName=ProductList`（路径里没有 search 段），页间 sleep 1600ms，一趟 29 个请求 |
| ALDI | 禁 `/*?*filters`（不要走分类筛选 URL）、`/mds/`、`/bal/`、`/can/` |
| Colruyt | `crawl-delay: 5`；官方 API 有主动反爬（别硬刚，走 bucket） |
| AH | `api.ah.nl` 全站 Disallow；`www.ah.be/bonus` 没禁，但 Akamai 只放行有头浏览器（无头一律 403） |
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
