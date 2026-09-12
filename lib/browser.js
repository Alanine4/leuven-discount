// 有些站（Carrefour、AH）会按 TLS 指纹和请求头挡掉裸 fetch，
// 这些站统一走真实浏览器。Playwright 按需启动，用完关掉。
let _browser = null;
let _headed = null;

async function browser() {
  if (_browser) return _browser;
  const { chromium } = await import('playwright');
  _browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  return _browser;
}

/**
 * 有头浏览器，单独一个实例，跟上面的无头实例互不影响。
 * ah.be 的 Akamai 对无头一律 403（headless shell 和 msedge 无头都试过），只有有头能过。
 * 按 msedge → chrome → 自带 chromium 的顺序试：本机自带的完整版 chromium 是坏的
 * （spawn UNKNOWN），CI 上没装 Edge/Chrome，两边各能命中一个。
 */
async function headedBrowser() {
  if (_headed) return _headed;
  const { chromium } = await import('playwright');
  const errs = [];
  for (const channel of ['msedge', 'chrome', undefined]) {
    try {
      _headed = await chromium.launch({
        ...(channel ? { channel } : {}),
        headless: false, args: ['--disable-blink-features=AutomationControlled'],
      });
      return _headed;
    } catch (e) { errs.push(`${channel || 'chromium'} → ${e.message.split('\n')[0].slice(0, 120)}`); }
  }
  throw new Error(`起不了有头浏览器（CI 里要用 xvfb-run 包一层）：\n    ${errs.join('\n    ')}`);
}

export async function closeBrowser() {
  if (_browser) { await _browser.close(); _browser = null; }
  if (_headed) { await _headed.close(); _headed = null; }
}

async function newContext() {
  const b = await browser();
  return b.newContext({
    locale: 'nl-BE',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'nl-BE,nl;q=0.9,en;q=0.8' },
  });
}

/**
 * 有头开一个页面，交给回调自己用（比如在页面里 fetch 同源接口）。
 * onPage 在 goto 之前拿到 page，用来挂 page.on('request') 之类的监听器。
 * 这里刻意不改 userAgent / 不塞额外请求头：真实 Edge 的指纹本身就是能过 Akamai 的那套，
 * 伪造成 Chrome/128 反而会和浏览器真实特征对不上。
 */
export async function headedPage(url, fn, { waitFor = 'domcontentloaded', settle = 2000, onPage } = {}) {
  const b = await headedBrowser();
  const ctx = await b.newContext({ locale: 'nl-BE', viewport: { width: 1280, height: 800 } });
  try {
    const page = await ctx.newPage();
    if (onPage) onPage(page);            // 想听首屏自己发的请求，得赶在 goto 之前挂监听
    const res = await page.goto(url, { waitUntil: waitFor, timeout: 60000 });
    await page.waitForTimeout(settle);
    return await fn(page, res);
  } finally { await ctx.close(); }
}

/** 用浏览器取一个页面的 HTML（JS 渲染的内容也在里面） */
export async function fetchHTML(url, { waitFor = 'domcontentloaded', settle = 1200 } = {}) {
  const ctx = await newContext();
  try {
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: waitFor, timeout: 45000 });
    if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()}`);
    await page.waitForTimeout(settle);
    return await page.content();
  } finally { await ctx.close(); }
}

/** 在浏览器里发请求，带上页面的 cookie 和同源身份 —— 用来调那些认 referer/cookie 的接口 */
export async function fetchJSON(url, { origin, headers = {} } = {}) {
  const ctx = await newContext();
  try {
    const page = await ctx.newPage();
    if (origin) await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45000 });
    return await page.evaluate(async ([u, h]) => {
      const r = await fetch(u, { headers: h, credentials: 'include' });
      const t = await r.text();
      try { return { status: r.status, json: JSON.parse(t) }; }
      catch { return { status: r.status, text: t.slice(0, 500) }; }
    }, [url, headers]);
  } finally { await ctx.close(); }
}

/** 打开页面，把它自己调的 XHR/fetch 接口抓出来 —— 用来摸未知接口 */
export async function sniff(url, { match = /api|graphql|bonus|promo|product/i, settle = 5000, capture = true } = {}) {
  const ctx = await newContext();
  const hits = [];
  try {
    const page = await ctx.newPage();
    page.on('response', async (r) => {
      const u = r.url();
      if (!match.test(u) || !['xhr', 'fetch'].includes(r.request().resourceType())) return;
      const hit = { status: r.status(), method: r.request().method(), url: u };
      if (capture && r.status() < 400) {
        try {
          const body = await r.text();
          hit.bytes = body.length;
          hit.preview = body.slice(0, 300);
          try { hit.keys = Object.keys(JSON.parse(body)).join(', '); } catch {}
        } catch {}
      }
      hits.push(hit);
    });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(settle);
  } finally { await ctx.close(); }
  return hits;
}
