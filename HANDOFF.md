# 鲁汶折扣雷达 — 交接文档

> 给接手的 Claude Code 看的。项目目录 `C:\Projects\Leuven_discount`。
> 最后更新：2026-09-10

---

## 1. 这是什么

给在比利时鲁汶（Leuven）的中国留学生用的**超市折扣聚合网页**。把几家超市每周传单里的促销商品汇总到一个页面，**能用中文关键词搜**——输入「意面」要能搜到 pasta / spaghetti / Barilla，看到哪家在打折、打几折。每周传单换新后自动更新。

用户是 Alan，KU Leuven 精算与金融工程硕士，会写代码（Vercel / Cloudflare / bun 都在用），所以技术方案可以按正常工程项目来，不用降级成傻瓜方案。

### 用户已经拍板的决策（不要再问一遍）

| 决策 | 结论 |
|---|---|
| 收哪几家 | Delhaize、Colruyt、Carrefour、ALDI、Lidl，**外加 Albert Heijn**（鲁汶 2025 年新开了一家） |
| Carrefour 店型 | **只要 Market + Express**，不要大卖场（鲁汶没有大卖场，大卖场的货在鲁汶买不到） |
| Delhaize 店型 | 不区分店型，但**不要 Shop&Go** |
| 品类范围 | **全都要**——电器、服饰、日用品也收，不只是食品 |
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

**（A）旧方案 — 已上线，还在跑**

- 云端 Artifact 页面：`https://claude.ai/code/artifact/44d14b3c-89ec-40d6-ad68-0247d059b1a8`
- 数据是**用 LLM 读网页**抓的（WebFetch + 子 agent 读 promotiez.be），2026-09-03 那期共 1433 条
- 有个每周定时任务（周一/周三 05:00 UTC）会重新抓一遍并更新这个页面
- 重建配方存在 Claude Project「折扣组合的可行性研究」里：`claude/rebuild-runbook.md`、`claude/merge.py`、`claude/template.html`
- **这套是过渡方案**，等 B 跑起来之后可以退役

**（B）新方案 — 正在建，就是这个仓库**

真爬虫 + GitHub Actions + Vercel。**这才是要继续做的东西。**

### 进度表

| 部分 | 状态 | 说明 |
|---|---|---|
| 仓库骨架 | ✅ 完成 | package.json / 目录结构 / .gitignore / vercel.json |
| 折扣力度算法 | ✅ 完成 | `lib/normalize.js`，已单测通过（见第 5 节，这里有个坑） |
| 品类归并 | ✅ 完成 | `lib/categorize.js`，荷/法/英关键词 → 19 个中文品类 |
| **Lidl 抓取** | ✅ 代码完成，**未实测** | JSON 接口，免鉴权，一次拉完 |
| **Colruyt 抓取** | ✅ 代码完成，**未实测** | 走公开 GCS bucket |
| **Carrefour 抓取** | ⚠️ 代码在，**选择器是猜的** | 需要跑 `npm run inspect:carrefour` 校准 |
| **AH 抓取** | ⚠️ 代码在，**接口没定位到** | 需要跑 `npm run inspect:ah` 抓包 |
| ALDI 抓取 | ⛔ 未开始 | 方案已调研清楚，见第 4 节 |
| Delhaize 抓取 | ⛔ 未开始 | 最难的一家，见第 4 节 |
| 合并/出页面 | ✅ 完成 | `scripts/build.js` |
| 中文名词表 | ✅ 机制完成，词表是空的 | `scripts/translate.js` + `lib/glossary.json` |
| 网页模板 | ✅ 完成 | `web/template.html`，搜索/筛选/排序都做好了 |
| GitHub Actions | ⚠️ 写好了但**缺一行** | 见第 6 节「已知卡点」 |
| 推到 GitHub | ⛔ 未做 | git 有锁文件卡住，见第 6 节 |
| Vercel 部署 | ⛔ 未做 | 等仓库上 GitHub |

**一句话总结当前位置**：仓库搭好了，六家里两家（Lidl、Colruyt）代码写完但一次都没真跑过，两家（Carrefour、AH）卡在"需要先探测真实接口/DOM"，两家（ALDI、Delhaize）还没动。**整条流水线端到端从来没跑通过一次。**

---

## 3. 仓库结构

```
C:\Projects\Leuven_discount\
├── package.json
├── vercel.json                    # outputDirectory: public
├── README.md
├── .github/workflows/refresh.yml  # 每周一、周三 05:00 UTC（缺一行，见第6节）
│
├── lib/
│   ├── normalize.js               # 统一 schema + 折扣力度计算 + 去重 + 带重试的 get()
│   ├── categorize.js              # 各店分类名 → 19 个中文品类
│   ├── browser.js                 # Playwright 封装：fetchHTML / fetchJSON / sniff
│   └── glossary.json              # 商品原名 → 中文名（目前是空的 {}）
│
├── scrapers/                      # 每家一个，都导出 default async function，返回 normalize 过的数组
│   ├── lidl.js                    # ✅ 能用（未实测）
│   ├── colruyt.js                 # ✅ 能用（未实测）
│   ├── carrefour.js               # ⚠️ 选择器待校准
│   └── ah.js                      # ⚠️ 接口待定位
│
├── scripts/
│   ├── scrape.js                  # 跑所有 scraper → data/raw/*.json（单家失败不影响其他家）
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

## 4. 数据源调研结论 ⭐

**这节是这个项目最值钱的部分，全部实测过，别重新探一遍浪费时间。**

### Lidl ✅ 难度低

```
GET https://www.lidl.be/q/api/search?assortment=BE&locale=nl_BE&version=2.0.0&fetchsize=1000&store=1
Accept: application/json
```

- **免鉴权**，无 token 无 key，裸请求就行
- `store=1` = 本周店内促销（facet 标签 "In de winkel"），实测 nl_BE 364 条、fr_BE 360 条。不带 `store=1` 是全线上商城 8571 条（基本是非食品）
- `fetchsize` 上限 1000，364 条**一次拉完不用翻页**
- 商品在 `items[].gridbox.data`，字段：`title` / `fullTitle` / `brand.name` / `price.price` / `price.oldPrice` / `price.discount.percentageDiscount` / `price.discount.bargainHintText` / `storeStartDate` / `storeEndDate`(Unix秒) / `category` / `image` / `canonicalUrl` / `ians`(EAN)
- 食品占比：`Voeding & drank` 177 条，约一半
- **robots 红线**：禁 `offset=` / `sort=` / `q=` / 任何含 `id=` 的参数。所以**不能翻页、不能在 URL 里排序**——排序在本地做
- ⚠️ 这是内部接口，Lidl 改字段就会挂。建议加个"结果数掉到 100 以下就报警"的校验
- ❌ `mobileapi.lidl.be` / `mobileapi.lidl.nl` **DNS 都不解析**，网上那些教程是过时的

### Colruyt ✅ 难度低（走 bucket）

**不要直接打官方 API。** 官方接口是活的：
```
https://apip.colruyt.be/gateway/ictmgmt.emarkecom.cgproductretrsvc.v2/v2/v2/nl/products?clientCode=CLP&page=N&size=250&placeId={id}
```
但要 `X-CG-APIKey` header + 无头浏览器拿的会话 cookie，**匿名 IP 10~20 次请求就被 Akamai 封**，全量要 ~50 次分页，GitHub Actions 的 IP 当场就挂。作者自己都得配付费代理池。

**改用这个**（BelgianNoise 的每日 dump，公开 GCS bucket，实测今天还在更新）：
```
列目录:   https://storage.googleapis.com/colruyt-products/?max-keys=2000
每日全量: https://storage.googleapis.com/colruyt-products/{YYYY-MM-DD-HH-MM-SS}.json   (~19MB)
促销详情: https://storage.googleapis.com/colruyt-products/promotions/{promotionId}.json
```
- 免鉴权，字段是官方接口原样透传
- 商品字段：`name` / `LongName` / `brand` / `price.basicPrice` / `price.measurementUnitPrice` + `measurementUnit`（单价）/ `inPromo` / `promotion[]` / `topCategoryName` / `squareImage`
- 促销详情字段：`activeStartDate` / `activeEndDate` / `promotionType` / `benefit[{benefitPercentage, minLimit}]`
- ⚠️ **接口不给 "2de aan -50%" 这种现成文案**，要自己从 `benefit` 拼：`minLimit:2 + benefitPercentage:50` → "2de aan -50%"
- ⚠️ **Colruyt 价格是按门店浮动的**（官方 FAQ 说每家店对标本地竞争对手定价）。bucket 用的是作者自己那个 placeId，不是鲁汶。如果要鲁汶精确价，只能自己打官方 API（代价见上）。**目前接受这个误差。**

### Carrefour ⚠️ 难度低，但选择器要校准

```
https://www.carrefour.be/nl/al-onze-promoties?p=N      (荷语，品牌字段更干净)
https://www.carrefour.be/fr/toutes-les-promotions?p=N  (法语)
```

- **服务端渲染**，cheerio 能解析（已验证：p=1/2/3/25/47 都能读到商品名、品牌、单价、每公斤价、促销标签、有效期）
- 每页固定 **36 条**，`sz=` 参数无效。总数从页面上的 "X producten" 动态解析，**不要硬编码页数**（波动很大：一周 2192，另一周 1662）
- 能拿到：商品名、品牌、单价、**每单位价(€/kg, €/l)**、促销类型("2+2 gratis"/"2de aan -50%")、有效期、分类、商品ID(8位)、图片URL(`https://cdn.carrefour.eu/420_{id}_T596.webp`)
- 拿不到：EAN、划线原价
- ❌ **裸 Node fetch 会 403**（TLS 指纹被识别），实测过。所以 `scrapers/carrefour.js` 已经改成走 Playwright
- **robots 红线**：禁 `?pmid=` 和 `/search?q=`，末尾还有个兜底 `User-agent: * → Disallow: /`（只白名单了 Googlebot 等）。`?p=` 本身没被禁。**只走 `?p=N` 主列表，限速 1-2 秒，带真实 UA**
- ⚠️ **分不出 Market / Express 店型**——这是全国线上促销目录，抓到的是超集。传单页 `/fr/folders` 有店型 tab 但是 JS 驱动、没有 URL 参数，且传单本身是扫描图。**目前接受这个超集，以后如果要过滤得另想办法**

### Albert Heijn ⚠️ 难度中偏高，接口没定位到

- **鲁汶有店**：Bondgenotenlaan 64，门店号 3164
- ⚠️ **ah.be 和 ah.nl 是两套独立定价**，已用同一商品 ID `wi123` 验证：BE €2.29 / NL €1.99。**所以 GitHub 上那些 `api.ah.nl` 的现成封装（SupermarktConnector、albert-heijn-wrapper 等）对鲁汶全都没用**
- 实测结果：
  - `www.ah.be/zoeken/api/products/search?...` → **500**（robots 是允许的，估计缺 header 或参数签名）
  - `www.ah.be/producten/api/products?bonus=true` → 200 但返回的是 **Next.js HTML 页面，不是 JSON**
  - `www.ah.be/bonus/api/metadata` → 404
  - `api.ah.nl/*` → robots 全站 Disallow
- **促销列表页是纯 JS 渲染**，cheerio 拿不到；**商品详情页是 SSR**，cheerio 能拿到（含 "2e halve prijs" 这类促销标签）
- **下一步就是抓包**：`npm run inspect:ah` 会用 Playwright 打开 `https://www.ah.be/bonus`，把页面自己调的 XHR 全打出来。拿到真实接口后改 `scrapers/ah.js`
- 备选：Apify 有个 `louisdeconinck/albert-heijn-belgium-scraper`，BE 专用，带 `isPromo`/`promoLabel`/`ean13`（付费）

### ALDI ⛔ 难度中，未开始

- **传单不是图片，不用 OCR**。`/aanbiedingen.html` 和 `/aanbiedingen-volgende-week.html` 是结构化商品列表（JS 渲染）；`/folders/folder-van-deze-week.html` 才是图片翻页器，**别碰那个**
- 站点是 **Next.js**（`/_next/image` 返回 400 而不是 404，已验证）。数据在 `<script id="__NEXT_DATA__">` 里
- 路线：Playwright 打开 `/aanbiedingen.html` → 读 `__NEXT_DATA__` → 从中取 `buildId` → 之后直接请求 `https://www.aldi.be/_next/data/{buildId}/aanbiedingen.json`（**buildId 每次发版会变，必须动态解析，不能硬编码**）
- 顺手在 Playwright 里开 network 监听看有没有更稳的 XHR 接口
- 商品有稳定数字 ID：`/product/<slug>-<数字ID>.html`；sitemap 免鉴权可读：`https://www.aldi.be/sitemaps/.aldi-nord-sitemap-products.xml`
- robots 很宽松，只禁 `/*?*filters`（所以**不要走分类筛选 URL**）、`/mds/`、`/bal/`、`/can/`、`/reg-*.html`
- 荷/法两个版本要分别跑（`/` 和 `/fr/`），会产生重复条目，靠中文译名或价格去重
- ⚠️ 有 bot 防护迹象（robots 里有 `/ua-bot.html`，第三方代理请求会 429），要控频率
- 参考：Apify `niktor76/aldi-nord-offers` 就是读 `__NEXT_DATA__` 的，同一套 ALDI Nord 平台

### Delhaize ⛔ 难度高，未开始

- SAP Hybris / SAP Commerce 后端（`/authorizationserver/oauth/token` 返回 401 而不是 404，证实了）
- `/api/v1/*` **一律 403**，连不存在的路径也 403 → 前置反爬网关，不是资源不存在
- 标准 OCC 路径（`/occ/v2/`、`/rest/v2/`、`/ycommercewebservices/`）**全部 404**
- 全站 JS 渲染，分类页/promo 页 HTML 里一个商品都没有
- **robots 红线**：`Disallow: */search/*` 和 `*/search?*` —— 任何搜索/筛选类 URL 都禁止
- 路线：Playwright 打开分类页，监听 network 把 `/api/v1/...` 的真实 URL 和必需 header（Bearer / cookie / x-*）打印出来，之后才谈得上直接调
- 门店清单没阻力：`stores.delhaize.be` robots 全放行，有 sitemap，400+ 家店
- 旁证：Apify 上 Colruyt/Dirk/AH/Aldi 都有现成 scraper，**唯独没有 Delhaize**；GitHub 上也没有任何 delhaize scraper 开源项目。它确实比同行难搞
- **建议：放到最后做，或者这家继续用旧方案（LLM 读 promotiez.be）兜着**

### 不要用的东西

- **promotiez.be**：旧方案在用，但它 robots.txt 明确 `Disallow: /winkels/*?*` 和 `/promoties/*?*`——正好是分页 URL。偶尔抓没事，**做成每周自动爬站不住**。而且它给的是"整组价"不是单价
- **Colruyt 官方 API 硬刚**：见上，要付费代理池

---

## 5. 关键设计决策（改代码前先看这节）

### 5.1 折扣力度：促销文案优先于价格比 ⭐

**这是踩过坑改出来的，不要退回去。**

传单上标的"原价"经常是**整组价**。真实案例：北荷兰高达奶酪片标 `€14.98 → €5.99`，直接相除得 -60%，但促销文案是 `2de aan -50%`（第二件半价），**实际优惠只有 25%**。去 Carrefour 官网核对过，那款单价是 €3.69–4.59。

`lib/normalize.js` 的 `effectiveDiscount()` 规则：

| 文案 | 折扣力度 |
|---|---|
| `2de aan -50%` / `2ème à -50%` | 25%（`off / n`） |
| `2+2 gratis` | 50%（`free / (buy+free)`） |
| `3+1 gratis` | 25% |
| `-30%` | 30% |
| 都没有 → 才用价格比 | `1 - pp/po` |
| 价格比 ≥60% 且无文案佐证 | 标 `unc=1`，页面显示"约 -N%"，排序降权 |

配套：`mb=1`（多件优惠）的商品**页面上不显示划线原价**，改显示"整组价"——因为那个数字不是可比的"原价"。

### 5.2 中文搜索：查询扩展，不是逐条翻译 ⭐

**不需要给每个商品都翻译中文名。** 页面里（`web/template.html` 的 `SYN` 常量）有一份中文→荷/法/英同义词表，搜索时把「意面」扩展成 `pasta / spaghetti / penne / fusilli / tagliatelle / lasagne / macaroni` 再去匹配商品原名。

所以**没有中文译名也能搜到**。`lib/glossary.json` 里的译名只影响显示好不好看，会随每周运行慢慢积累（`scripts/translate.js`，配了 `ANTHROPIC_API_KEY` 才跑，翻过的不会重翻）。

**匹配规则**：中文查询按包含匹配；拉丁词按**词首**匹配（`\bpasta`）。这样搜 `pasta` 不会命中 `tandpasta`（牙膏）——这是实际踩到的问题。词首匹配是有意的，因为 `kip` 要能命中 `kipfilet`。

### 5.3 去重

按 `店 + 中文译名(或原名) + 原价 + 促销价` 去重。ALDI 的荷/法双语重复条目会被中文译名合并掉。上一版实测 1540 → 1433 条。

### 5.4 页面设计

`web/template.html` 已经做完了，包含：中文搜索框 + 常用词快捷键、按超市/品类筛选、按折扣力度或价格排序、明暗主题、手机优先。**不要重写设计**，改功能就行。数据用 `/*__DATA__*/` 占位符注入。

---

## 6. 已知卡点 ⛔

### 6.1 git 被锁文件卡住

`.git/index.lock`、`.git/HEAD.lock`、`.git/objects/maintenance.lock` 存在，导致所有 git 操作失败。（起因：之前通过一个不能删文件的沙箱跑 git，锁文件删不掉。）

```powershell
Remove-Item .git\*.lock, .git\objects\*.lock -Force -ErrorAction SilentlyContinue
```

另外 **remote 被加成了字面量占位符** `https://github.com/<你的用户名>/leuven-discount.git`，要先 `git remote remove origin` 再加真的。

现在仓库里有一个初始 commit（`05af25d`），之后的改动还没提交。

### 6.2 workflow 文件缺一行

`.github/workflows/refresh.yml` 里，`- run: npm ci || npm install` 那行**下面**要加：

```yaml
      - run: npx playwright install --with-deps chromium
```

（Carrefour 和 AH 都要 Playwright，CI 里必须先装浏览器。这个文件被安全策略保护、远程工具写不了，所以一直没加上。）

### 6.3 Carrefour 选择器没校准

`scrapers/carrefour.js` 里的 CSS 选择器是**猜的**（给了一堆候选：`.product-tile`、`.product-item`、`[data-product-id]` 等）。第一次跑大概率解析出 0 条。

```powershell
npm run inspect:carrefour
```
会用浏览器取页面，打印出现 20~60 次的 class（每页 36 个商品，卡片一般落这个区间）和一个卡片的完整 HTML，同时把整页存到 `data/debug/carrefour-p1.html`。照着改 `parsePage()` 里的选择器。

### 6.4 AH 接口没定位

```powershell
npm run inspect:ah
```
用 Playwright 打开 `https://www.ah.be/bonus` 和 `/producten?Bonus=true`，把页面调的 XHR（状态码 + URL + 顶层字段 + 返回前 300 字符）全打出来。找那条 200 且顶层字段里有 `products`/`cards`/`items` 的，然后改 `scrapers/ah.js` 的 `CANDIDATES` 和 `toRows()`。

### 6.5 端到端从没跑通

Lidl 和 Colruyt 的代码**一次都没真正执行过**（写代码的环境没有外网）。第一次跑很可能有字段名对不上的小问题。先单独跑：

```powershell
node scripts/scrape.js lidl
node scripts/scrape.js colruyt
```

---

## 7. 下一步做什么（按顺序）

1. **解锁 git**（6.1），把现有改动提交
2. **补 workflow 那一行**（6.2）
3. `npm install && npx playwright install chromium`
4. **单独跑通 Lidl 和 Colruyt**（6.5），字段对不上就改 scraper
5. **校准 Carrefour 选择器**（6.3）
6. **定位 AH 接口**（6.4），改 `scrapers/ah.js`
7. `npm run refresh` 端到端跑一次，打开 `public/index.html` 肉眼检查：
   - 条数合不合理（预期 1000~2000 条）
   - 搜「意面」能不能出 pasta 商品，会不会出牙膏
   - 折扣力度有没有一堆离谱的 -90%
   - 价格和某家超市 app 里的真实传单能不能对上（**这一步很重要，用户很在意数据准不准，上一版就是靠对比他 Carrefour app 的截图发现抓错了店型**）
8. **推到 GitHub**，Vercel 导入（Output Directory 填 `public`），拿到链接
9. 手动触发一次 GitHub Actions（workflow_dispatch）确认 CI 里也能跑
10. 之后再做 **ALDI**（第 4 节有完整方案），最后啃 **Delhaize**

---

## 8. Backlog / 还没做的

- **ALDI 抓取**（方案已调研，见 4 节）
- **Delhaize 抓取**（最难，或者这家继续用旧方案兜着）
- **Carrefour 店型过滤**：现在拿到的是全国超集，鲁汶只有 Market/Express。没想到好办法
- **Colruyt 鲁汶门店价**：现在用的是 bucket 里别人那个 placeId 的价格
- **价格历史对比**：`data/history/` 每周一个快照，天然有数据了，可以做「这周是不是真便宜 / 比上个月的价格如何」——用户提过想要这种判断
- **中文词表积累**：`lib/glossary.json` 现在是空的，配 `ANTHROPIC_API_KEY` 后每周自动补
- **旧方案退役**：新链接稳定后，把那个 Claude 定时任务（`trig_01AtinoEkmHgD75MjtWmc7So`）停掉
- 用户提过的小功能：「只看食品」开关、收藏常买商品

---

## 9. 合规注意事项（别写出会被封的爬虫）

| 站点 | 红线 |
|---|---|
| Lidl | 禁 `offset=` / `sort=` / `q=` / 含 `id=` 的参数。靠 `fetchsize=1000` 一次拉完 |
| Carrefour | 禁 `?pmid=` 和 `/search?q=`；robots 末尾有兜底 `Disallow: /`。只走 `?p=N`，限速 1-2 秒 |
| Delhaize | 禁 `*/search/*` 和 `*/search?*` |
| ALDI | 禁 `/*?*filters`（不要走分类筛选 URL）、`/mds/`、`/bal/`、`/can/` |
| Colruyt | `crawl-delay: 5`；官方 API 有主动反爬（别硬刚，走 bucket） |
| AH | `api.ah.nl` 全站 Disallow；`www.ah.be/zoeken/api/` 是允许的 |
| promotiez.be | 禁带 query 的 `/winkels/*?*` 和 `/promoties/*?*`。**不要做成自动爬** |

通用：每周只跑一两次，带真实 UA，请求之间留 1-2 秒，别并发轰。

---

## 10. 验收标准

做完了应该是这样：

- 一个 Vercel 链接，手机打开能用
- 至少 4 家超市（Lidl、Colruyt、Carrefour、AH）的本周促销，1000 条以上
- 搜「意面」出的是意面不是牙膏；搜「鸡肉」能出 kip/poulet 的商品
- 折扣力度经得起推敲——随便挑 5 条跟超市 app 里的传单对一遍，价格和促销方式对得上
- GitHub Actions 每周一、周三自动跑完并提交，Vercel 自动重新部署，**链接不变**
- 某一家抓挂了，其他家照常出页面（`scripts/scrape.js` 已经是这个逻辑），`data/raw/_report.json` 里能看到哪家挂了
